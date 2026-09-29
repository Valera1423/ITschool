// backend/src/routes/users.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireRole, requireMfa } from '../middleware/auth.js';
import { KeycloakService } from '../services/keycloak.service.js';
import { SyncService } from '../services/sync.service.js';
import { UserActivityService } from '../services/user-activity.service.js';
import { SecurityService } from '../services/security.service.js';
import { prisma } from '../db/prisma.js';
import { ok, created, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { logger } from '../config/logger.js';

const router = Router();

// ============================================================
// Схемы
// ============================================================

const createUserBody = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(200),
  role: z.enum(['admin', 'manager', 'nam']),
  password: z.string().min(8).max(200).optional(),
});

const inviteBody = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(200),
  role: z.enum(['admin', 'manager', 'nam']),
  customRoleId: z.string().uuid().nullable().optional(),
});

const roleBody = z.object({ role: z.enum(['admin', 'manager', 'nam']) });
const blockBody = z.object({ blocked: z.boolean() });

// ============================================================
// Утилиты
// ============================================================

/**
 * Проверить, что смена статуса профиля не оставит систему
 * без активного администратора.
 *
 * Вызывается перед:
 *   - сменой роли admin → другая;
 *   - блокировкой активного admin'а;
 *   - удалением активного admin'а.
 */
async function ensureNotLastAdmin(
  targetId: string,
  reason: 'demote' | 'block' | 'delete',
): Promise<void> {
  const others = await prisma.profile.count({
    where: {
      role: 'admin',
      blocked: false,
      id: { not: targetId },
    },
  });
  if (others === 0) {
    const messages: Record<typeof reason, string> = {
      demote: 'Нельзя снять роль с последнего активного администратора',
      block: 'Нельзя заблокировать последнего активного администратора',
      delete: 'Нельзя удалить последнего активного администратора',
    };
    throw new AppError('STATE_CONFLICT', 409, {
      reason: messages[reason],
      hint: 'Сначала назначьте другого администратора',
    });
  }
}

/**
 * Обёртка «изменение профиля → аудит + SecurityEvent».
 */
async function logProfileAction(input: {
  req: { ip?: string | null; headers: Record<string, unknown>; auth?: { profileId: string | null; email: string } };
  target: { id: string; email: string };
  action: 'insert' | 'update' | 'delete';
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  security: {
    eventType:
      | 'role_changed'
      | 'blocked_user'
      | 'user_created'
      | 'user_deleted'
      | 'password_reset';
    severity?: 'info' | 'warning' | 'critical';
    details?: Record<string, unknown>;
  };
}): Promise<void> {
  const auth = input.req.auth;

  // AuditLog — пишется синхронно, ошибку не блокируем
  await prisma.auditLog
    .create({
      data: {
        userId: auth?.profileId ?? null,
        userEmail: auth?.email ?? null,
        entity: 'profiles',
        entityId: input.target.id,
        action: input.action,
        before: input.before as never,
        after: input.after as never,
      },
    })
    .catch((e) => logger.warn({ err: e }, 'audit log failed'));

  // SecurityEvent — fire-and-forget
  void SecurityService.log({
    eventType: input.security.eventType,
    severity: input.security.severity ?? 'info',
    userId: auth?.profileId ?? null,
    email: auth?.email ?? null,
    ip: input.req.ip ?? null,
    userAgent: (input.req.headers['user-agent'] as string) ?? null,
    details: {
      targetUserId: input.target.id,
      targetEmail: input.target.email,
      ...input.security.details,
    },
  });
}

// ============================================================
// GET /users/me/activity — личные действия, БЕЗ admin
// ============================================================

router.get('/me/activity', async (req, res, next) => {
  try {
    const userId = req.auth!.profileId;
    if (!userId) return ok(res, []);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const items = await UserActivityService.recent(userId, limit);
    return ok(res, items);
  } catch (e) { next(e); }
});

router.delete('/me/activity', async (req, res, next) => {
  try {
    const userId = req.auth!.profileId;
    if (!userId) return noContent(res);
    await UserActivityService.clear(userId);
    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// GET /users — только admin
// ============================================================

router.get('/', requireRole('admin'), async (_req, res, next) => {
  try {
    const users = await prisma.profile.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        customRole: {
          select: { id: true, code: true, label: true, active: true },
        },
      },
    });
    return ok(res, users);
  } catch (e) { next(e); }
});

// ============================================================
// POST /users/sync — синхронизация с Keycloak
// ============================================================

router.post('/sync', requireRole('admin'), requireMfa, async (_req, res, next) => {
  try {
    const result = await SyncService.syncAllUsers();
    return ok(res, result);
  } catch (e) { next(e); }
});

// ============================================================
// POST /users — создание
// ============================================================

router.post('/', requireRole('admin'), requireMfa, async (req, res, next) => {
  try {
    const data = createUserBody.parse(req.body);

    const existing = await prisma.profile.findFirst({
      where: { email: data.email.toLowerCase() },
      select: { id: true },
    });
    if (existing) throw new AppError('ALREADY_EXISTS', 409);

    const kcUser = await KeycloakService.createUser({
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      password: data.password,
    });

    await SyncService.syncOne(kcUser.id);

    const created = await prisma.profile.findFirst({
      where: { email: data.email.toLowerCase() },
    });
    if (!created) throw new AppError('INTERNAL_ERROR', 500);

    await logProfileAction({
      req: req as never,
      target: { id: created.id, email: created.email },
      action: 'insert',
      before: null,
      after: { email: created.email, role: created.role },
      security: {
        eventType: 'user_created',
        severity: 'info',
        details: { role: created.role, source: 'manual' },
      },
    });

    return created(res, kcUser);
  } catch (e) { next(e); }
});

// ============================================================
// POST /users/invite — приглашение сотрудника
// ============================================================

router.post('/invite', requireRole('admin'), requireMfa, async (req, res, next) => {
  try {
    const data = inviteBody.parse(req.body);
    const email = data.email.toLowerCase();

    const existing = await prisma.profile.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existing) throw new AppError('ALREADY_EXISTS', 409, { field: 'email' });

    // 1. Keycloak
    const kcUser = await KeycloakService.createUser({
      email,
      fullName: data.fullName,
      role: data.role,
    });

    // 2. Sync в БД
    await SyncService.syncOne(kcUser.id);

    // 3. Кастомная роль (опционально)
    let profile = await prisma.profile.findFirst({ where: { email } });
    if (data.customRoleId && profile) {
      const role = await prisma.customRole.findUnique({
        where: { id: data.customRoleId },
        select: { id: true, active: true },
      });
      if (role?.active) {
        profile = await prisma.profile.update({
          where: { id: profile.id },
          data: { customRoleId: role.id },
        });
      }
    }

    // 4. Письмо-приглашение
    try {
      await KeycloakService.sendInviteEmail(kcUser.id);
    } catch (e) {
      logger.warn({ err: e, kcUserId: kcUser.id }, 'Send invite email failed');
    }

    if (profile) {
      await logProfileAction({
        req: req as never,
        target: { id: profile.id, email: profile.email },
        action: 'insert',
        before: null,
        after: { email, role: data.role, customRoleId: data.customRoleId ?? null },
        security: {
          eventType: 'user_created',
          severity: 'info',
          details: {
            role: data.role,
            source: 'invite',
            customRoleId: data.customRoleId ?? null,
          },
        },
      });
    }

    return created(res, { ok: true, profile });
  } catch (e) { next(e); }
});

// ============================================================
// PATCH /users/:id/role
// ============================================================

router.patch(
  '/:id/role',
  requireRole('admin'),
  requireMfa,
  async (req, res, next) => {
    try {
      const { role } = roleBody.parse(req.body);
      const profile = await prisma.profile.findUnique({
        where: { id: req.params.id },
      });
      if (!profile) throw new AppError('NOT_FOUND', 404);

      // ── Нельзя менять роль самому себе. Это классический способ
      //    «случайно» потерять доступ, особенно если admin
      //    в одиночку управляет системой.
      if (profile.id === req.auth!.profileId) {
        throw new AppError('CANNOT_EDIT_SELF', 403, {
          reason: 'Нельзя менять роль самому себе',
        });
      }

      // ── Защита последнего админа.
      if (
        profile.role === 'admin' &&
        role !== 'admin' &&
        !profile.blocked
      ) {
        await ensureNotLastAdmin(profile.id, 'demote');
      }

      // ── Keycloak
      if (profile.keycloakSub) {
        await KeycloakService.changeRole(profile.keycloakSub, role);
      }

      const updated = await prisma.profile.update({
        where: { id: profile.id },
        data: { role },
      });

      await logProfileAction({
        req: req as never,
        target: { id: profile.id, email: profile.email },
        action: 'update',
        before: { role: profile.role },
        after: { role },
        security: {
          eventType: 'role_changed',
          severity: 'warning',
          details: { from: profile.role, to: role },
        },
      });

      return ok(res, updated);
    } catch (e) { next(e); }
  },
);

// ============================================================
// POST /users/:id/block
// ============================================================

router.post(
  '/:id/block',
  requireRole('admin'),
  requireMfa,
  async (req, res, next) => {
    try {
      const { blocked } = blockBody.parse(req.body);
      const profile = await prisma.profile.findUnique({
        where: { id: req.params.id },
      });
      if (!profile) throw new AppError('NOT_FOUND', 404);

      // ── Нельзя заблокировать себя
      if (profile.id === req.auth!.profileId && blocked) {
        throw new AppError('CANNOT_EDIT_SELF', 403, {
          reason: 'Нельзя заблокировать себя',
        });
      }

      // ── Нельзя заблокировать последнего активного admin'а
      if (profile.role === 'admin' && blocked && !profile.blocked) {
        await ensureNotLastAdmin(profile.id, 'block');
      }

      // ── Keycloak
      if (profile.keycloakSub) {
        await KeycloakService.setUserEnabled(profile.keycloakSub, !blocked);
      }

      const updated = await prisma.profile.update({
        where: { id: profile.id },
        data: { blocked },
      });

      await logProfileAction({
        req: req as never,
        target: { id: profile.id, email: profile.email },
        action: 'update',
        before: { blocked: profile.blocked },
        after: { blocked },
        security: {
          eventType: 'blocked_user',
          severity: blocked ? 'warning' : 'info',
          details: { blocked, role: profile.role },
        },
      });

      return ok(res, updated);
    } catch (e) { next(e); }
  },
);

// ============================================================
// POST /users/:id/reset-password
// ============================================================

router.post(
  '/:id/reset-password',
  requireRole('admin'),
  requireMfa,
  async (req, res, next) => {
    try {
      const profile = await prisma.profile.findUnique({
        where: { id: req.params.id },
      });
      if (!profile?.keycloakSub) throw new AppError('NOT_FOUND', 404);

      await KeycloakService.sendResetPasswordEmail(profile.keycloakSub);

      await logProfileAction({
        req: req as never,
        target: { id: profile.id, email: profile.email },
        action: 'update',
        before: null,
        after: { resetEmailSent: true },
        security: {
          eventType: 'password_reset',
          severity: 'info',
          details: { targetEmail: profile.email },
        },
      });

      return noContent(res);
    } catch (e) { next(e); }
  },
);

// ============================================================
// DELETE /users/:id
// ============================================================

router.delete(
  '/:id',
  requireRole('admin'),
  requireMfa,
  async (req, res, next) => {
    try {
      const profile = await prisma.profile.findUnique({
        where: { id: req.params.id },
      });
      if (!profile) throw new AppError('NOT_FOUND', 404);

      // ── Нельзя удалить себя
      if (profile.id === req.auth!.profileId) {
        throw new AppError('CANNOT_EDIT_SELF', 403, {
          reason: 'Нельзя удалить самого себя',
        });
      }

      // ── Нельзя удалить последнего admin'а
      if (profile.role === 'admin' && !profile.blocked) {
        await ensureNotLastAdmin(profile.id, 'delete');
      }

      await prisma.profile.delete({ where: { id: profile.id } });

      await logProfileAction({
        req: req as never,
        target: { id: profile.id, email: profile.email },
        action: 'delete',
        before: { email: profile.email, role: profile.role },
        after: null,
        security: {
          eventType: 'user_deleted',
          severity: 'warning',
          details: { role: profile.role },
        },
      });

      return noContent(res);
    } catch (e) { next(e); }
  },
);

export default router;