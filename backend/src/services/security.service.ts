// backend/src/services/security.service.ts
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';

export type SecurityEventType =
  | 'login'
  | 'logout'
  | 'failed_login'
  | 'password_changed'
  | 'password_reset'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'session_revoked'
  | 'ip_blocked'
  | 'rate_limit'
  | 'pd_export'
  | 'pd_forget'
  | 'blocked_user'
  | 'role_changed'
  | 'permissions_changed'
  | 'user_created'
  | 'user_deleted'
  | 'malware_detected'
  | 'webhook_signature_mismatch'
  | 'suspicious_bulk_attempt';

/**
 * Записать событие безопасности.
 *
 * Fire-and-forget: не падает выше, лог в консоль при ошибке БД.
 *
 * Использование:
 *   void SecurityService.log({
 *     eventType: 'role_changed',
 *     severity: 'warning',
 *     userId: auth.profileId,
 *     email: auth.email,
 *     details: { targetUserId, from: 'nam', to: 'manager' },
 *   });
 */
export class SecurityService {
  static async log(input: {
    eventType: SecurityEventType;
    severity?: 'info' | 'warning' | 'critical';
    userId?: string | null;
    email?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    details?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await prisma.securityEvent.create({
        data: {
          eventType: input.eventType,
          severity: input.severity ?? 'info',
          userId: input.userId ?? null,
          email: input.email ?? null,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          details: (input.details ?? {}) as never,
        },
      });
    } catch (e) {
      logger.warn(
        { err: e, eventType: input.eventType },
        '[security] log failed',
      );
    }
  }
}