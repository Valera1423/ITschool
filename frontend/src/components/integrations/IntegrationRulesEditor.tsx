// frontend/src/components/integrations/IntegrationRulesEditor.tsx
import { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  Workflow as WorkflowIcon,
  AlertCircle,
} from 'lucide-react';
import type { Workflow, WorkflowStep } from '@/types';
import {
  listIntegrationRules,
  createIntegrationRule,
  deleteIntegrationRule,
  type IntegrationRule,
} from '@/lib/integrations';
import { useApi } from '@/hooks/useApi';
import {
  SimpleModal, Button, Field, inputClass, selectClass, EmptyState,
} from '@/components/ui';
import { asArray, formatDateTime } from '@/lib/utils';

/**
 * Управление правилами «LMS → workflow».
 *
 * Пример правила:
 *   ЕСЛИ enrollment.progress > 80
 *   ТО перевести workflow вуза на шаг «Проверка активации»
 *
 * Каждое правило привязывается к интеграции. Поле endpointId
 * необязательно — правило может применяться ко всем endpoint'ам.
 */
interface Props {
  integrationId: string;
  integrationName: string;
  onClose: () => void;
  onNotice: (msg: string) => void;
}

const OPERATORS = [
  { key: 'equals', label: 'равно' },
  { key: 'not_equals', label: 'не равно' },
  { key: 'greater', label: 'больше' },
  { key: 'less', label: 'меньше' },
  { key: 'contains', label: 'содержит' },
  { key: 'in', label: 'входит в список (через запятую)' },
];

export function IntegrationRulesEditor({
  integrationId,
  integrationName,
  onClose,
  onNotice,
}: Props) {
  const api = useApi();
  const [rules, setRules] = useState<IntegrationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<IntegrationRule | null>(null);

  const reload = async () => {
    setLoading(true);
    const list = await listIntegrationRules(integrationId);
    setRules(list);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId]);

  const remove = async (rule: IntegrationRule) => {
    if (!window.confirm(`Удалить правило «${rule.name}»?`)) return;
    const err = await deleteIntegrationRule(rule.id);
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    onNotice('Правило удалено.');
    await reload();
  };

  return (
    <SimpleModal
      title={`Правила автоматизации: ${integrationName}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-900/40 p-3 text-xs text-sky-700 dark:text-sky-300 flex items-start gap-2">
          <WorkflowIcon size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            Правила применяются при каждом sync: если данные из внешнего API
            удовлетворяют условию, CRM автоматически двигает workflow вуза,
            создаёт задачи или вешает теги.
          </div>
        </div>

        <div className="flex justify-between items-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {rules.length === 0
              ? 'Правил пока нет'
              : `Всего правил: ${rules.length}`}
          </p>
          <Button
            size="sm"
            onClick={() => {
              setEditingRule(null);
              setEditorOpen(true);
            }}
          >
            <Plus size={13} /> Новое правило
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-sky-500" size={20} />
          </div>
        ) : rules.length === 0 ? (
          <EmptyState
            text="Правил нет"
            hint="Создайте первое правило автоматизации"
          />
        ) : (
          <div className="space-y-2">
            {rules.map((r) => (
              <div
                key={r.id}
                className={`p-3 rounded-xl border ${
                  r.enabled
                    ? 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {r.name}
                    </p>
                    {r.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {r.description}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">
                      Запусков: {r.run_count}
                      {r.last_run_at &&
                        ` · Последний: ${formatDateTime(r.last_run_at)}`}
                    </p>
                    {r.last_error && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                        <AlertCircle size={11} /> {r.last_error}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingRule(r);
                        setEditorOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600"
                      aria-label="Редактировать"
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      onClick={() => void remove(r)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                      aria-label="Удалить"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {editorOpen && (
          <RuleEditorModal
            integrationId={integrationId}
            rule={editingRule}
            onClose={() => {
              setEditorOpen(false);
              setEditingRule(null);
            }}
            onSaved={async () => {
              setEditorOpen(false);
              setEditingRule(null);
              await reload();
            }}
            onNotice={onNotice}
            api={api}
          />
        )}
      </div>
    </SimpleModal>
  );
}

// ============================================================
// Модалка создания / редактирования одного правила
// ============================================================

function RuleEditorModal({
  integrationId,
  rule,
  onClose,
  onSaved,
  onNotice,
  api,
}: {
  integrationId: string;
  rule: IntegrationRule | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onNotice: (msg: string) => void;
  api: ReturnType<typeof useApi>;
}) {
  const [name, setName] = useState(rule?.name ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);

  const initCondition = (rule?.condition ?? {}) as {
    field?: string;
    operator?: string;
    value?: unknown;
  };
  const [condField, setCondField] = useState(initCondition.field ?? '');
  const [condOperator, setCondOperator] = useState(
    initCondition.operator ?? 'equals',
  );
  const [condValue, setCondValue] = useState(
    typeof initCondition.value === 'string'
      ? initCondition.value
      : typeof initCondition.value === 'number'
        ? String(initCondition.value)
        : '',
  );

  const initActions = (rule?.actions ?? []) as {
    type: string;
    params?: Record<string, unknown>;
  }[];
  const initAction = initActions[0] ?? {};
  const [actionType, setActionType] = useState(
    initAction.type ?? 'advance_workflow',
  );
  const [actionStepId, setActionStepId] = useState(
    String((initAction.params as { stepId?: string })?.stepId ?? ''),
  );
  const [actionWorkflowId, setActionWorkflowId] = useState(
    String((initAction.params as { workflowId?: string })?.workflowId ?? ''),
  );
  const [actionTaskTitle, setActionTaskTitle] = useState(
    String(
      (initAction.params as { title?: string })?.title ?? '',
    ),
  );

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const [wfList, stList] = await Promise.all([
        api.get<Workflow[]>('/workflows').catch(() => []),
        api.get<WorkflowStep[]>('/workflow-steps').catch(() => []),
      ]);
      setWorkflows(asArray<Workflow>(wfList));
      setSteps(asArray<WorkflowStep>(stList));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!name.trim()) {
      onNotice('Укажите название.');
      return;
    }
    if (!condField.trim()) {
      onNotice('Укажите поле условия.');
      return;
    }

    const condition = {
      field: condField.trim(),
      operator: condOperator,
      value:
        condOperator === 'in'
          ? condValue.split(',').map((s) => s.trim()).filter(Boolean)
          : condValue,
    };

    const action =
      actionType === 'advance_workflow'
        ? {
            type: 'advance_workflow',
            params: { workflowId: actionWorkflowId, stepId: actionStepId },
          }
        : actionType === 'create_task'
          ? {
              type: 'create_task',
              params: { title: actionTaskTitle || 'Задача из интеграции' },
            }
          : {
              type: 'add_tag',
              params: { tagId: String((initAction.params as { tagId?: string })?.tagId ?? '') },
            };

    setSaving(true);
    const err = rule
      ? await api
          .patch(`/integrations/rules/${rule.id}`, {
            name: name.trim(),
            description: description.trim() || null,
            enabled,
            condition,
            actions: [action],
          })
          .then(() => null)
          .catch((e) => (e instanceof Error ? e.message : 'Ошибка'))
      : await createIntegrationRule({
          integrationId,
          name: name.trim(),
          description: description.trim() || undefined,
          enabled,
          condition,
          actions: [action],
        });
    setSaving(false);

    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    onNotice(rule ? 'Правило обновлено.' : 'Правило создано.');
    await onSaved();
  };

  const stepsForWorkflow = steps.filter(
    (s) => s.workflow_id === actionWorkflowId,
  );

  return (
    <SimpleModal
      title={rule ? 'Редактировать правило' : 'Новое правило'}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Название" wide>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="При прогресс > 80 — двигать workflow"
              className={inputClass}
            />
          </Field>
          <Field label="Описание" wide>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            ЕСЛИ
          </p>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-12 sm:col-span-5">
              <Field label="Поле (путь в API)">
                <input
                  value={condField}
                  onChange={(e) => setCondField(e.target.value)}
                  placeholder="progress или university.name"
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="col-span-6 sm:col-span-3">
              <Field label="Оператор">
                <select
                  value={condOperator}
                  onChange={(e) => setCondOperator(e.target.value)}
                  className={selectClass}
                >
                  {OPERATORS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="col-span-6 sm:col-span-4">
              <Field label="Значение">
                <input
                  value={condValue}
                  onChange={(e) => setCondValue(e.target.value)}
                  placeholder={
                    condOperator === 'in' ? 'a, b, c' : 'значение'
                  }
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            ТО
          </p>
          <Field label="Действие">
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className={selectClass}
            >
              <option value="advance_workflow">Перевести workflow на шаг</option>
              <option value="create_task">Создать задачу</option>
            </select>
          </Field>

          {actionType === 'advance_workflow' && (
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <Field label="Workflow">
                <select
                  value={actionWorkflowId}
                  onChange={(e) => {
                    setActionWorkflowId(e.target.value);
                    setActionStepId('');
                  }}
                  className={selectClass}
                >
                  <option value="">— выберите —</option>
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Шаг">
                <select
                  value={actionStepId}
                  onChange={(e) => setActionStepId(e.target.value)}
                  className={selectClass}
                  disabled={!actionWorkflowId}
                >
                  <option value="">— выберите —</option>
                  {stepsForWorkflow.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.step_order}. {s.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {actionType === 'create_task' && (
            <div className="mt-3">
              <Field label="Название задачи">
                <input
                  value={actionTaskTitle}
                  onChange={(e) => setActionTaskTitle(e.target.value)}
                  placeholder="Проверить прогресс обучения"
                  className={inputClass}
                />
              </Field>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-sky-600"
          />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            Правило включено
          </span>
        </label>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? 'Сохранение…' : rule ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}