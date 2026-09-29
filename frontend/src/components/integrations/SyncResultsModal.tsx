import { CheckCircle2, AlertTriangle, XCircle, Clock, Database } from 'lucide-react';
import { SimpleModal, Button, EmptyState } from '@/components/ui';
import type { SyncResultRow } from '@/lib/integrationsClient';

/**
 * Модалка результата синхронизации.
 * Показывает счётчики по каждому endpoint + ошибки строк.
 */
interface Props {
  results: SyncResultRow[];
  integrationName: string;
  onClose: () => void;
}

export function SyncResultsModal({
  results,
  integrationName,
  onClose,
}: Props) {
  const totalCreated = results.reduce((s, r) => s + r.created, 0);
  const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
  const totalFailed = results.reduce((s, r) => s + r.failed, 0);
  const totalFetched = results.reduce((s, r) => s + r.fetched, 0);
  const anyFailed = results.some((r) => r.status === 'failed');

  return (
    <SimpleModal
      title={`Результат синхронизации: ${integrationName}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-5">
        {/* Сводка */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Загружено" value={totalFetched} color="sky" />
          <SummaryCard label="Создано" value={totalCreated} color="emerald" />
          <SummaryCard label="Обновлено" value={totalUpdated} color="violet" />
          <SummaryCard
            label="Ошибок"
            value={totalFailed}
            color={totalFailed > 0 ? 'rose' : 'slate'}
          />
        </div>

        {/* По endpoint-ам */}
        {results.length === 0 ? (
          <EmptyState text="Нет активных endpoints" />
        ) : (
          <div className="space-y-2">
            {results.map((r) => {
              const Icon =
                r.status === 'success'
                  ? CheckCircle2
                  : r.status === 'partial'
                    ? AlertTriangle
                    : XCircle;
              const color =
                r.status === 'success'
                  ? 'text-emerald-500'
                  : r.status === 'partial'
                    ? 'text-amber-500'
                    : 'text-rose-500';
              return (
                <div
                  key={r.endpointId}
                  className="rounded-xl border border-slate-100 dark:border-slate-800 p-4"
                >
                  <div className="flex items-start gap-3">
                    <Icon size={18} className={`${color} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {r.endpointName}
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Database size={11} />
                          Получено: {r.fetched}
                        </span>
                        <span className="text-emerald-600">+{r.created}</span>
                        <span className="text-violet-600">~{r.updated}</span>
                        <span className="text-slate-400">пропущено: {r.skipped}</span>
                        {r.failed > 0 && (
                          <span className="text-rose-600">ошибок: {r.failed}</span>
                        )}
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock size={11} />
                          {r.durationMs} мс
                        </span>
                      </div>
                      {r.error && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-900/20">
                          {r.error}
                        </p>
                      )}
                      {r.errors.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-500 cursor-pointer">
                            Показать ошибки строк ({r.errors.length})
                          </summary>
                          <div className="mt-2 max-h-40 overflow-y-auto space-y-1 text-xs">
                            {r.errors.map((e, i) => (
                              <div
                                key={i}
                                className="text-rose-600 dark:text-rose-400"
                              >
                                Строка {e.row + 1}: {e.message}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={onClose} variant={anyFailed ? 'secondary' : 'primary'}>
            {anyFailed ? 'Закрыть' : 'Готово'}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const map: Record<string, string> = {
    sky: 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    violet: 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
    rose: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
    slate: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  };
  return (
    <div className={`rounded-xl p-3 ${map[color] ?? map.slate}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}