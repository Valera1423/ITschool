import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, X } from 'lucide-react';

interface Props {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  canEdit?: boolean;
  className?: string;
  placeholder?: string;
}

export function InlineEdit({
  value, onSave, canEdit = true, className = '', placeholder = '—',
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    if (next === value.trim()) { setEditing(false); return; }
    if (!next) { setDraft(value); setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => { setDraft(value); setEditing(false); };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };

  if (!canEdit) {
    return <span className={className}>{value || placeholder}</span>;
  }

  if (!editing) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className={`text-left hover:bg-atmr-bg-surface2 rounded-atmr-s px-1 -mx-1 transition-colors duration-atmr-fast ${className}`}
        title="Нажмите, чтобы редактировать"
      >
        {value || <span className="text-atmr-fg-muted">{placeholder}</span>}
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => { if (!saving) cancel(); }}
        disabled={saving}
        className="w-full px-1.5 py-0.5 rounded-atmr-s border border-atmr-accent focus:outline-none focus:ring-1 focus:ring-atmr-accent bg-atmr-bg-surface1 text-atmr-fg atmr-body-s"
      />
      <button
        onClick={() => void commit()}
        disabled={saving}
        className="p-1 rounded-atmr-s text-atmr-success hover:bg-atmr-success-soft transition-colors duration-atmr-fast"
        aria-label="Сохранить"
      >
        <Check size={12} />
      </button>
      <button
        onClick={cancel}
        disabled={saving}
        className="p-1 rounded-atmr-s text-atmr-error hover:bg-atmr-error-soft transition-colors duration-atmr-fast"
        aria-label="Отмена"
      >
        <X size={12} />
      </button>
    </div>
  );
}