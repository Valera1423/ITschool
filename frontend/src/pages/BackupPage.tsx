import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Upload,
  Database,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui';
import {
  createBackup,
  downloadBackup,
  readBackupFile,
  restoreFromBackup,
  type BackupFile,
  type RestoreResult,
} from '@/lib/backup';
import { formatDateTime } from '@/lib/utils';

interface Props {
  onNotice: (msg: string) => void;
  onRefresh: () => Promise<void>;
}

export function BackupPage({ onNotice, onRefresh }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [truncate, setTruncate] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [results, setResults] = useState<RestoreResult[] | null>(null);

  const makeBackup = async () => {
    setCreating(true);
    try {
      const b = await createBackup();
      downloadBackup(b);
      const total = Object.values(b.tables).reduce(
        (s, rows) => s + (Array.isArray(rows) ? rows.length : 0),
        0,
      );
      onNotice(`Бэкап создан: ${total} записей.`);
    } catch (e) {
      onNotice(e instanceof Error ? e.message : 'Ошибка создания бэкапа.');
    } finally {
      setCreating(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const b = await readBackupFile(f);
      setPending(b);
      setResults(null);
      onNotice('Файл прочитан. Проверьте и подтвердите восстановление.');
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Ошибка чтения файла.');
    }
  };

  const doRestore = async () => {
    if (!pending) return;
    if (
      truncate &&
      !window.confirm(
        'ВНИМАНИЕ: текущие данные будут удалены перед восстановлением. Продолжить?',
      )
    )
      return;
    if (
      !truncate &&
      !window.confirm(
        'Восстановить данные из бэкапа? Существующие записи с теми же id будут перезаписаны.',
      )
    )
      return;

    setRestoring(true);
    try {
      const r = await restoreFromBackup(pending, { truncate });
      setResults(r);
      // Полная инвалидация кэшей — данные на всех страницах устарели
      await qc.invalidateQueries();
      await onRefresh();
      onNotice('Восстановление завершено.');
      setPending(null);
    } finally {
      setRestoring(false);
    }
  };

  const summary = pending
    ? Object.entries(pending.tables).map(([k, v]) => ({
        table: k,
        count: Array.isArray(v) ? v.length : 0,
      }))
    : [];

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-slate-400 mb-1">
          Данные и восстановление
        </p>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Бэкапы
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Скачивайте резервные копии и восстанавливайте базу из файла.
        </p>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 flex items-center justify-center">
              <Database size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">
                Скачать бэкап
              </h2>
              <p className="text-sm text-slate-500">
                Полная выгрузка всех таблиц в JSON.
              </p>
            </div>
          </div>
          <Button
            onClick={() => void makeBackup()}
            loading={creating}
            className="w-full"
          >
            <Download size={16} />
            {creating ? 'Создание…' : 'Скачать JSON-бэкап'}
          </Button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 flex items-center justify-center">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">
                Восстановить из файла
              </h2>
              <p className="text-sm text-slate-500">
                Загрузите JSON-бэкап для восстановления.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            disabled={restoring}
            className="w-full"
          >
            <Upload size={16} />
            {restoring ? 'Загрузка…' : 'Выбрать файл'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void onFile(e)}
          />
        </div>
      </div>

      {pending && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
            Бэкап от {formatDateTime(pending.created_at)}
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Версия файла: {pending.version}
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
            {summary.map((s) => (
              <div
                key={s.table}
                className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs"
              >
                <span className="text-slate-500">{s.table}</span>
                <strong className="block text-slate-800 dark:text-slate-100 text-base mt-0.5">
                  {s.count}
                </strong>
              </div>
            ))}
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/40 mb-4">
            <input
              type="checkbox"
              checked={truncate}
              onChange={(e) => setTruncate(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-rose-300 text-rose-600"
            />
            <span className="text-sm text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
              Удалить все текущие записи перед восстановлением (полная замена).
            </span>
          </label>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setPending(null);
                setResults(null);
              }}
            >
              Отмена
            </Button>
            <Button onClick={() => void doRestore()} loading={restoring}>
              Восстановить
            </Button>
          </div>
        </div>
      )}

      {results && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" />
            Результат восстановления
          </h2>
          <div className="space-y-1">
            {results.map((r) => (
              <div
                key={r.table}
                className="flex items-center justify-between p-2 rounded text-sm"
              >
                <span className="text-slate-600 dark:text-slate-300">
                  {r.table}
                </span>
                {r.error ? (
                  <span className="text-rose-600 text-xs">{r.error}</span>
                ) : (
                  <span className="text-emerald-600 text-xs">
                    +{r.inserted}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}