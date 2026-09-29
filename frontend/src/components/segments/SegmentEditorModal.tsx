import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Segment, SegmentRule } from '@/types';
import {
  createSegment,
  updateSegment,
  SEGMENT_FIELDS,
  SEGMENT_OPERATORS,
} from '@/lib/segments';
import {
  SimpleModal,
  Button,
  Field,
  inputClass,
  selectClass,
} from '@/components/ui';

interface Props {
  segment: Segment | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onNotice: (msg: string) => void;
}

/**
 * Редактор сегмента: правила с AND / OR, цвет, общий доступ.
 */
export function SegmentEditorModal({ segment, onClose, onSaved, onNotice }: Props) {
  const [name, setName] = useState(segment?.name ?? '');
  const [description, setDescription] = useState(segment?.description ?? '');
  const [rules, setRules] = useState<SegmentRule[]>(
    segment?.rules ?? [{ field: 'status', operator: 'equals', value: 'Новый' }],
  );
  const [logic, setLogic] = useState<'AND' | 'OR'>(segment?.logic ?? 'AND');
  const [shared, setShared] = useState(segment?.shared ?? false);
  const [saving, setSaving] = useState(false);

  const addRule = () =>
    setRules([...rules, { field: 'city', operator: 'contains', value: '' }]);
  const updateRule = (i: number, patch: Partial<SegmentRule>) =>
    setRules(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRule = (i: number) => setRules(rules.filter((_, idx) => idx !== i));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { onNotice('Введите название.'); return; }
    if (rules.length === 0) { onNotice('Добавьте хотя бы одно правило.'); return; }

    setSaving(true);
    if (segment) {
      const err = await updateSegment(segment.id, {
        name,
        description: description || null,
        rules,
        logic,
        shared,
      });
      setSaving(false);
      if (err) { onNotice(`Ошибка: ${err}`); return; }
      onNotice('Сегмент обновлён.');
    } else {
      const s = await createSegment({ name, description, rules, logic, shared });
      setSaving(false);
      if (!s) { onNotice('Не удалось создать сегмент.'); return; }
      onNotice('Сегмент создан.');
    }
    await onSaved();
    onClose();
  };

  return (
    <SimpleModal title={segment ? 'Редактировать сегмент' : 'Новый сегмент'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Название" wide>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Без касаний 14 дней"
              className={inputClass}
            />
          </Field>
          <Field label="Описание" wide>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">Логика:</span>
          <select
            value={logic}
            onChange={(e) => setLogic(e.target.value as 'AND' | 'OR')}
            className={`${selectClass} w-32`}
          >
            <option value="AND">И (все)</option>
            <option value="OR">ИЛИ (любое)</option>
          </select>
          <div className="flex-1" />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-sky-600"
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">Общий</span>
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Правила
            </p>
            <button
              type="button"
              onClick={addRule}
              className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              <Plus size={12} /> Добавить правило
            </button>
          </div>

          {rules.map((r, i) => {
            const fieldDef = SEGMENT_FIELDS.find((f) => f.value === r.field);
            const operators = SEGMENT_OPERATORS[fieldDef?.type ?? 'text'];
            const noValue = r.operator === 'empty' || r.operator === 'not_empty';
            return (
              <div
                key={i}
                className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60"
              >
                <select
                  value={r.field}
                  onChange={(e) => updateRule(i, { field: e.target.value })}
                  className={selectClass}
                >
                  {SEGMENT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select
                  value={r.operator}
                  onChange={(e) => updateRule(i, { operator: e.target.value as SegmentRule['operator'] })}
                  className={selectClass}
                >
                  {operators.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input
                  value={Array.isArray(r.value) ? r.value.join(',') : String(r.value ?? '')}
                  onChange={(e) => updateRule(i, { value: e.target.value })}
                  placeholder="Значение"
                  disabled={noValue}
                  className={`${inputClass} disabled:opacity-50`}
                />
                <button
                  type="button"
                  onClick={() => removeRule(i)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" type="button" onClick={onClose}>Отмена</Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Сохранение…' : (segment ? 'Сохранить' : 'Создать')}
          </Button>
        </div>
      </form>
    </SimpleModal>
  );
}