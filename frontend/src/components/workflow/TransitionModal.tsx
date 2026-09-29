// frontend/src/components/workflow/TransitionModal.tsx
import { useState, type FormEvent } from 'react';
import { Send, Upload, X, FileText, Sparkles, Loader2 } from 'lucide-react';
import type {
  WorkflowStep,
  WorkflowStatusCatalog,
  WorkflowTransition,
} from '@/types';
import { addTransition } from '@/lib/workflow';
import {
  SimpleModal,
  Button,
  Field,
  selectClass,
  textareaClass,
} from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { StorageClient } from '@/lib/storageClient';

/**
 * Модалка перехода между статусами workflow.
 *
 * По ТЗ:
 * - Комментарий ОБЯЗАТЕЛЕН
 * - Можно приложить файлы
 * - История переходов сохраняется
 * - Есть ИИ-подсказка по следующему шагу (rule-based + LLM)
 */
interface Props {
  step: WorkflowStep;
  universityId: string;
  catalog: WorkflowStatusCatalog[];
  transitions: WorkflowTransition[];
  actorName: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onNotice: (msg: string) => void;
}

export function TransitionModal({
  step,
  universityId,
  catalog,
  transitions,
  actorName,
  onClose,
  onSaved,
  onNotice,
}: Props) {
  const [newStatus, setNewStatus] = useState(step.status_code ?? 'in_progress');
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<
    { id: string; name: string; url: string; size?: number }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    suggestedNextStepId: string | null;
    reasoning: string;
    risks: string[];
    priority: 'low' | 'medium' | 'high';
  } | null>(null);

  /**
   * Загрузка вложения. Файлы идут в MinIO через backend,
   * в transition отправляются только documentId (attachmentDocumentIds).
   * Публичный URL храним локально — только для превью.
   */
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const client = new StorageClient();
      const result = await client.upload({
        file,
        universityId,
        category: 'Workflow',
      });

      // result — это document. Нужен его id, чтобы отправить на бэк
      // как attachmentDocumentId. URL оставим только для превью.
      setFiles((f) => [
        ...f,
        {
          id: result.id,
          name: result.name,
          url: client.publicUrl(result.storagePath),
        },
      ]);
    } catch (e) {
      onNotice(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      onNotice('Добавьте комментарий к переходу');
      return;
    }

    setSaving(true);
    const err = await addTransition({
      stepId: step.id,
      universityId,
      fromStatus: step.status_code,
      toStatus: newStatus,
      comment: comment.trim(),
      attachmentDocumentIds: files.map((f) => f.id),
      actorName,
    });
    setSaving(false);

    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }

    onNotice('Шаг обновлён.');
    await onSaved();
    onClose();
  };

  const askAi = async () => {
    setSuggesting(true);
    setSuggestion(null);
    try {
      const { userManager } = await import('@/lib/oidc');
      const user = await userManager.getUser();
      if (!user || user.expired) {
        onNotice('Сессия истекла.');
        return;
      }
      const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
      const res = await fetch(`${apiBase}/ai/suggest-workflow-step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({ universityId }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        data: {
          suggestedNextStepId: string | null;
          reasoning: string;
          risks: string[];
          priority: 'low' | 'medium' | 'high';
        };
      };
      setSuggestion(json.data);
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'не удалось'}`);
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <SimpleModal title={`Шаг: ${step.title}`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Текущий статус">
            <input
              readOnly
              value={
                catalog.find((c) => c.code === step.status_code)?.label ??
                step.status ??
                '—'
              }
              className={selectClass + ' bg-slate-50 dark:bg-slate-800'}
            />
          </Field>

          <Field label="Новый статус">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className={selectClass}
            >
              {catalog.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* ── ИИ-подсказка */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Подсказка ИИ
            </p>
            <button
              type="button"
              onClick={() => void askAi()}
              disabled={suggesting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 disabled:opacity-50"
            >
              {suggesting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {suggesting ? 'Думаем…' : 'Получить рекомендацию'}
            </button>
          </div>

          {suggestion && (
            <div className="rounded-xl border border-violet-100 dark:border-violet-900/40 bg-violet-50/60 dark:bg-violet-900/20 p-3 space-y-2">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {suggestion.reasoning}
              </p>
              {suggestion.risks.length > 0 && (
                <div className="space-y-1">
                  {suggestion.risks.map((r, i) => (
                    <p
                      key={i}
                      className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5"
                    >
                      ⚠️ {r}
                    </p>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`px-2 py-0.5 rounded font-medium ${
                    suggestion.priority === 'high'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40'
                      : suggestion.priority === 'medium'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40'
                  }`}
                >
                  {suggestion.priority === 'high'
                    ? 'Высокий приоритет'
                    : suggestion.priority === 'medium'
                      ? 'Средний приоритет'
                      : 'Низкий приоритет'}
                </span>
                {suggestion.suggestedNextStepId && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewStatus('in_progress');
                      // Поле newStatus — это statusCode, а не stepId.
                      // Поэтому реальную «подстановку» шага сделать нельзя
                      // без доступа к workflow_universities.current_step_id.
                      // Оставляем кнопку как визуальный сигнал менеджеру.
                    }}
                    className="text-violet-700 dark:text-violet-300 hover:underline"
                  >
                    Применить
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <Field label="Комментарий к переходу (обязательно)" wide>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
            rows={3}
            placeholder="Например: связались с Иваном Ивановым, встреча назначена на четверг"
            className={textareaClass}
          />
        </Field>

        <Field label="Файлы" wide>
          <div className="space-y-2">
            <label className="inline-flex">
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void handleUpload(f);
                }}
              />
              <span className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors">
                <Upload size={14} />
                {uploading ? 'Загрузка…' : 'Прикрепить файл'}
              </span>
            </label>

            {files.length > 0 && (
              <div className="space-y-1">
                {files.map((f, i) => (
                  <div
                    key={f.id ?? i}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs"
                  >
                    <FileText size={12} className="text-slate-400" />
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-sky-600 hover:underline truncate"
                    >
                      {f.name}
                    </a>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>

        {/* История переходов */}
        {transitions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              История переходов
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {transitions.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-slate-700 dark:text-slate-200">
                      {t.from_status ?? '—'} → {t.to_status}
                    </p>
                    <span className="text-xs text-slate-400">
                      {formatDateTime(t.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.actor_name}
                  </p>
                  {t.comment && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                      {t.comment}
                    </p>
                  )}
                  {t.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {t.attachments.map((a, i) => (
                        <a
                          key={a.id ?? `${a.name}-${i}`}
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-sky-600 hover:underline"
                          title={a.size ? `${(a.size / 1024).toFixed(0)} КБ` : undefined}
                        >
                          <FileText size={11} className="inline" /> {a.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={saving || !comment.trim()}>
            <Send size={14} />
            {saving ? 'Сохранение…' : 'Перейти'}
          </Button>
        </div>
      </form>
    </SimpleModal>
  );
}