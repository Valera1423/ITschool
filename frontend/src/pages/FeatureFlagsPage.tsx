import { useCallback, useEffect, useState } from 'react';
import { Flag, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  listAllFlags,
  updateFlag,
  type FeatureFlag,
} from '@/lib/featureFlags';
import { Button, EmptyState } from '@/components/ui';
import { asArray } from '@/lib/utils';

interface Props {
  onNotice: (m: string) => void;
}

export function FeatureFlagsPage({ onNotice }: Props) {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listAllFlags();
      setFlags(asArray(list));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (flag: FeatureFlag) => {
    setBusyKey(flag.key);
    try {
      const err = await updateFlag(flag.key, { enabled: !flag.enabled });
      if (err) {
        onNotice(`Ошибка: ${err}`);
        return;
      }
      onNotice(
        `Флаг «${flag.key}» ${flag.enabled ? 'выключен' : 'включён'}`,
      );
      await load();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-slate-400 mb-1">Управление функциями</p>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Feature Flags
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Включайте и выключайте функции без деплоя.
        </p>
      </section>

      {loading ? (
        <p className="text-sm text-slate-400">Загрузка…</p>
      ) : flags.length === 0 ? (
        <EmptyState text="Флагов нет" icon={Flag} />
      ) : (
        <div className="space-y-2">
          {flags.map((f) => (
            <div
              key={f.key}
              className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs font-mono text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 px-2 py-0.5 rounded">
                    {f.key}
                  </code>
                  {f.rollout !== null && (
                    <span className="text-xs text-amber-600">
                      rollout: {f.rollout}%
                    </span>
                  )}
                </div>
                {f.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    {f.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => void toggle(f)}
                disabled={busyKey === f.key}
                className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                  f.enabled
                    ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                aria-label={f.enabled ? 'Выключить' : 'Включить'}
              >
                {f.enabled ? (
                  <ToggleRight size={24} />
                ) : (
                  <ToggleLeft size={24} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}