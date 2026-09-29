// frontend/src/pages/AbTestsPage.tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BarChart3, Plus, Trash2, Play, Pause } from 'lucide-react';
import { api } from '@/lib/api';
import {
  EmptyState,
  SimpleModal,
  Button,
  Field,
  inputClass,
  textareaClass,
  StatusBadge,
} from '@/components/ui';
import { asArray } from '@/lib/utils';

interface AbTestVariant {
  id: string;
  weight: number;
}

interface AbTest {
  id: string;
  key: string;
  description: string | null;
  variants: AbTestVariant[];
  enabled: boolean;
  start_at: string | null;
  end_at: string | null;
}

interface Stats {
  [variant: string]: { [event: string]: number };
}

interface Props {
  onNotice: (m: string) => void;
}

export function AbTestsPage({ onNotice }: Props) {
  const [tests, setTests] = useState<AbTest[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.get<AbTest[]>('/ab').catch(() => []);
      const safeList = asArray<AbTest>(list);
      setTests(safeList);

      const statsEntries = await Promise.all(
        safeList.map(async (t) => {
          const s = await api
            .get<Stats>(`/ab/${t.key}/stats`)
            .catch(() => ({} as Stats));
          return [t.key, s] as const;
        }),
      );

      setStats(Object.fromEntries(statsEntries));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (t: AbTest) => {
    try {
      await api.patch(`/ab/${t.id}`, { enabled: !t.enabled });
      onNotice(t.enabled ? 'Тест остановлен.' : 'Тест запущен.');
      await load();
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  const remove = async (t: AbTest) => {
    if (!window.confirm(`Удалить тест «${t.key}»?`)) return;
    try {
      await api.delete(`/ab/${t.id}`);
      onNotice('Удалено.');
      await load();
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Эксперименты</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            A/B тесты
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Управление экспериментами и просмотр метрик
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={18} />
          Новый тест
        </Button>
      </section>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Загрузка…</p>
      ) : tests.length === 0 ? (
        <EmptyState text="Тестов нет" icon={BarChart3} />
      ) : (
        <div className="space-y-4">
          {tests.map((t) => (
            <div
              key={t.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs font-mono bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded">
                    {t.key}
                  </code>
                  <StatusBadge status={t.enabled ? 'Активен' : 'Отключён'} />
                  {t.description && (
                    <span className="text-xs text-slate-400">
                      {t.description}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => void toggle(t)}
                    className={`p-2 rounded-lg transition-colors ${
                      t.enabled
                        ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                        : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                    }`}
                    title={t.enabled ? 'Остановить' : 'Запустить'}
                  >
                    {t.enabled ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button
                    onClick={() => void remove(t)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                    title="Удалить"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {t.variants.map((v) => {
                  const s = stats[t.key]?.[v.id] ?? {};
                  const entries = Object.entries(s);
                  return (
                    <div
                      key={v.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{v.id}</span>
                        <span className="text-xs text-slate-400">
                          {v.weight}%
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        {entries.map(([evt, cnt]) => (
                          <div key={evt} className="flex justify-between">
                            <span className="text-slate-500">{evt}</span>
                            <strong>{cnt}</strong>
                          </div>
                        ))}
                        {entries.length === 0 && (
                          <span className="text-slate-400">Нет данных</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateAbTestModal
          onClose={() => setCreateOpen(false)}
          onCreated={load}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}

function CreateAbTestModal({
  onClose,
  onCreated,
  onNotice,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  onNotice: (m: string) => void;
}) {
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [variants, setVariants] = useState([
    { id: 'control', weight: 50 },
    { id: 'variant_a', weight: 50 },
  ]);
  const [saving, setSaving] = useState(false);

  const total = variants.reduce((s, v) => s + v.weight, 0);

  const updateVariant = (
    i: number,
    patch: Partial<{ id: string; weight: number }>,
  ) => {
    setVariants((v) =>
      v.map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
    );
  };

  const addVariant = () => {
    setVariants([...variants, { id: `variant_${variants.length}`, weight: 0 }]);
  };

  const removeVariant = (i: number) => {
    if (variants.length <= 2) return;
    setVariants(variants.filter((_, idx) => idx !== i));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return onNotice('Укажите ключ теста.');
    if (total !== 100) return onNotice('Сумма весов должна быть 100.');

    setSaving(true);
    try {
      await api.post('/ab', {
        key: key.trim(),
        description: description.trim() || null,
        variants,
        enabled: false,
      });
      onNotice('Тест создан. Включите его кнопкой ▶');
      await onCreated();
      onClose();
    } catch (err) {
      onNotice(`Ошибка: ${err instanceof Error ? err.message : 'неизвестная'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SimpleModal title="Новый A/B тест" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Ключ теста (латиница, точка, дефис)">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="dashboard_widget_order"
            className={inputClass}
          />
        </Field>

        <Field label="Описание">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Что тестируем?"
            className={textareaClass}
            rows={2}
          />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Варианты (сумма весов = 100)
            </p>
            <button
              type="button"
              onClick={addVariant}
              className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              <Plus size={12} /> Добавить вариант
            </button>
          </div>

          <div className="space-y-2">
            {variants.map((v, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2">
                <input
                  value={v.id}
                  onChange={(e) => updateVariant(i, { id: e.target.value })}
                  placeholder="control"
                  className={inputClass}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={v.weight}
                  onChange={(e) =>
                    updateVariant(i, { weight: Number(e.target.value) || 0 })
                  }
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => removeVariant(i)}
                  disabled={variants.length <= 2}
                  className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <p
            className={`text-xs mt-2 ${
              total === 100 ? 'text-emerald-600' : 'text-rose-500'
            }`}
          >
            Сумма весов: {total} {total !== 100 && '(должно быть 100)'}
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving || total !== 100}>
            {saving ? 'Создание…' : 'Создать'}
          </Button>
        </div>
      </form>
    </SimpleModal>
  );
}