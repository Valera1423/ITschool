// frontend/src/pages/WorkflowsPage.tsx
import { useEffect, useState, type FormEvent } from 'react';
import {
  Plus,
  Zap,
  Pencil,
  Trash2,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Sparkles,
  GitBranch,
} from 'lucide-react';
import type {
  Workflow,
  WorkflowStep,
  WorkflowStatusCatalog,
  WorkflowTemplateInfo,
} from '@/types';
import { WORKFLOW_STATUSES } from '@/constants';
import {
  StatusBadge,
  EmptyState,
  SimpleModal,
  Button,
  Field,
  inputClass,
  selectClass,
  textareaClass,
} from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useWorkflowStatuses } from '@/hooks/queries/useCatalogs';
import { WorkflowProgress } from '@/components/workflow/WorkflowProgress';
import { WorkflowTransitionRulesModal } from '@/components/workflow/WorkflowTransitionRulesModal';
import {
  listWorkflowTemplates,
  createWorkflowFromTemplate,
  listTransitionRules,
  addTransitionRule,
  deleteTransitionRule,
} from '@/lib/workflow';
import { asArray } from '@/lib/utils';

interface Props {
  workflows: Workflow[];
  workflowSteps: WorkflowStep[];
  onNotice: (msg: string) => void;
  onRefresh: () => Promise<void>;
}

export function WorkflowsPage({
  workflows,
  workflowSteps,
  onNotice,
  onRefresh,
}: Props) {
  const api = useApi();
  const { data: catalogRaw = [] } = useWorkflowStatuses();
  const catalog = asArray<WorkflowStatusCatalog>(catalogRaw);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [stepsModal, setStepsModal] = useState<Workflow | null>(null);

  const [templates, setTemplates] = useState<WorkflowTemplateInfo[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [rulesFor, setRulesFor] = useState<Workflow | null>(null);

  useEffect(() => {
    void listWorkflowTemplates().then(setTemplates);
  }, []);

  const safeWorkflows = asArray<Workflow>(workflows);
  const safeSteps = asArray<WorkflowStep>(workflowSteps);

  const deleteWorkflow = async (id: string) => {
    if (!window.confirm('Удалить workflow? Все шаги также будут удалены.'))
      return;
    await api.delete(`/workflows/${id}`);
    onNotice('Workflow удалён.');
    await onRefresh();
  };

  const saveWorkflow = async (data: Record<string, string>, id?: string) => {
    const payload: Record<string, unknown> = {
      name: data.name,
      description: data.description || null,
      status: data.status || 'Активен',
    };
    if (id) {
      payload.runsCount = Number(data.runs_count) || 0;
      await api.patch(`/workflows/${id}`, payload);
    } else {
      await api.post('/workflows', payload);
    }
    setModalOpen(false);
    setEditing(null);
    await onRefresh();
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data: Record<string, string> = {};
    new FormData(e.currentTarget).forEach((v, k) => {
      data[k] = String(v);
    });
    void saveWorkflow(data, editing?.id);
  };

  const updateStepStatus = async (stepId: string, statusCode: string) => {
    try {
      await api.patch(`/workflows/steps/${stepId}`, {
        status_code: statusCode,
      });
      onNotice('Статус шага обновлён.');
      await onRefresh();
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  const addStep = async (workflowId: string, title: string) => {
    const steps = safeSteps.filter((s) => s.workflow_id === workflowId);
    try {
      await api.post(`/workflows/${workflowId}/steps`, {
        title,
        stepOrder: steps.length + 1,
        statusCode: 'pending',
      });
      onNotice('Шаг добавлен.');
      await onRefresh();
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Автоматизация</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Workflow
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Последовательности действий, которые помогают не пропускать
            важные этапы.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setTemplateModalOpen(true)}
          >
            <Sparkles size={18} /> Из шаблона
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus size={18} /> Создать workflow
          </Button>
        </div>
      </section>

      {safeWorkflows.length === 0 ? (
        <EmptyState
          text="Workflow ещё нет"
          hint="Создайте первую последовательность действий"
          actionLabel="Создать"
          onAction={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          icon={Zap}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {safeWorkflows.map((wf) => {
            const steps = safeSteps.filter((s) => s.workflow_id === wf.id);
            const completed = steps.filter(
              (s) => s.status_code === 'done',
            ).length;

            return (
              <div
                key={wf.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-sky-50 dark:bg-sky-900/40 flex items-center justify-center text-sky-600 dark:text-sky-300">
                    <Zap size={20} />
                  </div>
                  <StatusBadge status={wf.status} />
                </div>

                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  {wf.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
                  {wf.description ?? '—'}
                </p>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                    <div className="text-lg font-bold text-slate-700 dark:text-slate-200">
                      {wf.runs_count}
                    </div>
                    <div className="text-xs text-slate-400">запусков</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                    <div className="text-lg font-bold text-slate-700 dark:text-slate-200">
                      {steps.length}
                    </div>
                    <div className="text-xs text-slate-400">шагов</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {completed}
                    </div>
                    <div className="text-xs text-slate-400">готово</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setStepsModal(wf)}
                    className="flex-1"
                  >
                    Открыть шаги <ChevronRight size={14} />
                  </Button>
                  <button
                    onClick={() => setRulesFor(wf)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600"
                    title="Настроить переходы"
                    aria-label="Настроить переходы"
                  >
                    <GitBranch size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setEditing(wf);
                      setModalOpen(true);
                    }}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600"
                    aria-label="Редактировать"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => void deleteWorkflow(wf.id)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                    aria-label="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <SimpleModal
          title={editing ? 'Редактировать workflow' : 'Создать workflow'}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Название">
              <input
                name="name"
                required
                defaultValue={editing?.name ?? ''}
                className={inputClass}
              />
            </Field>
            <Field label="Описание">
              <textarea
                name="description"
                defaultValue={editing?.description ?? ''}
                className={textareaClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Статус">
                <select
                  name="status"
                  defaultValue={editing?.status ?? 'Активен'}
                  className={selectClass}
                >
                  {WORKFLOW_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              {editing && (
                <Field label="Количество запусков">
                  <input
                    name="runs_count"
                    type="number"
                    defaultValue={editing.runs_count ?? 0}
                    className={inputClass}
                  />
                </Field>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setModalOpen(false);
                  setEditing(null);
                }}
              >
                Отмена
              </Button>
              <Button type="submit">{editing ? 'Сохранить' : 'Создать'}</Button>
            </div>
          </form>
        </SimpleModal>
      )}

      {stepsModal && (
        <WorkflowStepsModal
          workflow={stepsModal}
          steps={safeSteps.filter((s) => s.workflow_id === stepsModal.id)}
          catalog={catalog}
          onUpdateStep={updateStepStatus}
          onAddStep={addStep}
          onClose={() => setStepsModal(null)}
        />
      )}

      {templateModalOpen && (
        <WorkflowFromTemplateModal
          templates={templates}
          onClose={() => setTemplateModalOpen(false)}
          onCreated={async () => {
            setTemplateModalOpen(false);
            onNotice('Workflow создан из шаблона.');
            await onRefresh();
          }}
          onNotice={onNotice}
        />
      )}

      {rulesFor && (
        <WorkflowTransitionRulesModal
          workflow={rulesFor}
          steps={safeSteps.filter((s) => s.workflow_id === rulesFor.id)}
          listRules={listTransitionRules}
          addRule={addTransitionRule}
          deleteRule={deleteTransitionRule}
          onClose={() => setRulesFor(null)}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}

function WorkflowStepsModal({
  workflow,
  steps,
  catalog,
  onUpdateStep,
  onAddStep,
  onClose,
}: {
  workflow: Workflow;
  steps: WorkflowStep[];
  catalog: WorkflowStatusCatalog[];
  onUpdateStep: (id: string, status: string) => void;
  onAddStep: (workflowId: string, title: string) => void;
  onClose: () => void;
}) {
  const [newStep, setNewStep] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'progress'>('progress');
  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);

  const handleAdd = () => {
    if (!newStep.trim()) return;
    onAddStep(workflow.id, newStep.trim());
    setNewStep('');
  };

  return (
    <SimpleModal title={`Шаги: ${workflow.name}`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setViewMode('progress')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'progress'
                ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Прогресс
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Список
          </button>
        </div>

        {viewMode === 'progress' ? (
          <WorkflowProgress steps={sorted} catalog={catalog} />
        ) : (
          <>
            {sorted.map((step, idx) => (
              <div
                key={step.id}
                className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                    step.status_code === 'done'
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : step.status_code === 'in_progress'
                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  {step.status_code === 'done' ? (
                    <CheckCircle2 size={18} />
                  ) : step.status_code === 'in_progress' ? (
                    <Clock3 size={16} />
                  ) : (
                    idx + 1
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {step.title}
                  </p>
                  <p className="text-xs text-slate-400">
                    Шаг {step.step_order}
                  </p>
                </div>

                <select
                  value={step.status_code ?? 'pending'}
                  onChange={(e) => onUpdateStep(step.id, e.target.value)}
                  className={`${selectClass} w-40 text-xs py-1.5`}
                >
                  {catalog.length === 0 && (
                    <option value={step.status_code ?? 'pending'}>
                      {step.status}
                    </option>
                  )}
                  {catalog.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {sorted.length === 0 && (
              <EmptyState text="Нет шагов в этом workflow" />
            )}
          </>
        )}

        <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <input
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Название нового шага"
            className={`${inputClass} flex-1`}
          />
          <Button onClick={handleAdd} disabled={!newStep.trim()}>
            <Plus size={16} />
            Добавить
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}

function WorkflowFromTemplateModal({
  templates,
  onClose,
  onCreated,
  onNotice,
}: {
  templates: WorkflowTemplateInfo[];
  onClose: () => void;
  onCreated: () => Promise<void>;
  onNotice: (msg: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!selected) {
      onNotice('Выберите шаблон.');
      return;
    }
    setSaving(true);
    const err = await createWorkflowFromTemplate({
      templateKey: selected,
      name: name.trim() || undefined,
      makeDefault,
    });
    setSaving(false);
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    await onCreated();
  };

  return (
    <SimpleModal title="Создать из шаблона" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-1 gap-2 max-h-80 overflow-y-auto">
          {templates.map((t) => {
            const active = selected === t.key;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setSelected(t.key);
                  setName(t.name);
                }}
                className={`text-left p-4 rounded-xl border transition-colors ${
                  active
                    ? 'border-sky-400 bg-sky-50/60 dark:bg-sky-900/20'
                    : 'border-slate-100 dark:border-slate-800 hover:border-sky-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {t.name}
                  </p>
                  <span className="text-xs text-slate-400">
                    {t.stepsCount} шагов
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.description}
                </p>
              </button>
            );
          })}
          {templates.length === 0 && <EmptyState text="Шаблонов нет" />}
        </div>

        <Field label="Название (если пусто — возьмётся из шаблона)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={makeDefault}
            onChange={(e) => setMakeDefault(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-sky-600"
          />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            Сделать основным workflow (все вузы привяжутся к нему)
          </span>
        </label>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={() => void submit()} disabled={!selected || saving}>
            {saving ? 'Создание…' : 'Создать'}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}