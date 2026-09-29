import { useEffect, useState } from 'react';
import {
  Activity, Database, HardDrive, Server, KeyRound, ListChecks,
  RefreshCw, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge, EmptyState, Button } from '@/components/ui';
import { formatDateTime, asArray } from '@/lib/utils';

interface HealthResponse {
  db: { ok: boolean; latencyMs: number };
  redis: { ok: boolean; latencyMs: number };
  minio: { ok: boolean; latencyMs: number };
  keycloak: { ok: boolean; latencyMs: number };
  queues: Record<string, { waiting: number; active: number; failed: number; completed: number }>;
  uptime: number;
  memory: { heapUsed: number; heapTotal: number; rss: number };
}

interface ErrorRow {
  id: number;
  user_email: string | null;
  after: {
    code?: string;
    message?: string;
    stack?: string;
    url?: string;
    severity?: string;
  } | null;
  created_at: string;
}

export function SystemHealthPage({ onNotice }: { onNotice: (m: string) => void }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [h, e] = await Promise.all([
        api.get<HealthResponse>('/system/health').catch(() => null),
        api.get<ErrorRow[]>('/system/errors?limit=100').catch(() => []),
      ]);
      setHealth(h);
      setErrors(asArray(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <p className="text-sm text-slate-400 text-center py-12">Проверка…</p>
    );
  }

  if (!health) {
    return <EmptyState text="Не удалось получить статус" />;
  }

  const services = [
    { key: 'db', label: 'PostgreSQL', icon: Database, ok: health.db.ok, latency: health.db.latencyMs },
    { key: 'redis', label: 'Redis', icon: Activity, ok: health.redis.ok, latency: health.redis.latencyMs },
    { key: 'minio', label: 'MinIO', icon: HardDrive, ok: health.minio.ok, latency: health.minio.latencyMs },
    { key: 'keycloak', label: 'Keycloak', icon: KeyRound, ok: health.keycloak.ok, latency: health.keycloak.latencyMs },
  ];

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-1">Мониторинг</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Здоровье системы
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Uptime: {Math.floor(health.uptime / 3600)}ч{' '}
            {Math.floor((health.uptime % 3600) / 60)}м
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()}>
          <RefreshCw size={14} /> Обновить
        </Button>
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {services.map((s) => (
          <div
            key={s.key}
            className={`rounded-2xl p-5 border ${
              s.ok
                ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-900/40'
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <s.icon
                size={18}
                className={s.ok ? 'text-emerald-500' : 'text-rose-500'}
              />
              <p className="font-medium text-sm text-slate-700 dark:text-slate-200">
                {s.label}
              </p>
            </div>
            <p
              className={`text-2xl font-bold ${
                s.ok ? 'text-slate-800 dark:text-slate-100' : 'text-rose-600'
              }`}
            >
              {s.latency} мс
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {s.ok ? '● работает' : '✕ недоступен'}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
        <h2 className="font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
          <ListChecks size={18} className="text-sky-500" /> Очереди
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(health.queues).map(([name, counts]) => {
            const c = counts as {
              waiting: number;
              active: number;
              failed: number;
              completed: number;
            };
            const healthy = c.failed === 0;
            return (
              <div
                key={name}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{name}</p>
                  {!healthy && (
                    <AlertTriangle size={14} className="text-amber-500" />
                  )}
                </div>
                <div className="grid grid-cols-4 gap-1 text-xs">
                  <div>
                    <span className="text-slate-400">в очереди</span>
                    <br />
                    <b>{c.waiting}</b>
                  </div>
                  <div>
                    <span className="text-slate-400">активных</span>
                    <br />
                    <b className="text-sky-600">{c.active}</b>
                  </div>
                  <div>
                    <span className="text-slate-400">готово</span>
                    <br />
                    <b className="text-emerald-600">{c.completed}</b>
                  </div>
                  <div>
                    <span className="text-slate-400">ошибок</span>
                    <br />
                    <b className={c.failed > 0 ? 'text-rose-600' : ''}>
                      {c.failed}
                    </b>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
        <h2 className="font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
          <AlertTriangle size={18} className="text-rose-500" /> Последние ошибки (
          {errors.length})
        </h2>
        {errors.length === 0 ? (
          <EmptyState text="Ошибок нет — отлично" icon={CheckCircle2} />
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {errors.map((e) => (
              <details
                key={e.id}
                className="rounded-xl border border-slate-100 dark:border-slate-800"
              >
                <summary className="cursor-pointer p-3 flex items-start gap-3">
                  <XCircle
                    size={16}
                    className="text-rose-500 flex-shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                      {e.after?.message ?? '—'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {e.after?.code} · {e.user_email ?? 'аноним'} ·{' '}
                      {formatDateTime(e.created_at)}
                    </p>
                  </div>
                </summary>
                <div className="border-t border-slate-100 dark:border-slate-800 p-3 space-y-2 text-xs">
                  {e.after?.url && (
                    <p>
                      <b>URL:</b> {e.after.url}
                    </p>
                  )}
                  {e.after?.stack && (
                    <pre className="bg-slate-50 dark:bg-slate-800 rounded p-2 overflow-x-auto max-h-64 text-[10px]">
                      {e.after.stack}
                    </pre>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}