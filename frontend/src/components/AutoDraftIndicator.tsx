import { Check, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function AutoDraftIndicator({
  savedAt,
  onClear,
}: {
  savedAt: number | null;
  onClear: () => void;
}) {
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  if (!savedAt) return null;

  const secondsAgo = Math.floor((Date.now() - savedAt) / 1000);
  const label =
    secondsAgo < 5
      ? 'сейчас'
      : secondsAgo < 60
        ? `${secondsAgo} сек назад`
        : `${Math.floor(secondsAgo / 60)} мин назад`;

  return (
    <div className="flex items-center gap-2 atmr-desc-l text-atmr-fg-muted mt-2">
      <Check size={12} className="text-atmr-success" />
      Черновик сохранён {label}
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-atmr-fg-muted hover:text-atmr-error flex items-center gap-0.5 transition-colors duration-atmr-fast"
      >
        <Trash2 size={11} /> Сбросить
      </button>
    </div>
  );
}