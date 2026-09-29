import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';

interface Condition {
  field: string;
  operator: string;
  value?: unknown;
}

interface Action {
  type: string;
  params: Record<string, unknown>;
}

interface RuleContext {
  entity: string;
  entityId: string;
  data: Record<string, unknown>;
  previous?: Record<string, unknown>;
  actor?: string;
}

export class AutomationService {
  /**
   * Запустить все правила, подходящие под триггер.
   * Вызывается из сервисов-источников (universities.service и т.д.).
   */
  static async fire(
    triggerType: 'on_create' | 'on_update' | 'on_field_change',
    ctx: RuleContext,
  ): Promise<void> {
    try {
      const rules = await prisma.automationRule.findMany({
        where: {
          enabled: true,
          deletedAt: null,
          entity: ctx.entity,
          triggerType,
        },
      });

      for (const rule of rules) {
        // Проверяем trigger_config (для on_field_change)
        if (triggerType === 'on_field_change') {
          const cfg = rule.triggerConfig as { field?: string; to?: unknown };
          if (cfg.field && ctx.data[cfg.field] !== cfg.to) continue;
          // Проверяем, что поле реально изменилось
          if (ctx.previous && cfg.field && ctx.previous[cfg.field] === ctx.data[cfg.field]) continue;
        }

        const conditions = (rule.conditions ?? []) as Condition[];
        if (!this.checkConditions(conditions, ctx.data)) continue;

        await this.runRule(rule.id, ctx);
      }
    } catch (e) {
      logger.error({ err: e, triggerType, entityId: ctx.entityId }, 'AutomationService.fire error');
    }
  }

  /**
   * Ручной или cron-запуск конкретного правила.
   */
  static async runRule(ruleId: string, ctx: RuleContext): Promise<void> {
    const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
    if (!rule) return;

    const actions = (rule.actions ?? []) as Action[];
    const results: unknown[] = [];
    let success = true;
    let lastError: string | null = null;

    for (const action of actions) {
      try {
        const result = await this.executeAction(action, ctx);
        results.push({ type: action.type, ok: true, result });
      } catch (e) {
        success = false;
        lastError = e instanceof Error ? e.message : 'unknown';
        results.push({ type: action.type, ok: false, error: lastError });
        logger.error({ err: e, ruleId, actionType: action.type }, 'Ошибка действия');
      }
    }

    await prisma.automationRun.create({
      data: {
        ruleId,
        entityId: ctx.entityId,
        triggerPayload: ctx as never,
        actionsResult: results as never,
        success,
        error: lastError,
      },
    });

    await prisma.automationRule.update({
      where: { id: ruleId },
      data: {
        runCount: { increment: 1 },
        lastRunAt: new Date(),
        lastError,
      },
    });
  }

  // ============================================================
  // Условия
  // ============================================================
  private static checkConditions(conditions: Condition[], data: Record<string, unknown>): boolean {
    if (conditions.length === 0) return true;

    return conditions.every((c) => {
      const value = data[c.field];

      switch (c.operator) {
        case 'equals': return String(value) === String(c.value);
        case 'not_equals': return String(value) !== String(c.value);
        case 'contains':
          return String(value ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase());
        case 'not_contains':
          return !String(value ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase());
        case 'greater': return Number(value) > Number(c.value);
        case 'less': return Number(value) < Number(c.value);
        case 'empty': return value === null || value === undefined || value === '';
        case 'not_empty': return value !== null && value !== undefined && value !== '';
        case 'in':
          return Array.isArray(c.value) &&
            (c.value as unknown[]).map(String).includes(String(value));
        case 'not_in':
          return Array.isArray(c.value) &&
            !(c.value as unknown[]).map(String).includes(String(value));
        default: return true;
      }
    });
  }

  // ============================================================
  // Действия
  // ============================================================
  private static async executeAction(action: Action, ctx: RuleContext): Promise<unknown> {
    const p = action.params;

    switch (action.type) {
      case 'create_task': {
        const days = Number(p.due_days ?? 3);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + days);

        return prisma.task.create({
          data: {
            universityId: ctx.entity === 'universities' ? ctx.entityId : null,
            title: String(p.title ?? 'Задача из правила'),
            description: String(p.description ?? `Создано правилом автоматизации`),
            status: 'К выполнению',
            priority: String(p.priority ?? 'Средний'),
            dueDate,
            assignee: String(ctx.data.assignee ?? ctx.data.manager ?? 'Анна Кузнецова'),
          },
        });
      }

      case 'create_interaction': {
        return prisma.interaction.create({
          data: {
            university: { connect: { id: ctx.entityId } },
            type: String(p.type ?? 'Звонок'),
            title: String(p.title ?? 'Взаимодействие из правила'),
            details: String(p.description ?? ''),
            interactionDate: new Date(),
            status: 'Запланировано',
            manager: String(ctx.data.manager ?? 'Анна Кузнецова'),
          },
        });
      }

      case 'update_field': {
        const field = String(p.field ?? '');
        const value = p.value;
        if (!field) throw new Error('Не указано поле для обновления');

        // Только для universities
        if (ctx.entity === 'universities') {
          return prisma.university.update({
            where: { id: ctx.entityId },
            data: { [field]: value } as never,
          });
        }
        if (ctx.entity === 'tasks') {
          return prisma.task.update({
            where: { id: ctx.entityId },
            data: { [field]: value } as never,
          });
        }
        return null;
      }

      case 'send_notification': {
  return prisma.notification.create({
    data: {
      userId: null,        // системное уведомление
      type: 'automation',
      title: String(p.message ?? 'Уведомление от правила'),
      body: String(p.body ?? ''),
      entity: ctx.entity,
      entityId: ctx.entityId,
      actionUrl: String(p.action_url ?? '/'),
    },
  });
}

      case 'send_email': {
        const { InboxService } = await import('./inbox/inbox.service.js');
        const integration = await prisma.integration.findFirst({
          where: { type: 'email', status: 'Активна', deletedAt: null },
        });
        if (!integration) throw new Error('Нет активной email-интеграции');

        const to = String(ctx.data.contact_email ?? p.to ?? '');
        if (!to) throw new Error('Не указан получатель');

        return InboxService.send({
          integrationId: integration.id,
          to,
          subject: String(p.subject ?? 'CRM: уведомление'),
          body: String(p.body ?? ''),
          universityId: ctx.entity === 'universities' ? ctx.entityId : undefined,
          manager: ctx.actor,
          channel: 'email',
        });
      }

      case 'send_telegram': {
        const { InboxService } = await import('./inbox/inbox.service.js');
        const integration = await prisma.integration.findFirst({
          where: { type: 'telegram', status: 'Активна', deletedAt: null },
        });
        if (!integration) throw new Error('Нет активной telegram-интеграции');

        const cfg = integration.config as { chat_id?: string };
        const to = String(ctx.data.telegram ?? p.chat_id ?? cfg.chat_id ?? '');
        if (!to) throw new Error('Не указан чат');

        return InboxService.send({
          integrationId: integration.id,
          to,
          body: String(p.message ?? ''),
          channel: 'telegram',
        });
      }

      case 'add_tag': {
        const tagId = String(p.tag_id ?? '');
        if (!tagId || ctx.entity !== 'universities') return null;
        return prisma.universityTag.upsert({
          where: { universityId_tagId: { universityId: ctx.entityId, tagId } },
          update: {},
          create: { universityId: ctx.entityId, tagId },
        });
      }

      case 'remove_tag': {
        const tagId = String(p.tag_id ?? '');
        if (!tagId || ctx.entity !== 'universities') return null;
        return prisma.universityTag.deleteMany({
          where: { universityId: ctx.entityId, tagId },
        });
      }

      case 'assign_manager': {
        if (ctx.entity !== 'universities') return null;
        const managerName = String(p.manager ?? '');
        const manager = await prisma.manager.findFirst({ where: { fullName: managerName } });
        return prisma.university.update({
          where: { id: ctx.entityId },
          data: {
            manager: managerName,
            managerId: manager?.id ?? null,
          },
        });
      }

      default:
        throw new Error(`Неизвестное действие: ${action.type}`);
    }
  }
}