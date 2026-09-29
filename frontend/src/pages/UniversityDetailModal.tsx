import { useState } from 'react';
import {
  MessageSquare,
  Mail,
  FileText,
  Send,
  Check,
  Info,
  History,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import type { University, CustomField, CustomFieldValue, Tag } from '@/types';
import {
  SimpleModal,
  Button,
  Avatar,
  StatusBadge,
  EmptyState,
  Field,
  inputClass,
  textareaClass,
} from '@/components/ui';
import { MessengerLinks } from '@/components/MessengerLinks';
import { DocumentsList } from '@/components/DocumentsList';
import { CustomFieldsSection } from '@/components/CustomFieldsSection';
import { TagPicker } from '@/components/TagPicker';
import { UniversityTimeline } from '@/components/UniversityTimeline';
import { UniversityContactsList } from '@/components/UniversityContactsList';
import { WorkflowProgress } from '@/components/workflow/WorkflowProgress';
import { WorkflowDiagram } from '@/components/workflow/WorkflowDiagram';
import { TransitionModal } from '@/components/workflow/TransitionModal';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomFields } from '@/hooks/useCustomFields';
import { useWorkflowStatuses } from '@/hooks/queries/useCatalogs';
import { useTags } from '@/hooks/useTags';
import { useUniversityTags } from '@/hooks/useTags';
import { formatDate, formatDateTime } from '@/lib/utils';
import { mailto } from '@/lib/utils';

/**
 * Детальная карточка вуза.
 *
 * Табы:
 * - Информация: контакты, документы, кастомные поля, теги, комментарии
 * - Workflow: список или диаграмма шагов
 * - Лента: единый timeline событий
 *
 * Модалка сама подтягивает связанные данные (документы, workflow, timeline),
 * чтобы не грузить их в основном списке.
 */
interface Props {
  university: University;
  customFields: CustomField[];
  customValues: Record<string, CustomFieldValue>;
  tagIds: string[];
  allTags: Tag[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onNotice: (msg: string) => void;
}

type Tab = 'info' | 'workflow' | 'timeline';

export function UniversityDetailModal({
  university,
  customFields,
  customValues,
  tagIds,
  allTags,
  onClose,
  onRefresh,
  onNotice,
}: Props) {
  const api = useApi();
  const { user } = useAuth();
  const { data: statuses = [] } = useWorkflowStatuses();
  const [tab, setTab] = useState<Tab>('info');
  const [wfView, setWfView] = useState<'list' | 'diagram'>('list');
  const [transitionStep, setTransitionStep] = useState<any | null>(null);
  const [emailModal, setEmailModal] = useState(false);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [workflowData, setWorkflowData] = useState<any | null>(null);

  // Загрузка детальных данных
  const loadDetail = async () => {
    try {
      const [w, c] = await Promise.all([
        api.get<any>(`/workflows/universities/${university.id}`).catch(() => null),
        api.get<any[]>(`/universities/${university.id}/comments`).catch(() => []),
      ]);
      setWorkflowData(w);
      setComments(c);
    } catch {
      // ignore
    }
  };

  // Загружаем один раз при открытии
  useState(() => {
    void loadDetail();
  });

  const addComment = async () => {
    if (!comment.trim()) return;
    try {
      await api.post(`/universities/${university.id}/comments`, {
        body: comment.trim(),
      });
      setComment('');
      await loadDetail();
      onNotice('Комментарий добавлен.');
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  const changeStatus = async (status: string) => {
    try {
      await api.patch(`/universities/${university.id}`, { status });
      onRefresh();
      onNotice(`Статус: ${status}`);
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  const sendEmail = (subject: string, body: string) => {
    if (!university.contact_email) {
      onNotice('Не указан email.');
      return;
    }
    mailto(university.contact_email, subject, body);
    onNotice('Почта открыта.');
    setEmailModal(false);
  };

  // Значения кастомных полей в формате {fieldId: value}
  const valuesMap: Record<string, unknown> = {};
  customFields.forEach((f) => {
    const row = customValues[f.id];
    valuesMap[f.id] = row
      ? row.value_text ??
        row.value_number ??
        row.value_date ??
        row.value_bool ??
        row.value_json ??
        ''
      : f.field_type === 'bool'
        ? false
        : f.field_type === 'multiselect'
          ? []
          : '';
  });

  return (
    <SimpleModal title={university.name} onClose={onClose} wide>
      <div className="space-y-5">
        {/* Шапка */}
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={university.status} />
          <span className="text-sm text-slate-400">
            {university.city} · {university.direction}
          </span>
          {university.license_signed && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 px-2 py-1 rounded-lg">
              <Check size={14} />Лицензия
              {university.license_expires_at
                ? ` до ${formatDate(university.license_expires_at)}`
                : ''}
            </span>
          )}
        </div>

        {/* Табы */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {(
            [
              { key: 'info', label: 'Информация', icon: Info },
              { key: 'workflow', label: 'Workflow', icon: WorkflowIcon },
              { key: 'timeline', label: 'Лента', icon: History },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Таб: Информация */}
        {tab === 'info' && (
          <>
            {/* Теги */}
            <TagPicker
              allTags={allTags}
              selected={tagIds}
              onChange={async (ids) => {
                await api.post(`/universities/${university.id}/tags/set`, {
                  tag_ids: ids,
                });
                await onRefresh();
              }}
              canEdit={!!user}
              onNotice={onNotice}
              onTagCreated={async () => {
                /* перезагрузка тегов */
              }}
            />

            {/* Карточки с данными */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <p className="text-xs text-slate-400 mb-1">Продукт</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {university.product}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <p className="text-xs text-slate-400 mb-1">Договор</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {university.contract_number ?? '—'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <p className="text-xs text-slate-400 mb-1">Контакт</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {university.contact_name ?? '—'}
                </p>
                {university.contact_phone && (
                  <p className="text-xs text-slate-400 mt-1">
                    {university.contact_phone}
                  </p>
                )}
                {university.contact_email && (
                  <p className="text-xs text-sky-600 mt-1">
                    {university.contact_email}
                  </p>
                )}
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <p className="text-xs text-slate-400 mb-1">Менеджер</p>
                <div className="flex items-center gap-2">
                  <Avatar name={university.manager} size="sm" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {university.manager}
                  </p>
                </div>
              </div>
            </div>

            {/* Мессенджеры */}
            <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-900/40">
              <p className="text-xs text-sky-700 dark:text-sky-300 mb-2 font-medium">
                Связаться
              </p>
              <MessengerLinks university={university} onNotice={onNotice} />
            </div>

            {/* Кастомные поля */}
            {customFields.length > 0 && (
              <CustomFieldsSection
                entityId={university.id}
                fields={customFields}
                values={valuesMap}
                canEdit={!!user}
                userId={user?.profileId ?? null}
                onSaved={onRefresh}
                onNotice={onNotice}
              />
            )}

            {/* Заметки */}
            {university.notes && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40">
                <p className="text-xs text-amber-600 mb-1">Заметки</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {university.notes}
                </p>
              </div>
            )}

            {/* Смена статуса */}
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Смена статуса
              </p>
              <div className="flex flex-wrap gap-2">
                {['Новый', 'Переговоры', 'Обучение', 'Внедрение', 'Партнёр', 'Отказ'].map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => void changeStatus(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        university.status === s
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Контакты от вуза */}
            <UniversityContactsList
              universityId={university.id}
              contacts={[]}
              canEdit={!!user}
              onRefresh={onRefresh}
              onNotice={onNotice}
            />

            {/* Документы */}
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Документы
              </p>
              <DocumentsList
                universityId={university.id}
                uploadedBy={user?.name ?? 'Пользователь'}
                canEdit={!!user}
                onNotice={onNotice}
              />
            </div>

            {/* Комментарии */}
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Комментарии ({comments.length})
              </p>
              {comments.length > 0 && (
                <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="flex gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
                    >
                      <Avatar name={c.author} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                            {c.author}
                          </p>
                          <p className="text-xs text-slate-400 whitespace-nowrap">
                            {formatDateTime(c.created_at)}
                          </p>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 break-words">
                          {c.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void addComment();
                    }
                  }}
                  placeholder={`Комментарий от ${user?.name ?? 'вас'}…`}
                  className={`${inputClass} flex-1`}
                />
                <Button
                  onClick={() => void addComment()}
                  disabled={!comment.trim()}
                >
                  Отправить
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Таб: Workflow */}
        {tab === 'workflow' && workflowData && (
          <>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setWfView('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  wfView === 'list'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                }`}
              >
                Список
              </button>
              <button
                onClick={() => setWfView('diagram')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  wfView === 'diagram'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                }`}
              >
                Диаграмма
              </button>
            </div>

            {wfView === 'list' ? (
              <WorkflowProgress
                steps={workflowData.workflow.steps}
                catalog={statuses}
                onStepClick={(s) => setTransitionStep(s)}
              />
            ) : (
              <WorkflowDiagram
                steps={workflowData.workflow.steps}
                catalog={statuses}
                onStepClick={(s) => setTransitionStep(s)}
              />
            )}
          </>
        )}

        {/* Таб: Timeline */}
        {tab === 'timeline' && (
          <UniversityTimeline universityId={university.id} />
        )}

        {/* Модалки */}
        {transitionStep && (
          <TransitionModal
            step={transitionStep}
            universityId={university.id}
            catalog={statuses}
            transitions={[]}
            actorName={user?.name ?? 'Пользователь'}
            onClose={() => setTransitionStep(null)}
            onSaved={async () => {
              await loadDetail();
              await onRefresh();
            }}
            onNotice={onNotice}
          />
        )}
      </div>
    </SimpleModal>
  );
}