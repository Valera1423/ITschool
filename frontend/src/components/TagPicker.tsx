import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Tag } from '@/types';
import { createTag, TAG_COLORS } from '@/lib/tags';
import { colorClasses } from '@/lib/colors';
import { SimpleModal, Button, Field, inputClass } from '@/components/ui';

interface Props {
  allTags: Tag[];
  selected: string[];
  onChange: (ids: string[]) => Promise<void>;
  canEdit: boolean;
  onNotice: (msg: string) => void;
  onTagCreated: () => void;
}

export function TagPicker({
  allTags, selected, onChange, canEdit, onNotice, onTagCreated,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedTags = useMemo(
    () => allTags.filter((t) => selected.includes(t.id)),
    [allTags, selected],
  );

  const availableTags = useMemo(
    () => allTags.filter((t) => !selected.includes(t.id)),
    [allTags, selected],
  );

  const toggle = async (id: string) => {
    if (!canEdit) return;
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];

    setBusy(true);
    try {
      await onChange(next);
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="atmr-desc-l-strong text-atmr-fg-soft uppercase tracking-wide">
          Теги
        </p>
        {canEdit && (
          <button
            onClick={() => setCreating(true)}
            className="atmr-desc-l-strong text-atmr-accent hover:text-atmr-accent-hover flex items-center gap-1 transition-colors duration-atmr-fast"
          >
            <Plus size={12} /> Создать тег
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {selectedTags.map((t) => {
          const c = colorClasses(t.color);
          return (
            <span
              key={t.id}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-atmr-m atmr-desc-l-strong ${c.bg} ${c.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              {t.name}
              {canEdit && (
                <button
                  onClick={() => void toggle(t.id)}
                  disabled={busy}
                  className="opacity-60 hover:opacity-100 transition-opacity duration-atmr-fast"
                  aria-label="Снять тег"
                >
                  <X size={11} />
                </button>
              )}
            </span>
          );
        })}

        {canEdit && availableTags.length > 0 && (
          <select
            value=""
            disabled={busy}
            onChange={(e) => {
              const id = e.target.value;
              e.target.value = '';
              if (id) void toggle(id);
            }}
            className="atmr-desc-l px-2 py-1 rounded-atmr-m bg-atmr-bg-surface2 text-atmr-fg-soft border-0 focus:outline-none focus:ring-1 focus:ring-atmr-accent cursor-pointer transition-colors duration-atmr-fast"
          >
            <option value="">+ добавить тег</option>
            {availableTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        {selectedTags.length === 0 && !canEdit && (
          <span className="atmr-desc-l text-atmr-fg-muted">Нет тегов</span>
        )}
      </div>

      {creating && (
        <CreateTagModal
          onClose={() => setCreating(false)}
          onCreated={async (tag) => {
            onNotice(`Тег «${tag.name}» создан.`);
            setCreating(false);
            onTagCreated();
            await onChange([...selected, tag.id]);
          }}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}

function CreateTagModal({
  onClose, onCreated, onNotice,
}: {
  onClose: () => void;
  onCreated: (tag: Tag) => void | Promise<void>;
  onNotice: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('sky');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const tag = await createTag(name.trim(), color);
    setSaving(false);
    if (!tag) {
      onNotice('Не удалось создать тег.');
      return;
    }
    await onCreated(tag);
  };

  return (
    <SimpleModal title="Новый тег" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Название">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, VIP"
            className={inputClass}
          />
        </Field>

        <Field label="Цвет">
          <div className="flex gap-2">
            {TAG_COLORS.map((c) => {
              const cls = colorClasses(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-atmr-full ${cls.dot} transition-transform duration-atmr-fast ${
                    color === c
                      ? 'ring-2 ring-offset-2 ring-atmr-fg-muted dark:ring-offset-slate-900 scale-110'
                      : 'hover:scale-110'
                  }`}
                  aria-label={`Цвет ${c}`}
                />
              );
            })}
          </div>
        </Field>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!name.trim() || saving}
          >
            {saving ? 'Создание…' : 'Создать'}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}