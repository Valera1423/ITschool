// frontend/src/components/integrations/IntegrationCard.tsx
import { useState } from 'react';
import {
  Plug,
  RefreshCw,
  Settings,
  Trash2,
  Power,
  PowerOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  Loader2,
  Workflow,
  Lock,
} from 'lucide-react';
import type { Integration } from '@/types';
import type { IntegrationsClient, SyncResultRow } from '@/lib/integrationsClient';
import { StatusBadge, Button } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { IntegrationRulesEditor } from './IntegrationRulesEditor';

/**
 * Карточка интеграции с действиями:
 * - Проверить соединение
 * - Синхронизировать
 * - Включить / отключить
 * - Настроить endpoints и маппинги
 * - Настроить правила автоматизации (LMS → workflow)
 * - Показать журнал
 */
interface Props {
  integration: Integration;
  client: IntegrationsClient;
  canEdit: boolean;
  onRefresh: () => Promise<void>;
  onSyncResult: (results: SyncResultRow[]) => void;
  onOpenSettings: (i: Integration) => void;
  onOpenLogs: (i: Integration) => void;
  onNotice: (msg: string) => void;
}

export function IntegrationCard({
  integration,
  client,
  canEdit,
  onRefresh,
  onSyncResult,
  onOpenSettings,
  onOpenLogs,
  onNotice,
}: Props) {
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const test = async () => {
    setTesting(true);
    try {
      const res = await client.testConnection(integration.id);
      onNotice(
        res.ok
          ? `✓ Соединение OK (${res.latencyMs} мс)`
          : `✗ ${res.error ?? 'Ошибка'}`,
      );
      await onRefresh();
    } catch (e) {
      onNotice(`Ошибка: ${(e as { message?: string }).message ?? 'неизвестная'}`);
    } finally {
      setTesting(false);
    }
  };

  const sync = async () => {
    if (!window.confirm(`Запустить синхронизацию «${integration.name}»?`)) return;
    setSyncing(true);
    try {
      const results = await client.syncNow(integration.id);
      onSyncResult(results);
      await onRefresh();
    } catch (e) {
      onNotice(`Ошибка синхронизации: ${(e as { message?: string }).message ?? 'неизвестная'}`);
    } finally {
      setSyncing(false);
    }
  };

  const toggleStatus = async () => {
    const next = integration.status === 'Активна' ? 'Отключена' : 'Активна';
    await client.updateIntegration(integration.id, { status: next });
    onNotice(`Интеграция ${next === 'Активна' ? 'включена' : 'отключена'}.`);
    await onRefresh();
  };

  const remove = async () => {
    if (!window.confirm(`Удалить «${integration.name}»?`)) return;
    await client.deleteIntegration(integration.id);
    onNotice('Интеграция удалена.');
    await onRefresh();
  };

  const enabledEndpoints =
    integration.endpoints?.filter((e) => e.enabled).length ?? 0;

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border shadow-sm ${
        integration.status === 'Активна'
          ? 'border-slate-100 dark:border-slate-800'
          : 'border-slate-200 dark:border-slate-800 opacity-80'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            integration.status === 'Активна'
              ? 'bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}
        >
          <Plug size={20} />
        </div>
        <StatusBadge status={integration.status} />
      </div>

      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-0.5 flex items-center gap-2">
        {integration.name}
        {Boolean(
          (integration.config as { webhook_secret?: string })?.webhook_secret,
        ) && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded"
            title="Webhook настроен"
          >
            <Lock size={9} /> webhook
          </span>
        )}
      </h3>
      <p className="text-xs text-slate-400 mb-3">
        {enabledEndpoints} endpoint{enabledEndpoints === 1 ? '' : 'ов'} ·{' '}
        {integration.auto_sync
          ? `авто ${integration.sync_schedule}`
          : 'только вручную'}
      </p>

      {/* Последний sync */}
      {integration.last_sync_at && (
        <div
          className={`flex items-center gap-2 text-xs p-2 rounded-lg mb-3 ${
            integration.last_sync_status === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
              : integration.last_sync_status === 'partial'
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300'
          }`}
        >
          {integration.last_sync_status === 'success' ? (
            <CheckCircle2 size={12} />
          ) : (
            <AlertCircle size={12} />
          )}
          <span className="flex-1">
            {integration.last_sync_status === 'success'
              ? 'Успешно'
              : integration.last_sync_status === 'partial'
                ? 'С предупреждениями'
                : 'Ошибка'}{' '}
            · {integration.last_sync_count ?? 0} записей
          </span>
          <span className="text-[10px] opacity-70">
            {formatDateTime(integration.last_sync_at)}
          </span>
        </div>
      )}

      {/* Ошибка проверки */}
      {integration.last_error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2 mb-3 line-clamp-2">
          {integration.last_error}
        </p>
      )}

      {/* Метрики */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
          <div className="text-slate-700 dark:text-slate-200 font-semibold">
            {integration.check_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-400">проверок</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
          <div className="text-slate-700 dark:text-slate-200 font-semibold">
            {integration.failure_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-400">сбоев</div>
        </div>
        <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
          <div className="text-slate-700 dark:text-slate-200 font-semibold">
            {integration.last_sync_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-400">записей</div>
        </div>
      </div>

      {/* Кнопки */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-50 dark:border-slate-800">
        <Button variant="secondary" size="sm" onClick={() => void test()} disabled={testing}>
          {testing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Проверить
        </Button>

        {canEdit && (
          <>
            <Button
              size="sm"
              onClick={() => void sync()}
              disabled={syncing || integration.status !== 'Активна'}
            >
              {syncing ? <Loader2 size={13} className="animate-spin" /> : <Database size={13} />}
              {syncing ? 'Синхронизация…' : 'Синхронизировать'}
            </Button>

            <button
              onClick={() => void toggleStatus()}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600 transition-colors"
              title={integration.status === 'Активна' ? 'Отключить' : 'Включить'}
            >
              {integration.status === 'Активна' ? (
                <PowerOff size={15} />
              ) : (
                <Power size={15} />
              )}
            </button>

            <button
              onClick={() => onOpenSettings(integration)}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600 transition-colors"
              title="Настройки и маппинг"
            >
              <Settings size={15} />
            </button>

            <button
              onClick={() => setRulesOpen(true)}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600 transition-colors"
              title="Правила автоматизации (LMS → workflow)"
            >
              <Workflow size={15} />
            </button>

            <button
              onClick={() => onOpenLogs(integration)}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600 transition-colors"
              title="Журнал"
            >
              <Clock size={15} />
            </button>

            <button
              onClick={() => void remove()}
              className="ml-auto p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 transition-colors"
              title="Удалить"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>

      {rulesOpen && (
        <IntegrationRulesEditor
          integrationId={integration.id}
          integrationName={integration.name}
          onClose={() => setRulesOpen(false)}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}