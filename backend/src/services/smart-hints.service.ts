import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { PushService } from './push.service.js';

interface Hint {
  rule: string;
  userId: string | null;
  title: string;
  body: string;
  entity: string;
  entityId: string;
  actionUrl: string;
  severity: 'info' | 'warning' | 'critical';
}

export class SmartHintsService {
  static async run(): Promise<{ created: number }> {
    const hints: Hint[] = [];

    hints.push(...(await this.hintNoTouch()));
    hints.push(...(await this.hintLicenseExpiring()));
    hints.push(...(await this.hintStuckInStatus()));
    hints.push(...(await this.hintOverdueTasks()));
    hints.push(...(await this.hintLostRevenue()));

    if (hints.length === 0) return { created: 0 };

    // In-app уведомления (userId может быть null после миграции)
    for (const h of hints) {
      await prisma.notification
        .create({
          data: {
            userId: h.userId,
            type: 'smart_hint',
            title: h.title,
            body: h.body,
            entity: h.entity,
            entityId: h.entityId,
            actionUrl: h.actionUrl,
          },
        })
        .catch(() => {});
    }

    // Push только на критичные
    const critical = hints.filter((h) => h.severity === 'critical');
    for (const h of critical) {
      await PushService.send(h.userId, {
        title: h.title,
        body: h.body,
        url: h.actionUrl,
        tag: `hint-${h.rule}-${h.entityId}`,
      }).catch(() => {});
    }

    logger.info(
      { created: hints.length, critical: critical.length },
      'Smart hints created',
    );
    return { created: hints.length };
  }

  // ============================================================
  // Правило 1: не касались 30 дней
  // ============================================================
  private static async hintNoTouch(): Promise<Hint[]> {
    const cutoff = new Date(Date.now() - 30 * 86400000);

    const unis = await prisma.university.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['Партнёр', 'Отказ'] },
        OR: [
          { interactions: { none: { deletedAt: null, interactionDate: { gte: cutoff } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        managerId: true,
        manager: true,
      },
      take: 100,
    });

    // managerId → Manager.profileId → userId
    const managerIds = unis.map((u) => u.managerId).filter((x): x is string => !!x);
    const managers = managerIds.length
      ? await prisma.manager.findMany({
          where: { id: { in: managerIds } },
          select: { id: true, profileId: true },
        })
      : [];
    const managerToProfile = new Map(managers.map((m) => [m.id, m.profileId]));

    return unis.map((u) => ({
      rule: 'no_touch_30d',
      userId: u.managerId ? managerToProfile.get(u.managerId) ?? null : null,
      title: `Не касались «${u.name}» 30 дней`,
      body: 'Пора связаться с вузом',
      entity: 'universities',
      entityId: u.id,
      actionUrl: `/universities/${u.id}`,
      severity: 'warning' as const,
    }));
  }

  // ============================================================
  // Правило 2: лицензия истекает через 30 дней
  // ============================================================
  private static async hintLicenseExpiring(): Promise<Hint[]> {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 86400000);

    const unis = await prisma.university.findMany({
      where: {
        deletedAt: null,
        licenseSigned: true,
        licenseExpiresAt: { gte: now, lte: soon },
      },
      select: {
        id: true,
        name: true,
        managerId: true,
        licenseExpiresAt: true,
      },
      take: 100,
    });

    const managerIds = unis.map((u) => u.managerId).filter((x): x is string => !!x);
    const managers = managerIds.length
      ? await prisma.manager.findMany({
          where: { id: { in: managerIds } },
          select: { id: true, profileId: true },
        })
      : [];
    const managerToProfile = new Map(managers.map((m) => [m.id, m.profileId]));

    return unis.map((u) => ({
      rule: 'license_expiring',
      userId: u.managerId ? managerToProfile.get(u.managerId) ?? null : null,
      title: `Лицензия «${u.name}» истекает`,
      body: `Дата: ${u.licenseExpiresAt?.toISOString().slice(0, 10) ?? '—'}`,
      entity: 'universities',
      entityId: u.id,
      actionUrl: `/universities/${u.id}`,
      severity: 'critical' as const,
    }));
  }

  // ============================================================
  // Правило 3: застрял в статусе > 60 дней
  // ============================================================
  private static async hintStuckInStatus(): Promise<Hint[]> {
    const cutoff = new Date(Date.now() - 60 * 86400000);

    const unis = await prisma.university.findMany({
      where: {
        deletedAt: null,
        status: { in: ['Переговоры', 'Обучение'] },
        updatedAt: { lt: cutoff },
      },
      select: {
        id: true,
        name: true,
        status: true,
        managerId: true,
        updatedAt: true,
      },
      take: 100,
    });

    const managerIds = unis.map((u) => u.managerId).filter((x): x is string => !!x);
    const managers = managerIds.length
      ? await prisma.manager.findMany({
          where: { id: { in: managerIds } },
          select: { id: true, profileId: true },
        })
      : [];
    const managerToProfile = new Map(managers.map((m) => [m.id, m.profileId]));

    return unis.map((u) => ({
      rule: 'stuck_in_status',
      userId: u.managerId ? managerToProfile.get(u.managerId) ?? null : null,
      title: `«${u.name}» в статусе «${u.status}» > 60 дней`,
      body: 'Возможно, сделка застряла',
      entity: 'universities',
      entityId: u.id,
      actionUrl: `/universities/${u.id}`,
      severity: 'warning' as const,
    }));
  }

  // ============================================================
  // Правило 4: просроченные задачи
  // ============================================================
  private static async hintOverdueTasks(): Promise<Hint[]> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const tasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['Готово', 'Отменено'] },
        dueDate: { lt: yesterday },
      },
      select: {
        id: true,
        title: true,
        assignee: true,
        dueDate: true,
      },
      take: 100,
    });

    // assignee — это fullName менеджера, ищем через Manager
    const names = [...new Set(tasks.map((t) => t.assignee))].filter(Boolean);
    const managers = names.length
      ? await prisma.manager.findMany({
          where: { fullName: { in: names } },
          select: { fullName: true, profileId: true },
        })
      : [];
    const nameToProfile = new Map(managers.map((m) => [m.fullName, m.profileId]));

    return tasks.map((t) => ({
      rule: 'overdue_task',
      userId: nameToProfile.get(t.assignee) ?? null,
      title: `Просрочена: ${t.title}`,
      body: `Срок: ${t.dueDate.toISOString().slice(0, 10)}`,
      entity: 'tasks',
      entityId: t.id,
      actionUrl: '/tasks',
      severity: 'warning' as const,
    }));
  }

  // ============================================================
  // Правило 5: риск потери выручки
  // ============================================================
  private static async hintLostRevenue(): Promise<Hint[]> {
    const cutoff = new Date(Date.now() - 90 * 86400000);

    const unis = await prisma.university.findMany({
      where: {
        deletedAt: null,
        status: { in: ['Переговоры', 'Обучение', 'Внедрение'] },
        contractValue: { gt: 100_000 },
        OR: [
          { interactions: { none: { deletedAt: null, interactionDate: { gte: cutoff } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        managerId: true,
        contractValue: true,
      },
      take: 20,
    });

    const managerIds = unis.map((u) => u.managerId).filter((x): x is string => !!x);
    const managers = managerIds.length
      ? await prisma.manager.findMany({
          where: { id: { in: managerIds } },
          select: { id: true, profileId: true },
        })
      : [];
    const managerToProfile = new Map(managers.map((m) => [m.id, m.profileId]));

    return unis.map((u) => ({
      rule: 'lost_revenue_risk',
      userId: u.managerId ? managerToProfile.get(u.managerId) ?? null : null,
      title: `Риск потери «${u.name}»`,
      body: `Потенциал ${Number(u.contractValue).toLocaleString('ru-RU')} ₽. Нет активности 90 дней.`,
      entity: 'universities',
      entityId: u.id,
      actionUrl: `/universities/${u.id}`,
      severity: 'critical' as const,
    }));
  }
}