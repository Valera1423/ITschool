import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  AutomationRule,
  RuleCondition,
  RuleAction,
  TriggerType,
  ConditionOperator,
  ActionType,
} from '@/types';
import {
  createRule,
  updateRule,
  TRIGGER_FIELDS_BY_ENTITY,
  CONDITION_OPERATORS,
  ACTION_LABELS,
} from '@/lib/automation';
import {
  SimpleModal,
  Button,
  Field,
  inputClass,
  selectClass,
  textareaClass,
} from '@/components/ui';

interface Props {
  rule: AutomationRule | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onNotice: (msg: string) => void;
}

/**
 * Редактор правил автоматизации «если — то».
 * Простой UI: триггер → условия (И) → действия.
 */
export function RuleEditorModal({ rule, onClose, onSaved, onNotice }: Props) {
  const [name, setName] = useState(rule?.name ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [triggerType, setTriggerType] = useState<TriggerType>(
    rule?.trigger_type ?? 'on_field_change',
  );
  const [triggerField, setTriggerField] = useState<string>(
    (rule?.trigger_config as { field?: string })?.field ?? 'status',
  );
  const [triggerTo, setTriggerTo] = useState<string>(
    (rule?.trigger_config as { to?: string })?.to ?? 'Отказ',
  );
  const [conditions, setConditions] = useState<RuleCondition[]>(rule?.conditions ?? []);
  const [actions, setActions] = useState<RuleAction[]>(
    rule?.actions ?? [
      {
        type: 'create_task',
        params: { title: '', priority: 'Средний', due_days: 3, assignee_from_field: 'manager' },
      },
    ],
  );
  const [saving, setSaving] = useState(false);

  const fields = TRIGGER_FIELDS_BY_ENTITY['universities'];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { onNotice('Введите название.'); return; }
    if (actions.length === 0) { onNotice('Добавьте хотя бы одно действие.'); return; }

    setSaving(true);
    const trigger_config =
      triggerType === 'on_field_change' ? { field: triggerField, to: triggerTo } : {};
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      trigger_type: triggerType,
      trigger_config,
      conditions,
      actions,
    };

    if (rule) {
      const err = await updateRule(rule.id, payload);
      if (err) { onNotice(`Ошибка: ${err}`); setSaving(false); return; }
      onNotice('Правило обновлено.');
    } else {
      const { error } = await createRule(payload);
      if (error) { onNotice(`Ошибка: ${error}`); setSaving(false); return; }
      onNotice('Правило создано.');
    }
    setSaving(false);
    await onSaved();
    onClose();
  };

  const addCondition = () =>
    setConditions([...conditions, { field: 'status', operator: 'equals', value: '' }]);
  const updateCondition = (i: number, patch: Partial<RuleCondition>) =>
    setConditions(conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCondition = (i: number) =>
    setConditions(conditions.filter((_, idx) => idx !== i));

  const addAction = () =>
    setActions([
      ...actions,
      {
        type: 'create_task',
        params: { title: '', priority: 'Средний', due_days: 3, assignee_from_field: 'manager' },
      },
    ]);
  const updateAction = (i: number, patch: Partial<RuleAction>) =>
    setActions(actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const removeAction = (i: number) =>
    setActions(actions.filter((_, idx) => idx !== i));

  return (
    <SimpleModal title={rule ? 'Редактировать правило' : 'Новое правило'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Название" wide>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="При отказе — создать задачу"
              className={inputClass}
            />
          </Field>
          <Field label="Описание" wide>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Коротко: что делает правило"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Триггер
          </p>
          <Field label="Тип триггера">
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as TriggerType)}
              className={selectClass}
            >
              <option value="on_create">При создании записи</option>
              <option value="on_field_change">При смене поля</option>
              <option value="on_update">При любом изменении</option>
            </select>
          </Field>
          {triggerType === 'on_field_change' && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Поле">
                <select
                  value={triggerField}
                  onChange={(e) => setTriggerField(e.target.value)}
                  className={selectClass}
                >
                  {fields.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Становится равным">
                <input
                  value={triggerTo}
                  onChange={(e) => setTriggerTo(e.target.value)}
                  placeholder="Отказ"
                  className={inputClass}
                />
              </Field>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Дополнительные условия (И)
            </p>
            <button
              type="button"
              onClick={addCondition}
              className="text-xs font-medium text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              <Plus size={12} /> Добавить
            </button>
          </div>
          {conditions.length === 0 && (
            <p className="text-sm text-slate-400">Условий нет — правило сработает при триггере.</p>
          )}
          {conditions.map((c, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
              <select
                value={c.field}
                onChange={(e) => updateCondition(i, { field: e.target.value })}
                className={selectClass}
              >
                {fields.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <select
                value={c.operator}
                onChange={(e) => updateCondition(i, { operator: e.target.value as ConditionOperator })}
                className={selectClass}
              >
                {CONDITION_OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                value={Array.isArray(c.value) ? c.value.join(',') : String(c.value ?? '')}
                onChange={(e) => updateCondition(i, { value: e.target.value })}
                placeholder="Значение"
                disabled={c.operator === 'empty' || c.operator === 'not_empty'}
                className={`${inputClass} disabled:opacity-50`}
              />
              <button
                type="button"
                onClick={() => removeCondition(i)}
                className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Действия
            </p>
            <button
              type="button"
              onClick={addAction}
              className="text-xs font-medium text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              <Plus size={12} /> Добавить
            </button>
          </div>
          {actions.map((a, i) => (
            <div key={i} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={a.type}
                  onChange={(e) => {
                    const type = e.target.value as ActionType;
                    const defaults: Record<ActionType, Record<string, unknown>> = {
                      create_task: { title: '', priority: 'Средний', due_days: 3, assignee_from_field: 'manager' },
                      create_interaction: { type: 'Звонок', title: '' },
                      update_field: { field: 'status', value: '' },
                      send_notification: { message: '' },
                      send_email: { subject: '', body: '' },
                      send_telegram: { message: '' },
                      add_tag: { tag_id: '' },
                      remove_tag: { tag_id: '' },
                      assign_manager: { manager: '' },
                    };
                    updateAction(i, { type, params: defaults[type] });
                  }}
                  className={`${selectClass} flex-1`}
                >
                  {Object.entries(ACTION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeAction(i)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {a.type === 'create_task' && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    value={String(a.params.title ?? '')}
                    onChange={(e) => updateAction(i, { params: { ...a.params, title: e.target.value } })}
                    placeholder="Название задачи"
                    className={`${inputClass} sm:col-span-2`}
                  />
                  <select
                    value={String(a.params.priority ?? 'Средний')}
                    onChange={(e) => updateAction(i, { params: { ...a.params, priority: e.target.value } })}
                    className={selectClass}
                  >
                    {['Низкий', 'Средний', 'Высокий', 'Срочный'].map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <input
                    type="number"
                    value={String(a.params.due_days ?? 3)}
                    onChange={(e) => updateAction(i, { params: { ...a.params, due_days: Number(e.target.value) } })}
                    placeholder="Через N дней"
                    className={inputClass}
                  />
                </div>
              )}

              {a.type === 'create_interaction' && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    value={String(a.params.title ?? '')}
                    onChange={(e) => updateAction(i, { params: { ...a.params, title: e.target.value } })}
                    placeholder="Название контакта"
                    className={`${inputClass} sm:col-span-2`}
                  />
                  <select
                    value={String(a.params.type ?? 'Звонок')}
                    onChange={(e) => updateAction(i, { params: { ...a.params, type: e.target.value } })}
                    className={selectClass}
                  >
                    {['Звонок', 'Встреча', 'Письмо', 'Документ'].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {a.type === 'update_field' && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <select
                    value={String(a.params.field ?? 'status')}
                    onChange={(e) => updateAction(i, { params: { ...a.params, field: e.target.value } })}
                    className={selectClass}
                  >
                    {fields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <input
                    value={String(a.params.value ?? '')}
                    onChange={(e) => updateAction(i, { params: { ...a.params, value: e.target.value } })}
                    placeholder="Значение"
                    className={inputClass}
                  />
                </div>
              )}

              {a.type === 'send_notification' && (
                <textarea
                  value={String(a.params.message ?? '')}
                  onChange={(e) => updateAction(i, { params: { ...a.params, message: e.target.value } })}
                  placeholder="Текст уведомления"
                  rows={2}
                  className={textareaClass}
                />
              )}

              {(a.type === 'send_email' || a.type === 'send_telegram') && (
                <div className="space-y-2">
                  {a.type === 'send_email' && (
                    <input
                      value={String(a.params.subject ?? '')}
                      onChange={(e) => updateAction(i, { params: { ...a.params, subject: e.target.value } })}
                      placeholder="Тема письма"
                      className={inputClass}
                    />
                  )}
                  <textarea
                    value={String(a.params.message ?? a.params.body ?? '')}
                    onChange={(e) => updateAction(i, { params: { ...a.params, message: e.target.value } })}
                    placeholder="Текст"
                    rows={2}
                    className={textareaClass}
                  />
                </div>
              )}

              {a.type === 'assign_manager' && (
                <input
                  value={String(a.params.manager ?? '')}
                  onChange={(e) => updateAction(i, { params: { ...a.params, manager: e.target.value } })}
                  placeholder="ФИО менеджера"
                  className={inputClass}
                />
              )}

              {(a.type === 'add_tag' || a.type === 'remove_tag') && (
                <input
                  value={String(a.params.tag_id ?? '')}
                  onChange={(e) => updateAction(i, { params: { ...a.params, tag_id: e.target.value } })}
                  placeholder="ID тега"
                  className={inputClass}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" type="button" onClick={onClose}>Отмена</Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Сохранение…' : (rule ? 'Сохранить' : 'Создать')}
          </Button>
        </div>
      </form>
    </SimpleModal>
  );
}