// backend/src/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { env } from '../config/env.js';
import { AppError } from '../errors/codes.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { getAuditContext } from '../db/audit-context.js';
import { SessionService } from '../services/session.service.js';

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'nam';
  profileId: string | null;
  blocked: boolean;
  scopes: Record<string, Record<string, unknown>>;
  /** Плоский список permissions, накопленный из customRole */
  permissions: string[];
  /** id кастомной роли (если назначена и активна), иначе null */
  customRoleId: string | null;
  /**
   * 2FA-подтверждение (по claim amr из JWT).
   * true, если в токене есть amr с 'otp', 'mfa' или 'webauthn'.
   * Используется middleware requireMfa для admin/manager.
   */
  mfa: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

const JWKS_URL = `${env.KEYCLOAK_URL}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/certs`;
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(JWKS_URL));
  return jwks;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

async function loadScopes(
  profileId: string,
): Promise<Record<string, Record<string, unknown>>> {
  try {
    const rows = await prisma.userScope.findMany({
      where: { userId: profileId },
      select: { entity: true, filter: true },
    });
    const out: Record<string, Record<string, unknown>> = {};
    for (const r of rows) {
      out[r.entity] = (r.filter ?? {}) as Record<string, unknown>;
    }
    return out;
  } catch (e) {
    logger.warn({ err: e, profileId }, 'loadScopes failed');
    return {};
  }
}

/**
 * Загрузить permissions из кастомной роли профиля.
 * Возвращает пустой массив, если:
 *  - customRoleId не задан,
 *  - роль не найдена,
 *  - роль отключена (active = false).
 *
 * Ошибки чтения из БД не падают выше — аутентификация продолжается
 * с пустым списком permissions (безопасный default: минимум прав).
 */
async function loadPermissions(
  customRoleId: string | null | undefined,
): Promise<{ permissions: string[]; customRoleId: string | null }> {
  if (!customRoleId) return { permissions: [], customRoleId: null };

  try {
    const role = await prisma.customRole.findUnique({
      where: { id: customRoleId },
      select: { permissions: true, active: true },
    });

    if (!role || !role.active) {
      return { permissions: [], customRoleId: null };
    }

    // На случай, если permissions в схеме хранится как Json —
    // приводим к массиву строк без падения.
    const list = Array.isArray(role.permissions)
      ? role.permissions.filter((p): p is string => typeof p === 'string')
      : [];

    return { permissions: list, customRoleId };
  } catch (e) {
    logger.warn({ err: e, customRoleId }, 'loadPermissions failed');
    return { permissions: [], customRoleId: null };
  }
}

async function testBypass(req: Request): Promise<AuthUser | null> {
  if (process.env.TEST_BYPASS_AUTH !== 'true') return null;
  const id = req.headers['x-test-user-id'];
  if (typeof id !== 'string' || !id) return null;

  const profile = await prisma.profile.findUnique({ where: { id } });
  if (!profile) return null;

  const scopes = await loadScopes(profile.id);
  const { permissions, customRoleId } = await loadPermissions(
    profile.customRoleId ?? null,
  );

  return {
    sub: profile.keycloakSub ?? profile.id,
    email: profile.email,
    name: profile.fullName,
    role: profile.role as AuthUser['role'],
    profileId: profile.id,
    blocked: profile.blocked,
    scopes,
    permissions,
    customRoleId,
    mfa: true, // тестовый bypass — 2FA считаем пройденной
  };
}

/**
 * Извлечь роли из Keycloak-токена.
 * Поддерживает realm_access.roles и resource_access.<client>.roles.
 */
function extractRoles(payload: JWTPayload): string[] {
  const roles = new Set<string>();

  const realmAccess = payload.realm_access as { roles?: string[] } | undefined;
  if (realmAccess?.roles) {
    for (const r of realmAccess.roles) roles.add(r);
  }

  const resourceAccess = payload.resource_access as
    | Record<string, { roles?: string[] }>
    | undefined;
  if (resourceAccess) {
    for (const client of Object.values(resourceAccess)) {
      if (client?.roles) {
        for (const r of client.roles) roles.add(r);
      }
    }
  }

  return Array.from(roles);
}

/**
 * Извлечь признаки многофакторной аутентификации из токена.
 *
 * Keycloak кладёт в claim `amr` (Authentication Method Reference)
 * список методов, которые прошёл пользователь:
 *   - "pwd"   — пароль;
 *   - "otp"   — TOTP (Google Authenticator);
 *   - "mfa"   — составной MFA;
 *   - "webauthn" — аппаратный ключ.
 *
 * Считаем, что 2FA пройдена, если в amr есть любой из otp/mfa/webauthn.
 */
function extractMfa(payload: JWTPayload): boolean {
  const amr = (payload as { amr?: unknown }).amr;
  if (!Array.isArray(amr)) return false;
  return amr.some((m) =>
    ['otp', 'mfa', 'webauthn'].includes(String(m)),
  );
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const bypass = await testBypass(req);
    if (bypass) {
      req.auth = bypass;
      const ctx = getAuditContext();
      if (ctx) {
        ctx.userId = bypass.profileId;
        ctx.userEmail = bypass.email;
      }
      return next();
    }

    const token = extractToken(req);
    if (!token) throw new AppError('NO_TOKEN', 401);

    let payload: JWTPayload;
    try {
      const result = await jwtVerify(token, getJwks(), {
        issuer: env.JWT_ISSUER,
      });
      payload = result.payload;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('expired')) throw new AppError('TOKEN_EXPIRED', 401);
      logger.warn({ err: e }, 'JWT verification failed');
      throw new AppError('TOKEN_INVALID', 401);
    }

    const sub = String(payload.sub ?? '');
    const emailRaw = String(payload.email ?? '').trim();
    const email = emailRaw ? emailRaw.toLowerCase() : '';
    if (!sub) throw new AppError('TOKEN_INVALID', 401);

    // Приоритет: keycloakSub > id > email
    let profile = await prisma.profile.findFirst({
      where: { keycloakSub: sub },
    });

    if (!profile) {
      profile = await prisma.profile.findFirst({ where: { id: sub } });
    }

    if (!profile && email) {
      profile = await prisma.profile.findFirst({ where: { email } });
    }

    if (!profile) {
      const tokenRoles = extractRoles(payload);
      let role: 'admin' | 'manager' | 'nam' = 'nam';
      if (tokenRoles.includes('admin')) role = 'admin';
      else if (tokenRoles.includes('manager')) role = 'manager';

      const fullName = String(
        payload.name ?? payload.preferred_username ?? email ?? 'Пользователь',
      );

      logger.info({ sub, email, role }, 'Создаём профиль при первом входе');

      profile = await prisma.profile.create({
        data: {
          id: sub,
          email: email || `${sub}@unknown.local`,
          fullName,
          role,
          keycloakSub: sub,
        },
      });
    } else {
      let canSetSub = !profile.keycloakSub;
      if (canSetSub) {
        const occupied = await prisma.profile.findFirst({
          where: { keycloakSub: sub, id: { not: profile.id } },
          select: { id: true },
        });
        if (occupied) {
          logger.warn(
            { profileId: profile.id, sub, occupiedBy: occupied.id },
            'keycloakSub уже занят другим профилем — пропускаем обновление',
          );
          canSetSub = false;
        }
      }

      await prisma.profile
        .update({
          where: { id: profile.id },
          data: {
            ...(canSetSub ? { keycloakSub: sub } : {}),
            lastLoginAt: new Date(),
          },
        })
        .catch((e) => {
          logger.warn({ err: e, profileId: profile!.id }, 'Не удалось обновить профиль');
        });
    }

    if (profile.blocked) throw new AppError('BLOCKED_USER', 403);

    const scopes = await loadScopes(profile.id);
    const { permissions, customRoleId } = await loadPermissions(
      profile.customRoleId ?? null,
    );

    req.auth = {
      sub,
      email: profile.email,
      name: profile.fullName,
      role: profile.role as AuthUser['role'],
      profileId: profile.id,
      blocked: profile.blocked,
      scopes,
      permissions,
      customRoleId,
      mfa: extractMfa(payload),
    };

    const ctx = getAuditContext();
    if (ctx) {
      ctx.userId = profile.id;
      ctx.userEmail = profile.email;
    }

    // ── Управление сессией: ensureAndTouch проверяет idle/absolute
    //    timeout и обновляет lastActiveAt (троттлинг 60 сек).
    //    Fire-and-forget — не блокируем запрос.
    void SessionService.ensureAndTouch({
      userId: profile.id,
      token,
      ctx: {
        ip: req.ip ?? null,
        userAgent: (req.headers['user-agent'] as string) ?? null,
      },
    });

    next();
  } catch (e) {
    next(e);
  }
}

export function requireRole(...roles: Array<'admin' | 'manager' | 'nam'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new AppError('UNAUTHORIZED', 401));
    if (!roles.includes(req.auth.role)) return next(new AppError('ROLE_NOT_ALLOWED', 403));
    next();
  };
}
/**
 * Базовые permissions по роли, если у пользователя НЕ назначена
 * кастомная роль. Роль `admin` не перечисляем — она проходит
 * отдельной веткой как «всё разрешено».
 *
 * Используется как fallback в requirePermission: сначала смотрим
 * явные permissions из customRole, потом — defaults по базовой роли.
 */
const ROLE_DEFAULT_PERMISSIONS: Record<'manager' | 'nam', string[]> = {
  manager: [
    // Вузы
    //
    // ВАЖНО (ТЗ п.4.11): manager НЕ удаляет вузы по умолчанию.
    // По ТЗ его роль — «работа с допустимыми данными» +
    // «изменять ответственных за вузы (менять, удалять, назначать)».
    // Удаление вуза — привилегия администратора.
    // Если руководителю действительно нужно удалять — админ
    // выдаст ему кастомную роль с 'universities.delete'.
    'universities.create', 'universities.update',
    'universities.import', 'universities.export', 'universities.transfer',
    'universities.comment',
    // Договоры
    'contracts.create', 'contracts.update', 'contracts.delete',
    'contracts.approve', 'contracts.sign',
    // Аналитика
    'analytics.view', 'analytics.export',
    // Каталоги и интеграции
    'catalogs.manage', 'integrations.manage',
    // Безопасность / аудит
    'security.view', 'security.ip_whitelist', 'audit.view',
  ],
  nam: [
    'universities.create', 'universities.update', 'universities.comment',
    'analytics.view',
  ],
};
/**
 * Проверка конкретного permission.
 *
 * Логика:
 * - admin — всегда разрешено;
 * - если задана кастомная роль — проверяется её permissions;
 * - иначе — проверяется по базовой роли (manager / nam).
 *
 * Проверка совместима с `requireRole`: если у пользователя нет
 * `customRoleId`, но есть `permissions: []`, то middleware примет
 * решение только по `role`.
 */
export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = req.auth;
    if (!auth) return next(new AppError('UNAUTHORIZED', 401));
    if (auth.role === 'admin') return next();

    // 1. Явные permissions из customRole (если назначена)
    if (auth.permissions.includes(permission)) return next();

    // 2. Fallback на дефолты по базовой роли
    const defaults = ROLE_DEFAULT_PERMISSIONS[auth.role as 'manager' | 'nam'] ?? [];
    if (defaults.includes(permission)) return next();

    return next(new AppError('ROLE_NOT_ALLOWED', 403, { permission }));
  };
}

export function requireManagerRole(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(new AppError('UNAUTHORIZED', 401));
  if (req.auth.role !== 'admin' && req.auth.role !== 'manager') {
    return next(new AppError('CANNOT_ASSIGN_MANAGER', 403));
  }
  next();
}

export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = extractToken(req);
  if (!token) return next();
  await authenticate(req, res, next);
}

/**
 * Разграничение доступа по данным.
 *
 * ВАЖНО: для роли nam используем managerId → Manager.profileId как
 * приоритетный способ привязки (по ТЗ п.4.11). Fallback на manager по
 * fullName — для совместимости со старыми записями и seed-данными.
 *
 * Это устраняет баг, когда менеджер меняет имя в Keycloak и теряет
 * доступ к своим вузам.
 *
 * Для manager по умолчанию возвращается пустой объект — он видит
 * всю воронку. Ограничение по владению применяется точечно в
 * сервисном слое (update / softDelete / bulk), см. ТЗ п.4.11.
 */
export function buildScopeWhere(
  auth: AuthUser,
  entity: string,
): Record<string, unknown> {
  const explicit = (auth.scopes ?? {})[entity];
  if (explicit && Object.keys(explicit).length > 0) {
    return { ...explicit };
  }

  if (auth.role === 'nam') {
    if (entity === 'universities' || entity === 'interactions') {
      const or: Record<string, unknown>[] = [];

      if (auth.profileId) {
        or.push({ managerRef: { profileId: auth.profileId } });
      }
      if (auth.name) {
        or.push({ manager: auth.name });
      }

      if (or.length === 0) return { id: { in: [] } };
      if (or.length === 1) return or[0];
      return { OR: or };
    }

    if (entity === 'tasks') {
      if (!auth.name) return { id: { in: [] } };
      return { assignee: auth.name };
    }
  }

  return {};
}

/**
 * Требует, чтобы пользователь прошёл 2FA.
 *
 * По ФСТЭК №117 для УЗ-2 многофакторная аутентификация обязательна
 * для администраторов и менеджеров, имеющих доступ к ПД и
 * конфигурации системы.
 *
 * Применяется на:
 *  - /security/ip-whitelist (CRUD);
 *  - /security/events (чтение);
 *  - /users (CRUD);
 *  - /custom-roles (CRUD);
 *  - /integrations (CRUD);
 *  - /backup;
 *  - /settings/*;
 *  - /universities/import, /universities/bulk.
 *
 * Возвращает 403 с кодом CRM-403-007 (MFA_REQUIRED), чтобы фронт
 * показал баннер «Настройте 2FA».
 */
export function requireMfa(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.auth) return next(new AppError('UNAUTHORIZED', 401));
  if (req.auth.role !== 'admin' && req.auth.role !== 'manager') {
    // Для nam — 2FA не обязательна
    return next();
  }
  if (!req.auth.mfa) {
    return next(new AppError('MFA_REQUIRED', 403));
  }
  next();
}

/**
 * Требует роль admin. Используется там, где manager не должен
 * иметь доступ даже при наличии permission (смена ролей других
 * пользователей, изменение custom roles).
 */
export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.auth) return next(new AppError('UNAUTHORIZED', 401));
  if (req.auth.role !== 'admin') {
    return next(new AppError('ROLE_NOT_ALLOWED', 403, { requireAdmin: true }));
  }
  next();
}