// backend/src/routes/custom-roles.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireRole, requireMfa } from '../middleware/auth.js';
import { SecurityService } from '../services/security.service.js';
import { ok, created, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { PERMISSIONS, PERMISSION_CODES } from '../config/permissions.js';

const router = Router();

// ============================================================
// ЗАПРЕЩЁННЫЕ PERMISSIONS ДЛЯ БАЗОВЫХ РОЛЕЙ
// ============================================================
//
// Кастомная роль — это надстройка над базовой ролью Keycloak
// (nam / manager / admin). Она расширяет права, но не должна
// превращать nam в admin'а через бэкдор.
//
// Правило: даже если у пользователя есть кастомная роль, его
// базовая роль устанавливает нижнюю планку безопасности. Поэтому:
//   - nam не может получить привилегии уровня admin;
//   - manager не может получить критичные для ИБ права.

/** Никогда не выдаются роли с базой `nam`. */
const FORBIDDEN_FOR_NAM = new Set([
  'universities.delete',
  'universities.import',
  'universities.export',
  'users.manage',
  'security.view',
  'security.ip_whitelist',
  'audit.view',
  'backup.manage',
  'integrations.manage',
  'catalogs.manage',
  'automation.manage',
  'contracts.delete',
  'contracts.approve',
  'contracts.sign',
]);

/** Никогда не выдаются роли с базой `manager`. */
const FORBIDDEN_FOR_MANAGER = new Set([
  'users.manage',
  'security.ip_whitelist',
  'backup.manage',
]);

function assertPermissionsAllowedForBase(
  baseRole: 'admin' | 'manager' | 'nam',
  permissions: string[],
): void {
  if (baseRole === 'admin') return;

  const forbidden =
    baseRole === 'nam' ? FORBIDDEN_FOR_NAM : FORBIDDEN_FOR_MANAGER;

  const violations = permissions.filter((p) => forbidden.has(p));
  if (violations.length > 0) {
    throw new AppError('VALIDATION_FAILED', 400, {
      reason: `Эти permissions нельзя выдать роли с базой «${baseRole}»`,
      forbidden: violations,
    });
  }
}

// ============================================================
// Схемы
// ============================================================

const bodySchema = z.object({
  code: z.string().min(2).max(64).regex(/^[a-z0-9_-]+$/i),
  label: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  permissions: z.array(z.string()).default([]),
  baseRole: z.enum(['admin', 'manager', 'nam']).default('nam'),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(100),
}).superRefine((data, ctx) => {
  const invalid = data.permissions.filter((p) => !PERMISSION_CODES.has(p));
  if (invalid.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['permissions'],
      message: `Неизвестные permissions: ${invalid.join(', ')}`,
    });
  }
});

// ============================================================
// GET /permissions — публичный список (для UI)
// ============================================================
router.get('/permissions', (_req, res) => ok(res, PERMISSIONS));

// ============================================================
// GET / — список ролей (admin, без MFA: чтение)
// ============================================================
router.get('/', requireRole('admin'), async (_req, res, next) => {
  try {
    const items = await prisma.customRole.findMany({
      orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { label: 'asc' }],
      include: { _count: { select: { profiles: true } } },
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

// ============================================================
// POST / — создание роли
// ============================================================
router.post(
  '/',
  requireRole('admin'),
  requireMfa,
  async (req, res, next) => {
    try {
      const data = bodySchema.parse(req.body);
      assertPermissionsAllowedForBase(data.baseRole, data.permissions);

      const existing = await prisma.customRole.findUnique({
        where: { code: data.code },
        select: { id: true },
      });
      if (existing) {
        throw new AppError('ALREADY_EXISTS', 409, {
          reason: `Роль с кодом «${data.code}» уже существует`,
        });
      }

      const item = await prisma.customRole.create({
        data: {
          code: data.code,
          label: data.label,
          description: data.description ?? null,
          permissions: data.permissions,
          baseRole: data.baseRole,
          active: data.active,
          sortOrder: data.sortOrder,
        },
      });

      void SecurityService.log({
        eventType: 'permissions_changed',
        severity: 'info',
        userId: req.auth!.profileId,
        email: req.auth!.email,
        ip: req.ip ?? null,
        userAgent: (req.headers['user-agent'] as string) ?? null,
        details: {
          kind: 'custom_role_created',
          roleId: item.id,
          code: item.code,
          baseRole: item.baseRole,
          permissionsCount: item.permissions.length,
        },
      });

      return created(res, item);
    } catch (e) { next(e); }
  },
);

// ============================================================
// PATCH /:id — обновление роли
// ============================================================
router.patch(
  '/:id',
  requireRole('admin'),
  requireMfa,
  async (req, res, next) => {
    try {
      const data = bodySchema.partial().parse(req.body);

      const before = await prisma.customRole.findUnique({
        where: { id: req.params.id },
      });
      if (!before) throw new AppError('NOT_FOUND', 404);

      // Проверяем permissions против фактической (после патча) baseRole
      if (data.permissions !== undefined) {
        const effectiveBase = data.baseRole ?? before.baseRole;
        assertPermissionsAllowedForBase(
          effectiveBase as 'admin' | 'manager' | 'nam',
          data.permissions,
        );
      }

      const item = await prisma.customRole.update({
        where: { id: req.params.id },
        data: {
          ...(data.label !== undefined ? { label: data.label } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.permissions !== undefined ? { permissions: data.permissions } : {}),
          ...(data.baseRole !== undefined ? { baseRole: data.baseRole } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
          ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
          updatedAt: new Date(),
        },
      });

      const permissionsChanged =
        data.permissions !== undefined &&
        JSON.stringify([...before.permissions].sort()) !==
          JSON.stringify([...item.permissions].sort());

      void SecurityService.log({
        eventType: 'permissions_changed',
        severity: permissionsChanged ? 'warning' : 'info',
        userId: req.auth!.profileId,
        email: req.auth!.email,
        ip: req.ip ?? null,
        userAgent: (req.headers['user-agent'] as string) ?? null,
        details: {
          kind: 'custom_role_updated',
          roleId: item.id,
          code: item.code,
          permissionsChanged,
          permissionsCountBefore: before.permissions.length,
          permissionsCountAfter: item.permissions.length,
          baseRoleChanged: before.baseRole !== item.baseRole,
        },
      });

      return ok(res, item);
    } catch (e) { next(e); }
  },
);

// ============================================================
// DELETE /:id — удаление роли
// ============================================================
router.delete(
  '/:id',
  requireRole('admin'),
  requireMfa,
  async (req, res, next) => {
    try {
      const role = await prisma.customRole.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { profiles: true } } },
      });
      if (!role) throw new AppError('NOT_FOUND', 404);
      if (role._count.profiles > 0) {
        throw new AppError('STATE_CONFLICT', 409, {
          reason: `Роль назначена ${role._count.profiles} пользователям`,
        });
      }

      await prisma.customRole.delete({ where: { id: req.params.id } });

      void SecurityService.log({
        eventType: 'permissions_changed',
        severity: 'warning',
        userId: req.auth!.profileId,
        email: req.auth!.email,
        ip: req.ip ?? null,
        userAgent: (req.headers['user-agent'] as string) ?? null,
        details: {
          kind: 'custom_role_deleted',
          roleId: role.id,
          code: role.code,
        },
      });

      return noContent(res);
    } catch (e) { next(e); }
  },
);

// ============================================================
// POST /:id/assign/:userId — назначить роль
// ============================================================
router.post(
  '/:id/assign/:userId',
  requireRole('admin'),
  requireMfa,
  async (req, res, next) => {
    try {
      const role = await prisma.customRole.findUnique({
        where: { id: req.params.id },
      });
      if (!role || !role.active) {
        throw new AppError('NOT_FOUND', 404, {
          reason: 'Роль не найдена или отключена',
        });
      }

      const target = await prisma.profile.findUnique({
        where: { id: req.params.userId },
        select: { id: true, email: true, role: true, customRoleId: true },
      });
      if (!target) throw new AppError('NOT_FOUND', 404);

      // ── Проверяем, что permissions роли совместимы с базовой
      //    ролью пользователя. Иначе manager с base role `nam`
      //    получит admin-права.
      assertPermissionsAllowedForBase(
        target.role as 'admin' | 'manager' | 'nam',
        role.permissions,
      );

      const updated = await prisma.profile.update({
        where: { id: target.id },
        data: { customRoleId: role.id },
      });

      void SecurityService.log({
        eventType: 'permissions_changed',
        severity: 'warning',
        userId: req.auth!.profileId,
        email: req.auth!.email,
        ip: req.ip ?? null,
        userAgent: (req.headers['user-agent'] as string) ?? null,
        details: {
          kind: 'custom_role_assigned',
          roleId: role.id,
          roleCode: role.code,
          targetUserId: target.id,
          targetEmail: target.email,
          previousRoleId: target.customRoleId,
        },
      });

      return ok(res, updated);
    } catch (e) { next(e); }
  },
);

// ============================================================
// DELETE /:id/assign/:userId — снять роль
// ============================================================
router.delete(
  '/:id/assign/:userId',
  requireRole('admin'),
  requireMfa,
  async (req, res, next) => {
    try {
      const target = await prisma.profile.findUnique({
        where: { id: req.params.userId },
        select: { id: true, email: true, customRoleId: true },
      });
      if (!target) throw new AppError('NOT_FOUND', 404);
      if (!target.customRoleId) return noContent(res);

      await prisma.profile.update({
        where: { id: target.id },
        data: { customRoleId: null },
      });

      void SecurityService.log({
        eventType: 'permissions_changed',
        severity: 'info',
        userId: req.auth!.profileId,
        email: req.auth!.email,
        ip: req.ip ?? null,
        userAgent: (req.headers['user-agent'] as string) ?? null,
        details: {
          kind: 'custom_role_revoked',
          targetUserId: target.id,
          targetEmail: target.email,
          previousRoleId: target.customRoleId,
        },
      });

      return noContent(res);
    } catch (e) { next(e); }
  },
);

export default router;