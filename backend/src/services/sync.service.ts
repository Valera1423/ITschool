// backend/src/services/sync.service.ts
import { prisma } from '../db/prisma.js';
import { KeycloakService } from './keycloak.service.js';
import { logger } from '../config/logger.js';

interface KcUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  attributes?: Record<string, string[]>;
  realmRoles?: string[];
}

const PAGE_SIZE = 100;
const MAX_PAGES = 200;

export class SyncService {
  // ------------------------------------------------------------
  // Синхронизация всех пользователей с пагинацией
  // ------------------------------------------------------------
  static async syncAllUsers(): Promise<{
    created: number;
    updated: number;
    blocked: number;
    total: number;
  }> {
    logger.info('🔄 Синхронизация пользователей с Keycloak...');

    const all = await this.fetchAllKeycloakUsers();
    let created = 0;
    let updated = 0;
    let blocked = 0;

    for (const kc of all) {
      const result = await this.upsertOne(kc);
      if (result === 'created') created++;
      else if (result === 'updated') updated++;
      if (!kc.enabled) blocked++;
    }

    const kcIds = new Set(all.map((u) => u.id));
    const orphans = await prisma.profile.findMany({
      where: { keycloakSub: { not: null }, blocked: false },
      select: { id: true, keycloakSub: true, email: true },
    });

    let blockedOrphans = 0;
    for (const p of orphans) {
      if (p.keycloakSub && !kcIds.has(p.keycloakSub)) {
        await prisma.profile.update({
          where: { id: p.id },
          data: { blocked: true },
        });
        blockedOrphans++;
        logger.warn({ email: p.email }, 'Пользователь удалён из Keycloak → blocked в CRM');
      }
    }

    logger.info(
      { created, updated, blocked, blockedOrphans, total: all.length },
      '✓ Синхронизация завершена',
    );
    return { created, updated, blocked, total: all.length };
  }

  private static async fetchAllKeycloakUsers(): Promise<KcUser[]> {
    const acc: KcUser[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await KeycloakService.listUsers(page * PAGE_SIZE, PAGE_SIZE);
      if (batch.length === 0) break;
      acc.push(...(batch as KcUser[]));
      if (batch.length < PAGE_SIZE) break;
    }
    return acc;
  }

  // ------------------------------------------------------------
  // Upsert одного пользователя
  //
  // ВАЖНО: после успешного upsert Profile — синхронизируем Manager.profileId
  // для ролей nam/manager. Это нужно, чтобы scope-фильтр по managerId
  // работал (см. buildScopeWhere в middleware/auth.ts, ТЗ п.4.11).
  // ------------------------------------------------------------
  private static async upsertOne(
    kc: KcUser,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const email = String(kc.email ?? '').toLowerCase();
    if (!email) return 'skipped';

    const kcSub = String(kc.id ?? '');
    const fullName = String(
      kc.attributes?.fullName?.[0] ??
        (`${kc.firstName ?? ''} ${kc.lastName ?? ''}`.trim() || email.split('@')[0]),
    );
    const blocked = !kc.enabled;

    const realmRoles = kc.realmRoles ?? [];
    let role: 'admin' | 'manager' | 'nam' = 'nam';
    if (realmRoles.includes('admin')) role = 'admin';
    else if (realmRoles.includes('manager')) role = 'manager';
    else if (realmRoles.includes('nam')) role = 'nam';

    const existing = await prisma.profile.findFirst({
      where: { OR: [{ keycloakSub: kcSub }, { email }] },
    });

    let finalProfileId: string;
    let result: 'created' | 'updated' | 'skipped' = 'skipped';

    if (existing) {
      const needsUpdate =
        existing.email !== email ||
        existing.fullName !== fullName ||
        existing.role !== role ||
        existing.blocked !== blocked ||
        existing.keycloakSub !== kcSub;

      if (needsUpdate) {
        await prisma.profile.update({
          where: { id: existing.id },
          data: { email, fullName, role, blocked, keycloakSub: kcSub },
        });
        result = 'updated';
      }
      finalProfileId = existing.id;
    } else {
      try {
        const created = await prisma.profile.create({
          data: {
            id: kcSub,
            email,
            fullName,
            role,
            blocked,
            keycloakSub: kcSub,
          },
        });
        finalProfileId = created.id;
      } catch (e: unknown) {
        const code = (e as { code?: string }).code;
        if (code === 'P2002') {
          const created = await prisma.profile.create({
            data: { email, fullName, role, blocked, keycloakSub: kcSub },
          });
          finalProfileId = created.id;
        } else {
          throw e;
        }
      }
      result = 'created';
    }

    // Связь Manager ↔ Profile для ролей nam/manager
    if (role === 'nam' || role === 'manager') {
      try {
        const updated = await prisma.manager.updateMany({
          where: { fullName, profileId: null },
          data: { profileId: finalProfileId },
        });
        if (updated.count > 0) {
          logger.info(
            { fullName, profileId: finalProfileId, count: updated.count },
            'Manager.profileId связан с профилем',
          );
        }
      } catch (e) {
        logger.warn({ err: e, fullName }, 'Не удалось связать Manager с Profile');
      }
    }

    return result;
  }

  // ------------------------------------------------------------
  // Синхронизация одного (после создания через API)
  // ------------------------------------------------------------
  static async syncOne(kcSub: string) {
    const kc = await KeycloakService.listUsers(0, 500);
    const found = (kc as KcUser[]).find((u) => u.id === kcSub);
    if (!found) return null;

    await this.upsertOne(found);

    return prisma.profile.findFirst({
      where: { OR: [{ id: kcSub }, { keycloakSub: kcSub }] },
    });
  }
}