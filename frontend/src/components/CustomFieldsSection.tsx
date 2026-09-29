// frontend/src/components/CustomFieldsSection.tsx
import { useEffect, useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import type { CustomField } from '@/types';
import { Button, Field, inputClass, selectClass } from '@/components/ui';
import { upsertValues } from '@/lib/customFields';

interface Props {
  entityId: string;
  fields: CustomField[];
  values: Record<string, unknown>;
  canEdit: boolean;
  userId: string | null;
  onSaved: () => Promise<void>;
  onNotice: (msg: string) => void;
}

export function CustomFieldsSection({
  entityId,
  fields,
  values,
  canEdit,
  userId: _userId,
  onSaved,
  onNotice,
}: Props) {
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) return;
    const next: Record<string, unknown> = {};
    fields.forEach((f) => {
      next[f.id] = values[f.id] ?? defaultFor(f);
    });
    setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, JSON.stringify(values), dirty]);

  if (fields.length === 0) return null;

  const setValue = (id: string, v: unknown) => {
    setDraft((d) => ({ ...d, [id]: v }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const err = await upsertValues(fields, entityId, draft);
      if (err) {
        onNotice(`Ошибка: ${err}`);
        return;
      }
      onNotice('Кастомные поля сохранены.');
      setDirty(false);
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        Дополнительные поля
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <Field key={f.id} label={f.label} hint={f.help_text ?? undefined}>
            {renderInput(f, draft[f.id], (v) => setValue(f.id, v), !canEdit)}
          </Field>
        ))}
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void save()}
            disabled={!dirty || saving}
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Сохранение…
              </>
            ) : (
              <>
                <Save size={14} /> Сохранить поля
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function defaultFor(f: CustomField): unknown {
  if (f.field_type === 'bool') return false;
  if (f.field_type === 'multiselect') return [];
  return '';
}

function renderInput(
  field: CustomField,
  value: unknown,
  onChange: (v: unknown) => void,
  disabled: boolean,
) {
  switch (field.field_type) {
    case 'number':
      return (
        <input
          type="number"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          disabled={disabled}
          className={inputClass}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={typeof value === 'string' ? value.slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inputClass}
        />
      );

    case 'bool':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 rounded border-slate-300 text-sky-600"
          />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {Boolean(value) ? 'Да' : 'Нет'}
          </span>
        </label>
      );

    case 'select':
      return (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={selectClass}
        >
          <option value="">— не выбрано —</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );

    case 'multiselect': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-2">
          {field.options.length === 0 ? (
            <span className="text-xs text-slate-400">Нет опций</span>
          ) : (
            field.options.map((o) => {
              const checked = arr.includes(o);
              return (
                <label
                  key={o}
                  className={`px-2 py-1 rounded-lg text-xs cursor-pointer transition-colors ${
                    checked
                      ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...arr, o]
                        : arr.filter((x) => x !== o);
                      onChange(next);
                    }}
                  />
                  {o}
                </label>
              );
            })
          )}
        </div>
      );
    }

    case 'url':
      return (
        <input
          type="url"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inputClass}
          placeholder="https://..."
        />
      );

    case 'email':
      return (
        <input
          type="email"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inputClass}
        />
      );

    case 'phone':
      return (
        <input
          type="tel"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inputClass}
          placeholder="+7 ..."
        />
      );

    default:
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inputClass}
        />
      );
  }
}