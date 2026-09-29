// backend/src/routes/auth.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { SessionService } from '../services/session.service.js';
import { ok, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';

const router = Router();

/**
 * Обновление собственного профиля.
 *
 * ВАЖНО (безопасность):
 * - `role` ЗАПРЕЩЕНО менять через этот эндпоинт — иначе любой
 *   пользователь может self-promote до admin. Роль меняется только
 *   администратором через `PATCH /users/:id/role`.
 * - `email` синхронизируется из Keycloak, локально менять не даём.
 * - `blocked` тоже здесь недоступен.
 */
const updateMeBody = z
  .object({
    fullName: z.string().min(1).max(200).optional(),
    phone: z.string().max(50).nullable().optional(),
    avatarColor: z.enum(['blue', 'green', 'orange', 'purple']).optional(),
    workspaceName: z.string().min(1).max(200).optional(),
    notificationsEnabled: z.boolean().optional(),
  })
  .strict(); // .strict() — отсекаем лишние поля (включая role), а не молча игнорируем

router.get('/health', (_req, res) => ok(res, { status: 'ok' }));

/**
 * GET /me — текущий пользователь.
 *
 * Возвращаем профиль + mfa-флаг.
 *
 * Источник данных о пользователе — req.auth (уже вычислен middleware
 * authenticate из JWT и БД). Это важно, потому что req.auth содержит
 * ещё и permissions из кастомной роли, и флаг mfa, извлечённый из
 * claim amr. Возвращать «голый» profile из prisma — недостаточно:
 * мы потеряем и permissions, и mfa.
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const auth = req.auth;
    if (!auth?.profileId) throw new AppError('UNAUTHORIZED', 401);

    const profile = await prisma.profile.findUnique({
      where: { id: auth.profileId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarColor: true,
        blocked: true,
        totpEnabled: true,
        keycloakSub: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        customRoleId: true,
      },
    });
    if (!profile) throw new AppError('NOT_FOUND', 404);

    const payload = {
      ...profile,
      mfa: auth.mfa ?? false,
      permissions: auth.permissions,
      customRoleId: auth.customRoleId,
    };

    return ok(res, payload);
  } catch (e) {
    next(e);
  }
});

router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const data = updateMeBody.parse(req.body);
    if (!req.auth?.profileId) throw new AppError('UNAUTHORIZED', 401);

    // 1. Обновление профиля (только разрешённые поля)
    const profilePatch: Record<string, unknown> = {};
    if (data.fullName !== undefined) profilePatch.fullName = data.fullName;
    if (data.avatarColor !== undefined) profilePatch.avatarColor = data.avatarColor;

    if (Object.keys(profilePatch).length > 0) {
      await prisma.profile.update({
        where: { id: req.auth.profileId },
        data: profilePatch,
      });
    }

    // 2. Обновление workspace-настроек (singleton-строка)
    const settingsPatch: Record<string, unknown> = {};
    if (data.fullName !== undefined) settingsPatch.fullName = data.fullName;
    if (data.workspaceName !== undefined) {
      settingsPatch.workspaceName = data.workspaceName;
    }
    if (data.phone !== undefined) settingsPatch.phone = data.phone;
    if (data.notificationsEnabled !== undefined) {
      settingsPatch.notificationsEnabled = data.notificationsEnabled;
    }

    if (Object.keys(settingsPatch).length > 0) {
      const existing = await prisma.profileSettings.findFirst();
      if (existing) {
        await prisma.profileSettings.update({
          where: { id: existing.id },
          data: settingsPatch,
        });
      } else {
        await prisma.profileSettings.create({
          data: {
            fullName: data.fullName ?? req.auth.name ?? 'Пользователь',
            email: req.auth.email ?? 'user@rt.ru',
            role: req.auth.role ?? 'nam',
            workspaceName: data.workspaceName ?? 'ИТ Школа РТК',
            phone: data.phone ?? null,
            notificationsEnabled: data.notificationsEnabled ?? true,
          },
        });
      }
    }

    const updated = await prisma.profile.findUnique({
      where: { id: req.auth.profileId },
    });

    return ok(res, updated);
  } catch (e) {
    next(e);
  }
});

// ============================================================
// POST /auth/sessions/rotate
//
// Клиент вызывает после успешного silent renew:
//   { oldToken, newToken }
//
// Сервер: revoke старой записи + создание новой с тем же IP/UA.
// ============================================================
const rotateBody = z.object({
  oldToken: z.string().min(20),
  newToken: z.string().min(20),
});

router.post('/sessions/rotate', authenticate, async (req, res, next) => {
  try {
    const data = rotateBody.parse(req.body);
    const userId = req.auth?.profileId;
    if (!userId) {
      throw new AppError('UNAUTHORIZED', 401);
    }

    await SessionService.rotate({
      oldToken: data.oldToken,
      newToken: data.newToken,
      userId,
      ctx: {
        ip: req.ip ?? null,
        userAgent: (req.headers['user-agent'] as string) ?? null,
      },
    });

    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// GET /auth/sessions/me
//
// Список активных сессий текущего пользователя (используется
// на странице «Безопасность»). Хеш токена НЕ отдаём.
// ============================================================
router.get('/sessions/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) throw new AppError('UNAUTHORIZED', 401);

    const items = await prisma.userSession.findMany({
      where: {
        userId,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        deviceLabel: true,
        lastActiveAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return ok(res, items);
  } catch (e) { next(e); }
});

export default router;