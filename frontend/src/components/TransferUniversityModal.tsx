// frontend/src/components/TransferUniversityModal.tsx
import { useState, type FormEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
import type { University, Manager } from '@/types';
import { transferUniversity } from '@/lib/transfers';
import {
  SimpleModal,
  Button,
  Field,
  selectClass,
  textareaClass,
} from '@/components/ui';

interface Props {
  university: University;
  managers: Manager[];
  onClose: () => void;
  onTransferred: () => Promise<void>;
  onNotice: (msg: string) => void;
}

/**
 * Модалка передачи вуза другому менеджеру.
 *
 * - Показывает текущего ответственного
 * - Позволяет выбрать нового из списка активных менеджеров,
 *   исключая текущего
 * - Опциональный комментарий для истории версий
 * - После успеха вызывает onTransferred (родитель перезагружает данные)
 */
export function TransferUniversityModal({
  university,
  managers,
  onClose,
  onTransferred,
  onNotice,
}: Props) {
  const [toManagerId, setToManagerId] = useState('');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  // Исключаем текущего менеджера и неактивных
  const eligible = managers.filter(
    (m) => m.active && m.id !== university.manager_id,
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!toManagerId) return;
    setSending(true);
    const err = await transferUniversity(
      university.id,
      toManagerId,
      comment || undefined,
    );
    setSending(false);
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    await onTransferred();
    onClose();
  };

  return (
    <SimpleModal title={`Передать «${university.name}»`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs">
          <p className="text-slate-500 dark:text-slate-400 mb-0.5">
            Текущий ответственный
          </p>
          <p className="font-medium text-slate-700 dark:text-slate-200">
            {university.manager}
          </p>
        </div>

        <Field label="Новый ответственный">
          <select
            value={toManagerId}
            onChange={(e) => setToManagerId(e.target.value)}
            required
            className={selectClass}
          >
            <option value="">— выберите —</option>
            {eligible.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Комментарий (необязательно)">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Причина передачи, контекст…"
            className={textareaClass}
          />
        </Field>

        <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-3 text-xs text-sky-700 dark:text-sky-300">
          Новый менеджер и бывший получат уведомление. Передача зафиксируется
          в истории версий вуза.
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={sending || !toManagerId}>
            {sending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            {sending ? 'Передача…' : 'Передать'}
          </Button>
        </div>
      </form>
    </SimpleModal>
  );
}