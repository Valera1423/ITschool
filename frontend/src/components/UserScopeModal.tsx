import { useCallback, useEffect, useState } from 'react';
import { Trash2, Plus, ShieldCheck, Info } from 'lucide-react';
import { api } from '@/lib/api';
import type { Profile } from '@/types';
import {
  SimpleModal,
  Button,
  Field,
  inputClass,
  selectClass,
  EmptyState,
} from '@/components/ui';

interface ScopeRow {
  id: string;
  userId: string;
  entity: string;
  filter: Record<string, unknown>;
  createdAt: string;
}

interface Props {
  user: Profile;
  onClose: () => void;
  onNotice: (msg: string) => void;
}

/**
 * Поля, по которым можно ограничить доступ для universities.
 * Ключ = имя колонки Prisma, значение — метка.
 */
const SCOPE_FIELDS = [
  { key: 'manager',     label: 'Менеджер (ФИО)' },
  { key: 'city',        label: 'Город' },
  { key: 'status',      label: 'Статус' },
  { key: 'direction',   label: 'Направление (текст)' },
  { key: 'managerId',   label: 'Менеджер (ID)' },
  { key: 'directionId', label: 'Направление (ID)' },
  { key: 'productId',   label: 'Продукт (ID)' },
  { key: 'vendorId',    label: 'Вендор (ID)' },
];

/**
 * Модалка разграничения доступа. Управляет user_scopes для пользователя.
 * Для роли nam без явного scope действует автоправило manager=ФИО.
 */
export function UserScopeModal({ user, onClose, onNotice }: Props) {
  const [rows, setRows] = useState<ScopeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<{ key: string; value: string }[]>([
    { key: 'manager', value: '' },
  ]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ScopeRow[]>(`/user-scopes/${user.id}`);
      setRows(data);
      const uni = data.find((r) => r.entity === 'universities');
      if (uni && uni.filter && typeof uni.filter === 'object') {
        const f = Object.entries(uni.filter).map(([k, v]) => ({
          key: k,
          value: String(v ?? ''),
        }));
        if (f.length > 0) setFields(f);
      }
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    // Собираем filter из непустых строк
    const filter: Record<string, unknown> = {};
    for (const f of fields) {
      if (!f.key || !f.value.trim()) continue;
      filter[f.key] = f.value.trim();
    }

    if (Object.keys(filter).length === 0) {
      onNotice('Укажите хотя бы одно правило');
      return;
    }

    setSaving(true);
    try {
      await api.post('/user-scopes', {
        userId: user.id,
        entity: 'universities',
        filter,
      });
      onNotice('Ограничения сохранены. Применятся при следующем запросе.');
      await load();
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Снять все ограничения?')) return;
    try {
      await api.delete(`/user-scopes/${id}`);
      onNotice('Ограничения сняты.');
      setFields([{ key: 'manager', value: '' }]);
      await load();
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  const addField = () => setFields((f) => [...f, { key: 'city', value: '' }]);
  const updateField = (i: number, patch: Partial<{ key: string; value: string }>) =>
    setFields((f) => f.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeField = (i: number) =>
    setFields((f) => f.filter((_, idx) => idx !== i));

  const hasExplicitScope = rows.some((r) => r.entity === 'universities');

  return (
    <SimpleModal
      title={`Ограничить доступ: ${user.full_name}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-900/40 p-3 text-xs text-sky-700 dark:text-sky-300 flex items-start gap-2">
          <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium mb-1">
              {user.role === 'nam'
                ? 'По умолчанию менеджер (НАМ) видит только свои вузы (manager = ФИО).'
                : 'Для роли Руководитель и Администратор ограничения не действуют.'}
            </p>
            <p>
              Явные правила ниже перезаписывают автоправило. Ключи соединяются
              через <strong>И</strong>.
            </p>
          </div>
        </div>

        {user.role === 'nam' && !hasExplicitScope && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">Автоправило для НАМ</p>
              <p>
                Пользователь видит только вузы, где он указан менеджером
                (по <code className="font-mono">managerId → profileId</code>).
                Если добавить явное правило ниже, автоправило перестанет
                действовать — scope будет вычисляться только по указанным
                вами условиям.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Загрузка…</p>
        ) : (
          <>
            {hasExplicitScope && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Активные ограничения
                </p>
                {rows
                  .filter((r) => r.entity === 'universities')
                  .map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
                    >
                      <code className="text-xs flex-1 font-mono text-slate-700 dark:text-slate-200">
                        {JSON.stringify(r.filter)}
                      </code>
                      <button
                        onClick={() => void remove(r.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                        aria-label="Снять ограничения"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Правила
                </p>
                <button
                  type="button"
                  onClick={addField}
                  className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"
                >
                  <Plus size={12} /> Добавить правило
                </button>
              </div>

              {fields.map((f, i) => (
                <div
                  key={i}
                  className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-center"
                >
                  <select
                    value={f.key}
                    onChange={(e) => updateField(i, { key: e.target.value })}
                    className={selectClass}
                  >
                    {SCOPE_FIELDS.map((sf) => (
                      <option key={sf.key} value={sf.key}>
                        {sf.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={f.value}
                    onChange={(e) => updateField(i, { value: e.target.value })}
                    placeholder="Значение"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => removeField(i)}
                    disabled={fields.length === 1}
                    className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 disabled:opacity-40"
                    aria-label="Удалить правило"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" onClick={onClose}>
                Закрыть
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </div>
          </>
        )}
      </div>
    </SimpleModal>
  );
}