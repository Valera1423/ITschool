import { useState } from 'react';
import { Save, Pin } from 'lucide-react';
import { SimpleModal, Button, Field, inputClass } from '@/components/ui';
import { TAG_COLORS, tagColor } from '@/lib/tags';

interface Props {
  onClose: () => void;
  onSave: (data: {
    name: string;
    color: string;
    shared: boolean;
    pinned: boolean;
  }) => Promise<void>;
}

/**
 * Модалка «Сохранить вид» — сохраняет текущие фильтры как переиспользуемый чип.
 */
export function SaveViewModal({ onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('sky');
  const [shared, setShared] = useState(false);
  const [pinned, setPinned] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), color, shared, pinned });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SimpleModal title="Сохранить вид" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Название">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, Переговоры в Москве"
            className={inputClass}
          />
        </Field>

        <Field label="Цвет">
          <div className="flex gap-2">
            {TAG_COLORS.map((c) => {
              const cls = tagColor(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full ${cls.dot} transition-transform ${
                    color === c
                      ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 scale-110'
                      : 'hover:scale-110'
                  }`}
                  title={c}
                />
              );
            })}
          </div>
        </Field>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Pin size={13} /> Закрепить в сайдбаре
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            Сделать общим для команды
          </span>
        </label>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={() => void submit()} disabled={!name.trim() || saving}>
            <Save size={14} /> {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}