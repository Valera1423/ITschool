// backend/src/db/realtime-extension.ts
import { WsService } from '../services/ws.service.js';
import { logger } from '../config/logger.js';
import { getAuditContext } from './audit-context.js';   // ← NEW

const FLUSH_MS = 300;
const MAX_BUFFER = 500;

const SILENT_MODELS = new Set([
  'AuditLog',
  'SecurityEvent',
  'WebhookLog',
  'IdempotencyKey',
  'ReminderLog',
  'OnboardingProgress',
  'IntegrationSyncLog',
  'AbTestEvent',
  'EntityVersion',
  'UserActivity',
]);

const MODEL_TO_ENTITY: Record<string, string> = {
  University: 'universities',
  UniversityContact: 'university-contacts',
  UniversityTag: 'university-tags',
  Interaction: 'interactions',
  Task: 'tasks',
  Comment: 'comments',
  Workflow: 'workflows',
  WorkflowStep: 'workflow-steps',
  WorkflowUniversity: 'workflow-universities',
  WorkflowTransition: 'workflow-transitions',
  WorkflowStatusCatalog: 'workflow-statuses',
  Contract: 'contracts',
  ContractApproval: 'contract-approvals',
  ContractVersion: 'contract-versions',
  Document: 'documents',
  Segment: 'segments',
  Dashboard: 'dashboards',
  KbArticle: 'knowledge',
  KbCategory: 'kb-categories',
  Notification: 'notifications',
  PushSubscription: 'push-subscriptions',
  Integration: 'integrations',
  IntegrationEndpoint: 'integration-endpoints',
  AutomationRule: 'automation-rules',
  AutomationRun: 'automation-runs',
  Tag: 'tags',
  SavedView: 'saved-views',
  CustomField: 'custom-fields',
  CustomFieldValue: 'custom-field-values',
  Profile: 'profiles',
  UserPreferences: 'user-preferences',
  UserScope: 'user-scopes',
  PdConsent: 'pd-consents',
  IpWhitelistEntry: 'ip-whitelist',
  Manager: 'managers',
  Vendor: 'vendors',
  ItDirection: 'it-directions',
  ItProduct: 'it-products',
  SmsSubscription: 'sms-subscriptions',
  ExternalExportLog: 'external-exports',
  EdoDocument: 'edo-documents',
  CallLog: 'calls',
  InboxMessage: 'inbox',
  PublicReportLink: 'public-report-links',
  GoogleOAuthToken: 'google-oauth',
  FeatureFlag: 'feature-flags',
  AbTest: 'ab-tests',
};

const WRITE_OPS = new Set([
  'create', 'createMany', 'createManyAndReturn',
  'update', 'updateMany', 'upsert',
  'delete', 'deleteMany',
]);

type OpKind = 'created' | 'updated' | 'deleted' | 'bulk-changed';

function opKind(operation: string): OpKind {
  if (operation === 'create' || operation === 'createMany' || operation === 'createManyAndReturn') {
    return 'created';
  }
  if (operation === 'update' || operation === 'upsert') return 'updated';
  if (operation === 'delete' || operation === 'deleteMany') return 'deleted';
  return 'bulk-changed';
}

function isBulkOp(operation: string): boolean {
  return (
    operation === 'updateMany' ||
    operation === 'deleteMany' ||
    operation === 'createMany' ||
    operation === 'createManyAndReturn'
  );
}

interface PendingEvent {
  entity: string;
  type: string;
  ids: Set<string>;
  count: number;
  bulk: boolean;
  /** Email инициатора (из ALS) — чтобы фронт не показывал
   *  toast на собственные действия. */
  actor: string;
}

const buffer = new Map<string, PendingEvent>();
let flushTimer: NodeJS.Timeout | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_MS);
  if (typeof flushTimer.unref === 'function') flushTimer.unref();
}

function enqueue(
  entity: string,
  op: OpKind,
  ids: string[],
  count: number,
  actor: string,
): void {
  const type = `${entity}:${op}`;
  const key = `${entity}:${op}`;

  let evt = buffer.get(key);
  if (!evt) {
    evt = {
      entity,
      type,
      ids: new Set(),
      count: 0,
      bulk: false,
      actor,
    };
    buffer.set(key, evt);
  }

  for (const id of ids) {
    if (evt.ids.size >= 50) break;
    evt.ids.add(id);
  }
  evt.count += count;
  evt.bulk = evt.bulk || isBulkOp(op);

  if (buffer.size >= MAX_BUFFER) {
    void flush();
    return;
  }

  scheduleFlush();
}

async function flush(): Promise<void> {
  if (buffer.size === 0) return;

  const events = Array.from(buffer.values());
  buffer.clear();

  for (const evt of events) {
    try {
      const idArray = Array.from(evt.ids);
      WsService.broadcast({
        type: evt.type,
        entity: evt.entity,
        entityId: idArray.length === 1 ? idArray[0] : null,
        actor: evt.actor,
        payload: {
          count: evt.count,
          ids: idArray,
          bulk: evt.bulk || evt.count > 1,
        },
      });
    } catch (e) {
      logger.warn(
        { err: e, entity: evt.entity, type: evt.type },
        '[realtime] broadcast failed',
      );
    }
  }
}

export async function flushRealtime(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flush();
}

export function realtimeExtension() {
  if (process.env.DISABLE_REALTIME_EXTENSION === 'true') {
    return { name: 'realtime-disabled', query: {} } as const;
  }

  return {
    name: 'realtime',
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string | undefined;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          if (!model || SILENT_MODELS.has(model)) return query(args);
          if (!WRITE_OPS.has(operation)) return query(args);

          const entity = MODEL_TO_ENTITY[model];
          if (!entity) return query(args);

          const result = await query(args);
          const kind = opKind(operation);

          const ids: string[] = [];
          let count = 1;

          if (Array.isArray(result)) {
            for (const row of result) {
              if (row && typeof row === 'object' && 'id' in row) {
                const id = (row as { id?: unknown }).id;
                if (typeof id === 'string') ids.push(id);
              }
            }
            count = result.length;
          } else if (result && typeof result === 'object') {
            const obj = result as { id?: unknown; count?: unknown };
            if (typeof obj.id === 'string') ids.push(obj.id);
            if (typeof obj.count === 'number') count = obj.count;
          }

          // actor из ALS (AuditContext) — реальный email инициатора
          const ctx = getAuditContext();
          const actor = ctx?.userEmail ?? ctx?.source ?? 'system';

          enqueue(entity, kind, ids, count, actor);
          return result;
        },
      },
    },
  } as const;
}