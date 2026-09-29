// frontend/src/components/UniversityDetailModal.tsx
import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Download,
  FileText,
  History,
  Info,
  Printer,
  UserPlus,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import type {
  Comment,
  CustomField,
  CustomFieldValue,
  Tag,
  University,
  Workflow,
  WorkflowStatusCatalog,
  WorkflowStep,
  WorkflowTransition,
} from '@/types';
import {
  SimpleModal,
  Button,
  Avatar,
  StatusBadge,
  EmptyState,
  inputClass,
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
import { VersionsPanel } from '@/components/VersionsPanel';
import {
  CommentMentionsInput,
  type CommentAttachment,
} from '@/components/CommentMentionsInput';
import { TransferUniversityModal } from '@/components/TransferUniversityModal';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkflowStatuses } from '@/hooks/queries/useCatalogs';
import { useManagers } from '@/hooks/queries/useCatalogs';
import { exportUniversityToSap } from '@/lib/contracts';
import { exportUniversitiesSpreadsheet } from '@/lib/excel';
import { asArray, formatDate, formatDateTime, mailto } from '@/lib/utils';

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

type Tab = 'info' | 'workflow' | 'timeline' | 'versions';

interface WorkflowResponse {
  workflow: Workflow;
  currentStepId: string | null;
  status: string;
}

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
  const { data: statusesRaw = [] } = useWorkflowStatuses();
  const { data: allManagers = [] } = useManagers(true);
  const statuses = asArray<WorkflowStatusCatalog>(statusesRaw);

  const [tab, setTab] = useState<Tab>('info');
  const [wfView, setWfView] = useState<'list' | 'diagram'>('list');
  const [transitionStep, setTransitionStep] = useState<WorkflowStep | null>(null);
  const [comment, setComment] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<CommentAttachment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  const [workflowData, setWorkflowData] = useState<WorkflowResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true);
    try {
      const [w, c, t] = await Promise.all([
        api
          .get<WorkflowResponse>(`/workflows/universities/${university.id}`)
          .catch(() => null),
        api
          .get<Comment[]>(`/universities/${university.id}/comments`)
          .catch(() => [] as Comment[]),
        api
          .get<WorkflowTransition[]>(`/workflows/transitions/${university.id}`)
          .catch(() => [] as WorkflowTransition[]),
      ]);
      setWorkflowData(w);
      setComments(asArray(c));
      setTransitions(asArray(t));
    } finally {
      setLoadingDetail(false);
    }
  }, [api, university.id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const addComment = async () => {
    const body = comment.trim();
    if (!body) return;
    try {
      await api.post(`/universities/${university.id}/comments`, {
        body,
        attachments: commentAttachments,
      });
      setComment('');
      setCommentAttachments([]);
      await loadDetail();
      onNotice('Комментарий добавлен.');
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  const changeStatus = async (status: string) => {
    try {
      await api.patch(`/universities/${university.id}`, { status });
      onNotice(`Статус: ${status}`);
      await onRefresh();
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
  };

  const handlePrint = () => {
    setTab('info');
    setTimeout(() => window.print(), 100);
  };

  const valuesMap: Record<string, unknown> = {};
  customFields.forEach((f) => {
    const row = customValues[f.id];
    valuesMap[f.id] = row
      ? (row.value_text ??
        row.value_number ??
        row.value_date ??
        row.value_bool ??
        row.value_json ??
        '')
      : f.field_type === 'bool'
        ? false
        : f.field_type === 'multiselect'
          ? []
          : '';
  });

  const stepTransitions = transitionStep
    ? transitions.filter((t) => t.step_id === transitionStep.id)
    : [];

  return (
    <SimpleModal title={university.name} onClose={onClose} wide>
      <div className="space-y-5 print-area">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={university.status} />
          <span className="text-sm text-slate-400">
            {university.city} · {university.direction}
          </span>
          {university.license_signed && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 px-2 py-1 rounded-lg">
              <Check size={14} />
              Лицензия
              {university.license_expires_at
                ? ` до ${formatDate(university.license_expires_at)}`
                : ''}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2 no-print">
            {canEdit && (
              <button
                onClick={() => setTransferOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
                title="Передать вуз"
              >
                <UserPlus size={13} /> Передать
              </button>
            )}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
              title="Печать карточки"
            >
              <Printer size={13} /> Печать
            </button>
            <button
              onClick={() => {
                exportUniversitiesSpreadsheet([university], 'xlsx');
                onNotice('XLSX сохранён.');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
              title="Скачать XLSX"
            >
              <Download size={13} /> XLSX
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={async () => {
                  const err = await exportUniversityToSap(university.id);
                  onNotice(err ? `Ошибка: ${err}` : 'Выгружено в SAP.');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
                title="Выгрузить в SAP"
              >
                <Download size={13} /> SAP
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex-wrap no-print">
          {(
            [
              { key: 'info' as const, label: 'Информация', icon: Info },
              { key: 'workflow' as const, label: 'Workflow', icon: WorkflowIcon },
              { key: 'timeline' as const, label: 'Лента', icon: History },
              { key: 'versions' as const, label: 'История', icon: History },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              data-tour={key === 'workflow' ? 'university-workflow-tab' : undefined}
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

        {tab === 'info' && (
          <>
            <TagPicker
              allTags={allTags}
              selected={tagIds}
              onChange={async (ids) => {
                await api.post(`/universities/${university.id}/tags/set`, {
                  tag_ids: ids,
                });
                await onRefresh();
              }}
              canEdit={canEdit}
              onNotice={onNotice}
              onTagCreated={() => {}}
            />

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

            <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-900/40">
              <p className="text-xs text-sky-700 dark:text-sky-300 mb-2 font-medium">
                Связаться
              </p>
              <MessengerLinks university={university} onNotice={onNotice} />
            </div>

            {customFields.length > 0 && (
              <CustomFieldsSection
                entityId={university.id}
                fields={customFields}
                values={valuesMap}
                canEdit={canEdit}
                userId={user?.profileId ?? null}
                onSaved={onRefresh}
                onNotice={onNotice}
              />
            )}

            {university.notes && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40">
                <p className="text-xs text-amber-600 mb-1">Заметки</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  {university.notes}
                </p>
              </div>
            )}

            {canEdit && (
              <div className="no-print">
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
            )}

            <UniversityContactsList
              universityId={university.id}
              contacts={asArray(university.contacts)}
              canEdit={canEdit}
              onRefresh={onRefresh}
              onNotice={onNotice}
            />

            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                Документы
              </p>
              <DocumentsList
                universityId={university.id}
                uploadedBy={user?.name ?? 'Пользователь'}
                canEdit={canEdit}
                onNotice={onNotice}
              />
            </div>

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
                        {Array.isArray(c.attachments) && c.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {c.attachments.map((a, i) => (
                              <a
                                key={i}
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-sky-600 hover:underline"
                              >
                                <FileText size={11} /> {a.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2 no-print">
                <CommentMentionsInput
                  value={comment}
                  onChange={setComment}
                  attachments={commentAttachments}
                  onAttachmentsChange={setCommentAttachments}
                  universityId={university.id}
                  placeholder={`Комментарий от ${user?.name ?? 'вас'}…`}
                  className={`${inputClass} pr-12 min-h-[70px] resize-none`}
                  onNotice={onNotice}
                />
                <div className="flex justify-end">
                  <Button onClick={() => void addComment()} disabled={!comment.trim()}>
                    Отправить
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'workflow' && (
          <>
            {loadingDetail ? (
              <p className="text-sm text-slate-400 text-center py-6">
                Загрузка workflow…
              </p>
            ) : !workflowData ? (
              <EmptyState text="Workflow не назначен" />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">
                    Переходов: {transitions.length}
                  </span>
                  <div className="flex items-center gap-2">
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
                </div>

                {wfView === 'list' ? (
                  <WorkflowProgress
                    steps={asArray(workflowData.workflow.steps)}
                    catalog={statuses}
                    onStepClick={(s) => setTransitionStep(s)}
                  />
                ) : (
                  <WorkflowDiagram
                    steps={asArray(workflowData.workflow.steps)}
                    catalog={statuses}
                    transitions={transitions}
                    currentStepId={workflowData.currentStepId}
                    onStepClick={(s) => setTransitionStep(s)}
                  />
                )}

                {transitions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 mt-2">
                      Последние переходы
                    </p>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {transitions.slice(0, 10).map((t) => (
                        <div
                          key={t.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-slate-700 dark:text-slate-200">
                              {t.from_status ?? '—'} → {t.to_status}
                            </p>
                            <span className="text-slate-400">
                              {formatDateTime(t.created_at)}
                            </span>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400">
                            {t.actor_name}
                          </p>
                          {t.comment && (
                            <p className="text-slate-600 dark:text-slate-300 mt-1">
                              {t.comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'timeline' && <UniversityTimeline universityId={university.id} />}

        {tab === 'versions' && (
          <VersionsPanel
            entity="universities"
            entityId={university.id}
            onRollback={async (snapshot) => {
              await api.patch(`/universities/${university.id}`, snapshot);
              await onRefresh();
            }}
            onNotice={onNotice}
          />
        )}

        {transitionStep && workflowData && (
          <TransitionModal
            step={transitionStep}
            universityId={university.id}
            catalog={statuses}
            transitions={stepTransitions}
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

      {transferOpen && (
        <TransferUniversityModal
          university={university}
          managers={allManagers}
          onClose={() => setTransferOpen(false)}
          onTransferred={async () => {
            await onRefresh();
            onNotice('Вуз передан.');
          }}
          onNotice={onNotice}
        />
      )}
    </SimpleModal>
  );
}