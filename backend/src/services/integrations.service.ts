// backend/src/services/integrations.service.ts
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { AppError } from '../errors/codes.js';

interface IntegrationConfig {
  endpoint?: string;
  api_key?: string;
  header_name?: string;
  method?: string;
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform: string;
  transformArg: string | null;
  required: boolean;
  defaultValue: string | null;
}

export interface SyncResult {
  endpointId: string;
  endpointName: string;
  status: 'success' | 'partial' | 'failed';
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  durationMs: number;
  error?: string;
  errors: { row: number; message: string }[];
}

export class IntegrationsService {
  static async syncIntegration(
    integrationId: string,
    trigger: 'manual' | 'cron' | 'webhook',
    actor: string,
  ): Promise<SyncResult[]> {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
      include: {
        endpoints: {
          where: { enabled: true },
          orderBy: { sortOrder: 'asc' },
          include: { mappings: true },
        },
      },
    });

    if (!integration) throw new AppError('NOT_FOUND', 404);
    if (integration.status !== 'Активна') {
      throw new AppError('STATE_CONFLICT', 409, { reason: 'Интеграция отключена' });
    }

    const results: SyncResult[] = [];
    for (const ep of integration.endpoints) {
      const r = await this.syncEndpoint(integration, ep, trigger, actor);
      results.push(r);
    }

    const total = results.reduce((s, r) => s + r.created + r.updated, 0);
    const anyFailed = results.some((r) => r.status === 'failed');
    const anyPartial = results.some((r) => r.status === 'partial');

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: anyFailed ? 'failed' : anyPartial ? 'partial' : 'success',
        lastSyncCount: total,
      },
    });

    return results;
  }

  private static async syncEndpoint(
    integration: { id: string; name: string; config: unknown },
    endpoint: {
      id: string;
      name: string;
      path: string;
      method: string;
      entity: string | null;
      mappings: unknown[];
    },
    trigger: 'manual' | 'cron' | 'webhook',
    actor: string,
  ): Promise<SyncResult> {
    const startedAt = Date.now();
    const config = (integration.config ?? {}) as IntegrationConfig;
    const baseUrl = (config.endpoint ?? '').replace(/\/$/, '');
    const url = `${baseUrl}${endpoint.path}`;

    const log = await prisma.integrationSyncLog.create({
      data: {
        integrationId: integration.id,
        endpointId: endpoint.id,
        trigger,
        status: 'running',
        actor,
        requestUrl: url,
      },
    });

    const errors: { row: number; message: string }[] = [];
    let fetched = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let responseSample: unknown = null;

    try {
      const response = await this.httpRequest(url, config, endpoint.method);
      responseSample = Array.isArray(response) ? response.slice(0, 3) : response;

      const rows = this.extractRows(response);
      fetched = rows.length;

      if (fetched === 0) {
        await prisma.integrationSyncLog.update({
          where: { id: log.id },
          data: {
            finishedAt: new Date(),
            durationMs: Date.now() - startedAt,
            status: 'success',
            recordsFetched: 0,
            responseSample: responseSample as never,
          },
        });
        return {
          endpointId: endpoint.id,
          endpointName: endpoint.name,
          status: 'success',
          fetched: 0, created: 0, updated: 0, skipped: 0, failed: 0,
          durationMs: Date.now() - startedAt,
          errors: [],
        };
      }

      for (let i = 0; i < rows.length; i++) {
        try {
          const mapped = this.applyMappings(
            rows[i] as Record<string, unknown>,
            endpoint.mappings as FieldMapping[],
          );

          if (!mapped.name) {
            skipped++;
            continue;
          }

          const existing = await prisma.university.findFirst({
            where: { name: mapped.name as string, deletedAt: null },
          });

          let targetUniId: string;

          if (existing) {
            await prisma.university.update({
              where: { id: existing.id },
              data: { ...mapped, updatedAt: new Date() } as never,
            });
            targetUniId = existing.id;
            updated++;
          } else {
            const newUni = await prisma.university.create({
              data: {
                ...mapped,
                source: `Импорт: ${integration.name}`,
              } as never,
            });
            created++;

            try {
              await this.attachToWorkflow(newUni.id);
            } catch (e) {
              logger.warn(
                { err: e, universityId: newUni.id },
                'Не удалось привязать вуз к workflow',
              );
            }
            targetUniId = newUni.id;
          }

          // ── Применяем правила интеграции к записи (автоматизация workflow)
          try {
            await this.applyRules({
              integrationId: integration.id,
              endpointId: endpoint.id,
              universityId: targetUniId,
              row: rows[i] as Record<string, unknown>,
            });
          } catch (e) {
            logger.warn(
              { err: e, integrationId: integration.id },
              'applyRules failed',
            );
          }
        } catch (e) {
          failed++;
          if (errors.length < 50) {
            errors.push({
              row: i,
              message: e instanceof Error ? e.message : 'unknown',
            });
          }
        }
      }

      const status: SyncResult['status'] =
        failed === 0 ? 'success' : created + updated > 0 ? 'partial' : 'failed';

      await prisma.integrationSyncLog.update({
        where: { id: log.id },
        data: {
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt,
          status,
          recordsFetched: fetched,
          recordsCreated: created,
          recordsUpdated: updated,
          recordsSkipped: skipped,
          recordsFailed: failed,
          errors: errors as never,
          responseSample: responseSample as never,
        },
      });

      return {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        status,
        fetched, created, updated, skipped, failed,
        durationMs: Date.now() - startedAt,
        errors,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown';
      logger.error({ err: e, endpoint: endpoint.name }, 'Ошибка синхронизации endpoint');

      await prisma.integrationSyncLog
        .update({
          where: { id: log.id },
          data: {
            finishedAt: new Date(),
            durationMs: Date.now() - startedAt,
            status: 'failed',
            errorMessage: message,
          },
        })
        .catch(() => {});

      return {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        status: 'failed',
        fetched: 0, created: 0, updated: 0, skipped: 0, failed: 0,
        durationMs: Date.now() - startedAt,
        error: message,
        errors: [],
      };
    }
  }

  private static async httpRequest(
    url: string,
    config: IntegrationConfig,
    method: string,
  ): Promise<unknown> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const apiKey = config.api_key ?? '';
    const headerName = config.header_name ?? 'Authorization';
    if (apiKey) {
      headers[headerName] = headerName === 'Authorization' ? `Bearer ${apiKey}` : apiKey;
    }

    const ctl = new AbortController();
    const timeout = setTimeout(() => ctl.abort(), 30_000);

    try {
      const res = await fetch(url, {
        method: method === 'POST' ? 'POST' : 'GET',
        headers,
        signal: ctl.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 500)}`);
      }

      const ct = res.headers.get('content-type') ?? '';
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Ожидался JSON, получен ${ct || 'unknown'}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private static extractRows(response: unknown): unknown[] {
    if (Array.isArray(response)) return response;
    if (typeof response === 'object' && response !== null) {
      const obj = response as Record<string, unknown>;
      for (const key of ['data', 'items', 'results', 'records', 'rows', 'list']) {
        if (Array.isArray(obj[key])) return obj[key] as unknown[];
      }
    }
    return [];
  }

  private static applyMappings(
    row: Record<string, unknown>,
    mappings: FieldMapping[],
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    for (const m of mappings) {
      let value = m.sourceField.includes('.')
        ? m.sourceField.split('.').reduce<unknown>((acc, key) => {
            if (acc && typeof acc === 'object') {
              return (acc as Record<string, unknown>)[key];
            }
            return undefined;
          }, row)
        : row[m.sourceField];

      if (value === undefined || value === null || value === '') {
        if (m.required) throw new Error(`Обязательное поле "${m.sourceField}" пусто`);
        if (m.defaultValue !== null) value = m.defaultValue;
        else {
          out[m.targetField] = null;
          continue;
        }
      }

      out[m.targetField] = this.transform(value, m.transform, m.transformArg);
    }

    return out;
  }

  private static transform(value: unknown, transform: string, arg: string | null): unknown {
    const s = String(value);
    switch (transform) {
      case 'number': {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      }
      case 'date': {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      }
      case 'boolean':
        return ['true', '1', 'yes', 'да', 'on'].includes(s.toLowerCase());
      case 'json':
        try {
          return JSON.parse(s);
        } catch {
          return null;
        }
      case 'lower':
        return s.toLowerCase();
      case 'upper':
        return s.toUpperCase();
      case 'trim':
        return s.trim();
      case 'concat':
        return arg ? `${s} ${arg}` : s;
      case 'split':
        return arg ? s.split(arg) : [s];
      default:
        return s;
    }
  }

  /**
   * Привязка вуза к дефолтному workflow.
   *
   * Раньше искали по жёсткому имени — но ТЗ п.Ф.9 разрешает
   * переименование workflow. Теперь используем флаг is_default.
   */
  private static async attachToWorkflow(universityId: string): Promise<void> {
    const workflow = await prisma.workflow.findFirst({
      where: { isDefault: true, deletedAt: null },
      include: { steps: { orderBy: { stepOrder: 'asc' }, take: 1 } },
    });
    if (!workflow) {
      logger.warn(
        { universityId },
        'Дефолтный workflow не найден — привязка вуза пропущена',
      );
      return;
    }

    const firstStep = workflow.steps[0];
    if (!firstStep) {
      logger.warn(
        { workflowId: workflow.id },
        'Workflow без шагов — привязка вуза пропущена',
      );
      return;
    }

    await prisma.workflowUniversity.upsert({
      where: {
        workflowId_universityId: { workflowId: workflow.id, universityId },
      },
      update: {},
      create: {
        workflow: { connect: { id: workflow.id } },
        university: { connect: { id: universityId } },
        currentStep: firstStep ? { connect: { id: firstStep.id } } : undefined,
        status: 'В работе',
      },
    });
  }

  static async listLogs(integrationId?: string, limit = 100) {
    return prisma.integrationSyncLog.findMany({
      where: integrationId ? { integrationId } : undefined,
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  static async testConnection(integrationId: string): Promise<{
    ok: boolean;
    latencyMs: number;
    status: number;
    sample?: unknown;
    error?: string;
  }> {
    const startedAt = Date.now();
    try {
      const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
      if (!integration) throw new AppError('NOT_FOUND', 404);

      const config = (integration.config ?? {}) as IntegrationConfig;
      const url = (config.endpoint ?? '').replace(/\/$/, '');
      if (!url) return { ok: false, latencyMs: 0, status: 0, error: 'Не задан endpoint' };

      const headers: Record<string, string> = { Accept: 'application/json' };
      const apiKey = config.api_key ?? '';
      const headerName = config.header_name ?? 'Authorization';
      if (apiKey) {
        headers[headerName] = headerName === 'Authorization' ? `Bearer ${apiKey}` : apiKey;
      }

      const ctl = new AbortController();
      const timeout = setTimeout(() => ctl.abort(), 10_000);

      try {
        const res = await fetch(url, { method: 'GET', headers, signal: ctl.signal });
        const latencyMs = Date.now() - startedAt;
        if (!res.ok) {
          return { ok: false, latencyMs, status: res.status, error: `HTTP ${res.status}` };
        }
        const sample = await res.json().catch(() => null);
        return { ok: true, latencyMs, status: res.status, sample };
      } finally {
        clearTimeout(timeout);
      }
    } catch (e) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        status: 0,
        error: e instanceof Error ? e.message : 'unknown',
      };
    }
  }

  // ============================================================
  // PREVIEW ENDPOINT — для UI редактора маппинга
  // ============================================================

  /**
   * Запрос первых N записей из внешнего API — для UI редактора
   * маппинга и проверки «что вообще отдаёт эндпоинт».
   *
   * Возвращает сырые строки + нормализованный список полей первого
   * уровня (со вложенными через точку), чтобы фронт мог построить
   * выбор источника → цель.
   *
   * Не сохраняет ничего в БД: чисто предпросмотр.
   */
  static async previewEndpoint(input: {
    integrationId: string;
    endpointId?: string;
    /** Если endpointId не задан — дергаем base URL интеграции. */
    overrideUrl?: string;
    limit?: number;
  }): Promise<{
    ok: boolean;
    url: string;
    httpStatus: number;
    latencyMs: number;
    fetched: number;
    /** Плоский список полей: ["id", "university.name", "progress", …] */
    fields: string[];
    /** Первые N записей как есть. */
    sample: unknown[];
    error?: string;
  }> {
    const startedAt = Date.now();
    const limit = Math.min(50, Math.max(1, input.limit ?? 5));

    const integration = await prisma.integration.findUnique({
      where: { id: input.integrationId },
      include: {
        endpoints: input.endpointId
          ? { where: { id: input.endpointId } }
          : false,
      },
    });
    if (!integration) throw new AppError('NOT_FOUND', 404);

    const config = (integration.config ?? {}) as IntegrationConfig;
    const baseUrl = (config.endpoint ?? '').replace(/\/$/, '');

    const path = input.endpointId
      ? integration.endpoints?.[0]?.path ?? ''
      : input.overrideUrl ?? '';

    const url = `${baseUrl}${path}`;
    if (!url || url === baseUrl) {
      return {
        ok: false,
        url,
        httpStatus: 0,
        latencyMs: Date.now() - startedAt,
        fetched: 0,
        fields: [],
        sample: [],
        error: 'Не задан endpoint URL',
      };
    }

    try {
      const method = input.endpointId
        ? integration.endpoints?.[0]?.method ?? 'GET'
        : 'GET';

      const response = await this.httpRequest(url, config, method);
      const rows = this.extractRows(response).slice(0, limit);
      const fields = rows.length > 0 ? this.collectFields(rows[0]) : [];

      return {
        ok: true,
        url,
        httpStatus: 200,
        latencyMs: Date.now() - startedAt,
        fetched: rows.length,
        fields,
        sample: rows,
      };
    } catch (e) {
      return {
        ok: false,
        url,
        httpStatus: 0,
        latencyMs: Date.now() - startedAt,
        fetched: 0,
        fields: [],
        sample: [],
        error: e instanceof Error ? e.message : 'unknown',
      };
    }
  }

  /**
   * Собирает плоский список путей полей объекта:
   *   { id: "1", university: { name: "МГУ" }, progress: 42 }
   * →
   *   ["id", "university.name", "progress"]
   *
   * Массивы не раскрываем (они становятся "#array" — фронт сам
   * решит, что с ними делать).
   */
  private static collectFields(obj: unknown, prefix = ''): string[] {
    if (obj === null || typeof obj !== 'object') return [];
    if (Array.isArray(obj)) return [`${prefix}#array`];

    const out: string[] = [];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === 'object') {
        if (Array.isArray(v)) {
          out.push(`${path}#array`);
        } else {
          out.push(...this.collectFields(v, path));
        }
      } else {
        out.push(path);
      }
    }
    return out;
  }

  // ============================================================
  // INTEGRATION RULES — автоматизация workflow по внешним данным
  // ============================================================

  /**
   * Применяет IntegrationRule к одной записи синхронизации.
   *
   * Вызывается в syncEndpoint сразу после upsert вуза:
   *  - проверяет condition по полям записи (path-нотация,
   *    как в applyMappings: "university.name");
   *  - выполняет actions: advance_workflow / create_task / add_tag.
   *
   * Ошибки не падают выше — пишутся в rule.lastError.
   */
  static async applyRules(input: {
    integrationId: string;
    endpointId: string;
    universityId: string;
    row: Record<string, unknown>;
  }): Promise<{ applied: number; errors: string[] }> {
    const rules = await prisma.integrationRule.findMany({
      where: {
        integrationId: input.integrationId,
        enabled: true,
        OR: [
          { endpointId: null },
          { endpointId: input.endpointId },
        ],
      },
    });

    let applied = 0;
    const errors: string[] = [];

    for (const rule of rules) {
      try {
        const condition = rule.condition as {
          field?: string;
          operator?: string;
          value?: unknown;
        };

        const matches = this.evaluateCondition(condition, input.row);
        if (!matches) continue;

        const actions = Array.isArray(rule.actions) ? rule.actions : [];
        for (const action of actions as {
          type: string;
          params?: Record<string, unknown>;
        }[]) {
          await this.runAction(action, input.universityId);
        }

        await prisma.integrationRule.update({
          where: { id: rule.id },
          data: { runCount: { increment: 1 }, lastRunAt: new Date(), lastError: null },
        });
        applied++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        errors.push(`rule ${rule.id}: ${msg}`);
        await prisma.integrationRule
          .update({
            where: { id: rule.id },
            data: { lastError: msg.slice(0, 500) },
          })
          .catch(() => {});
      }
    }

    return { applied, errors };
  }

  private static evaluateCondition(
    condition: { field?: string; operator?: string; value?: unknown },
    row: Record<string, unknown>,
  ): boolean {
    if (!condition.field || !condition.operator) return true;

    // Достаём значение по пути "a.b.c"
    const v = condition.field.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, row);

    const target = condition.value;

    switch (condition.operator) {
      case 'equals':
        return String(v) === String(target);
      case 'not_equals':
        return String(v) !== String(target);
      case 'greater':
        return Number(v) > Number(target);
      case 'less':
        return Number(v) < Number(target);
      case 'contains':
        return String(v ?? '').toLowerCase().includes(
          String(target ?? '').toLowerCase(),
        );
      case 'in':
        return Array.isArray(target) && target.map(String).includes(String(v));
      default:
        return false;
    }
  }

  private static async runAction(
    action: { type: string; params?: Record<string, unknown> },
    universityId: string,
  ): Promise<void> {
    const p = action.params ?? {};

    if (action.type === 'advance_workflow') {
      const stepId = String(p.stepId ?? '');
      const workflowId = String(p.workflowId ?? '');
      if (!stepId || !workflowId) return;

      const link = await prisma.workflowUniversity.findFirst({
        where: { universityId, workflowId },
        select: { id: true },
      });
      if (!link) return;

      await prisma.$transaction([
        prisma.workflowUniversity.update({
          where: { id: link.id },
          data: { currentStepId: stepId, updatedAt: new Date() },
        }),
        prisma.workflowStep.update({
          where: { id: stepId },
          data: { status: 'in_progress', statusCode: 'in_progress' },
        }),
      ]);
      return;
    }

    if (action.type === 'create_task') {
      await prisma.task.create({
        data: {
          universityId,
          title: String(p.title ?? 'Задача из интеграции'),
          description: p.description ? String(p.description) : null,
          priority: String(p.priority ?? 'Средний'),
          dueDate: new Date(
            Date.now() + Number(p.dueDays ?? 3) * 86_400_000,
          ),
          status: 'К выполнению',
          assignee: String(p.assignee ?? 'Анна Кузнецова'),
        },
      });
      return;
    }

    if (action.type === 'add_tag') {
      const tagId = String(p.tagId ?? '');
      if (!tagId) return;
      await prisma.universityTag
        .create({
          data: { universityId, tagId },
        })
        .catch(() => {});
      return;
    }
  }
}