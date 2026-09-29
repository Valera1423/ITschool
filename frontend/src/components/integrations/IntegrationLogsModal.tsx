import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Clock,
  Database,
} from 'lucide-react';
import type { IntegrationSyncLog } from '@/types';
import type { IntegrationsClient } from '@/lib/integrationsClient';
import { SimpleModal, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

/**
 * Журнал синхронизаций.
 * Каждый запуск можно раскрыть — увидеть URL, длительность, ошибки.
 */
interface Props {
  integrationId: string;
  integrationName: string;
  client: IntegrationsClient;
  onClose: () => void;
}

export function IntegrationLogsModal({
  integrationId,
  integrationName,
  client,
  onClose,
}: Props) {
  const [logs, setLogs] = useState<IntegrationSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await client.listLogs(integrationId, 100);
        setLogs(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [integrationId, client]);

  return (
    <SimpleModal title={`Журнал: ${integrationName}`} onClose={onClose} wide>
      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="animate-spin mx-auto text-sky-500" size={24} />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState text="Синхронизаций ещё не было" />
      ) : (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
          {logs.map((log) => {
            const Icon =
              log.status === 'success'
                ? CheckCircle2
                : log.status === 'partial'
                  ? AlertCircle
                  : log.status === 'failed'
                    ? XCircle
                    : Loader2;

            const color =
              log.status === 'success'
                ? 'text-emerald-500'
                : log.status === 'partial'
                  ? 'text-amber-500'
                  : log.status === 'failed'
                    ? 'text-rose-500'
                    : 'text-slate-400';

            const isOpen = expanded === log.id;

            return (
              <div
                key={log.id}
                className="rounded-xl border border-slate-100 dark:border-slate-800"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                  className="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <Icon
                    size={16}
                    className={`${color} flex-shrink-0 mt-0.5 ${log.status === 'running' ? 'animate-spin' : ''}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {log.status === 'success'
                          ? 'Успешно'
                          : log.status === 'partial'
                            ? 'С предупреждениями'
                            : log.status === 'failed'
                              ? 'Ошибка'
                              : 'Выполняется'}
                      </span>
                      <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {log.trigger === 'manual'
                          ? 'вручную'
                          : log.trigger === 'cron'
                            ? 'авто'
                            : 'webhook'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Database size={11} />
                        {log.records_fetched} получено
                      </span>
                      <span className="text-emerald-600">
                        +{log.records_created}
                      </span>
                      <span className="text-violet-600">
                        ~{log.records_updated}
                      </span>
                      {log.records_failed > 0 && (
                        <span className="text-rose-600">
                          {log.records_failed} ошибок
                        </span>
                      )}
                      {log.duration_ms && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {log.duration_ms} мс
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDateTime(log.started_at)}
                      {log.actor && ` · ${log.actor}`}
                    </p>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-slate-800 p-3 text-xs space-y-2">
                    {log.request_url && (
                      <div>
                        <p className="text-slate-400 mb-0.5">URL:</p>
                        <code className="block bg-slate-50 dark:bg-slate-800 rounded p-2 break-all">
                          {log.request_url}
                        </code>
                      </div>
                    )}
                    {log.error_message && (
                      <div>
                        <p className="text-rose-500 mb-0.5">Ошибка:</p>
                        <p className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 rounded p-2">
                          {log.error_message}
                        </p>
                      </div>
                    )}
                    {log.errors.length > 0 && (
                      <div>
                        <p className="text-rose-500 mb-0.5">
                          Ошибки строк ({log.errors.length}):
                        </p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {log.errors.map((e, i) => (
                            <div
                              key={i}
                              className="text-rose-600 dark:text-rose-400"
                            >
                              Строка {e.row + 1}: {e.message}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {log.response_sample && (
                      <details>
                        <summary className="text-slate-500 cursor-pointer">
                          Пример ответа (первые 3 записи)
                        </summary>
                        <pre className="mt-2 bg-slate-50 dark:bg-slate-800 rounded p-2 overflow-x-auto max-h-60 text-[10px]">
                          {JSON.stringify(log.response_sample, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SimpleModal>
  );
}