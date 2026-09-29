import { useEffect, useRef, useState } from 'react';
import { Paperclip, X, FileText, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { StorageClient } from '@/lib/storageClient';
import { Avatar } from '@/components/ui';

interface User {
  id: string;
  email: string;
  full_name: string;
}

export interface CommentAttachment {
  name: string;
  url: string;
  size?: number;
  mime?: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  attachments?: CommentAttachment[];
  onAttachmentsChange?: (list: CommentAttachment[]) => void;
  /** Обязателен, если нужно загружать файлы */
  universityId?: string;
  placeholder?: string;
  className?: string;
  onNotice?: (msg: string) => void;
}

export function CommentMentionsInput({
  value,
  onChange,
  attachments = [],
  onAttachmentsChange,
  universityId,
  placeholder,
  className,
  onNotice,
}: Props) {
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursor, setCursor] = useState<{ start: number; query: string } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api.get<User[]>('/users').then(setUsers).catch(() => {});
  }, []);

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);

    const pos = e.target.selectionStart ?? 0;
    const before = val.slice(0, pos);
    const match = before.match(/@([a-zA-Z0-9._-]*)$/);

    if (match) {
      const q = match[1].toLowerCase();
      const filtered = users
        .filter((u) =>
          u.email.toLowerCase().includes(q) ||
          u.full_name.toLowerCase().includes(q),
        )
        .slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setCursor({ start: pos - match[0].length, query: q });
    } else {
      setShowSuggestions(false);
    }
  };

  const insertMention = (user: User) => {
    if (!cursor || !inputRef.current) return;
    const before = value.slice(0, cursor.start);
    const after = value.slice(cursor.start + cursor.query.length + 1);
    const newValue = `${before}@${user.email} ${after}`;
    onChange(newValue);
    setShowSuggestions(false);
    inputRef.current.focus();
  };

  /**
   * Загрузка вложения. Файлы кладём в /storage/upload, в комментарий
   * уходят только URL и метаданные — единый формат для всех вложений.
   */
  const handleUpload = async (file: File) => {
    if (!universityId || !onAttachmentsChange) return;
    setUploading(true);
    try {
      const client = new StorageClient();
      const doc = await client.upload({
        file,
        universityId,
        category: 'Комментарий',
      });
      const url = client.publicUrl(doc.storagePath);
      onAttachmentsChange([
        ...attachments,
        { name: file.name, url, size: file.size, mime: file.type },
      ]);
    } catch (e) {
      onNotice?.(e instanceof Error ? e.message : 'Не удалось загрузить файл');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAttachment = (idx: number) => {
    onAttachmentsChange?.(attachments.filter((_, i) => i !== idx));
  };

  const showAttach = !!universityId && !!onAttachmentsChange;

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        value={value}
        onChange={onInput}
        placeholder={placeholder}
        className={className}
      />

      {showAttach && (
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600 disabled:opacity-50"
            title="Прикрепить файл"
            aria-label="Прикрепить файл"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Paperclip size={14} />
            )}
          </button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {attachments.map((a, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 max-w-[220px]"
            >
              <FileText size={11} className="flex-shrink-0" />
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:text-sky-600"
              >
                {a.name}
              </a>
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="text-slate-400 hover:text-rose-500 flex-shrink-0"
                aria-label="Убрать вложение"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {showSuggestions && (
        <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-lg w-72 z-10 max-h-48 overflow-y-auto">
          {suggestions.map((u) => (
            <button
              key={u.id}
              onClick={() => insertMention(u)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
            >
              <Avatar name={u.full_name} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                  {u.full_name}
                </p>
                <p className="text-xs text-slate-400 truncate">{u.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}