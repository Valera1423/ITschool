// frontend/src/components/SmsSubscriptionsCard.tsx
import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Plus, Trash2, Check } from 'lucide-react';
import {
  listSms,
  upsertSms,
  deleteSms,
  SMS_EVENTS,
  type SmsSubscription,
} from '@/lib/sms';
import { Button, Field, inputClass, EmptyState } from '@/components/ui';

/**
 * Управление SMS-подписками.
 * Пользователь указывает телефон и категории событий.
 */
export function SmsSubscriptionsCard({
  onNotice,
}: {
  onNotice: (msg: string) => void;
}) {
  const [items, setItems] = useState<SmsSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [phone, setPhone] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listSms());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!phone.trim()) {
      onNotice('Укажите телефон.');
      return;
    }
    if (selected.length === 0) {
      onNotice('Выберите хотя бы одну категорию.');
      return;
    }
    const err = await upsertSms({
      phone: phone.trim(),
      event_types: selected,
      enabled: true,
    });
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    onNotice('Подписка сохранена.');
    setAdding(false);
    setPhone('');
    setSelected([]);
    await load();
  };

  const toggle = (v: string) => {
    setSelected((s) =>
      s.includes(v) ? s.filter((x) => x !== v) : [...s, v],
    );
  };

  const remove = async (id: string) => {
    if (!window.confirm('Удалить подписку?')) return;
    const err = await deleteSms(id);
    onNotice(err ? `Ошибка: ${err}` : 'Подписка удалена.');
    if (!err) await load();
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 flex items-center justify-center">
            <MessageSquare size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              SMS-уведомления
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Получайте SMS по важным событиям
            </p>
          </div>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={13} /> Добавить
          </Button>
        )}
      </div>

      {adding && (
        <div className="mb-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-3">
          <Field label="Номер телефона">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 999 123-45-67"
              className={inputClass}
            />
          </Field>

          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Категории событий
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {SMS_EVENTS.map((ev) => {
                const checked = selected.includes(ev.value);
                return (
                  <label
                    key={ev.value}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      checked
                        ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(ev.value)}
                      className="hidden"
                    />
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        checked
                          ? 'bg-sky-500 border-sky-500'
                          : 'border-slate-300'
                      }`}
                    >
                      {checked && <Check size={11} className="text-white" />}
                    </div>
                    <span className="text-sm">{ev.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAdding(false);
                setPhone('');
                setSelected([]);
              }}
            >
              Отмена
            </Button>
            <Button size="sm" onClick={() => void submit()}>
              Сохранить
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Загрузка…</p>
      ) : items.length === 0 && !adding ? (
        <EmptyState text="SMS-подписок нет" icon={MessageSquare} />
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-medium text-slate-700 dark:text-slate-200">
                  {s.phone}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.event_types.map((e) => (
                    <span
                      key={e}
                      className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded"
                    >
                      {SMS_EVENTS.find((x) => x.value === e)?.label ?? e}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => void remove(s.id)}
                className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                aria-label="Удалить"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}