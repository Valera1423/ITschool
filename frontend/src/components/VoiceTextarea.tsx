// frontend/src/components/VoiceTextarea.tsx
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { textareaClass } from '@/components/ui';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  onNotice?: (msg: string) => void;
}

/**
 * Textarea с кнопкой голосового ввода.
 * Использует Web Speech API, поддерживается в Chrome/Edge/Safari.
 */
export function VoiceTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled,
  onNotice,
}: Props) {
  const { supported, listening, toggle } = useVoiceInput({
    lang: 'ru-RU',
    onResult: (transcript) => {
      onChange(transcript);
    },
    onError: (msg) => onNotice?.(msg),
  });

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`${textareaClass} pr-12`}
      />

      {supported && (
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          title={listening ? 'Остановить запись' : 'Голосовой ввод'}
          className={`absolute top-2 right-2 p-2 rounded-lg transition-colors ${
            listening
              ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 animate-pulse'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600'
          } disabled:opacity-50`}
          aria-label={listening ? 'Остановить запись' : 'Голосовой ввод'}
        >
          {listening ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
      )}

      {listening && (
        <span className="absolute bottom-2 left-3 text-[10px] text-rose-500 font-medium">
          ● Запись… Говорите
        </span>
      )}
    </div>
  );
}

// Loader2 импорт оставлен для совместимости (не используется в этом варианте)
void Loader2;