// frontend/src/components/workflow/WorkflowTransitionRulesModal.tsx
import { useEffect, useState } from 'react';
import { Trash2, Plus, ArrowRight, Loader2 } from 'lucide-react';
import type {
  Workflow,
  WorkflowStep,
  WorkflowTransitionRule,
} from '@/types';
import { SimpleModal, Button, Field, selectClass, EmptyState } from '@/components/ui';

interface Props {
  workflow: Workflow;
  steps: WorkflowStep[];
  listRules: (workflowId: string) => Promise<WorkflowTransitionRule[]>;
  addRule: (input: {
    workflowId: string;
    fromStepId: string;
    toStepId: string;
    requiresComment?: boolean;
  }) => Promise<string | null>;
  deleteRule: (workflowId: string, ruleId: string) => Promise<string | null>;
  onClose: () => void;
  onNotice: (msg: string) => void;
}

/**
 * Модалка управления графом переходов workflow.
 *
 * UX:
 *   - таблица правил «из шага → в шаг»;
 *   - селекты внизу: добавить новое правило;
 *   - удаление по клику.
 *
 * Если правил нет — переходы свободные (legacy-режим). Как только
 * добавлено хотя бы одно правило — бэкенд разрешает только по графу.
 */
export function WorkflowTransitionRulesModal({
  workflow,
  steps,
  listRules,
  addRule,
  deleteRule,
  onClose,
  onNotice,
}: Props) {
  const [rules, setRules] = useState<WorkflowTransitionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromStepId, setFromStepId] = useState('');
  const [toStepId, setToStepId] = useState('');
  const [saving, setSaving] = useState(false);

  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);

  const reload = async () => {
    setLoading(true);
    const list = await listRules(workflow.id);
    setRules(list);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.id]);

  const stepLabel = (id: string): string => {
    const s = sorted.find((x) => x.id === id);
    return s ? `${s.step_order}. ${s.title}` : '—';
  };

  const handleAdd = async () => {
    if (!fromStepId || !toStepId) {
      onNotice('Выберите оба шага.');
      return;
    }
    if (fromStepId === toStepId) {
      onNotice('Из шага в тот же шаг переход не имеет смысла.');
      return;
    }
    const exists = rules.some(
      (r) => r.from_step_id === fromStepId && r.to_step_id === toStepId,
    );
    if (exists) {
      onNotice('Такое правило уже есть.');
      return;
    }

    setSaving(true);
    const err = await addRule({
      workflowId: workflow.id,
      fromStepId,
      toStepId,
      requiresComment: true,
    });
    setSaving(false);
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    setFromStepId('');
    setToStepId('');
    await reload();
    onNotice('Правило добавлено.');
  };

  const handleDelete = async (ruleId: string) => {
    const err = await deleteRule(workflow.id, ruleId);
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    await reload();
  };

  return (
    <SimpleModal
      title={`Переходы: ${workflow.name}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-900/40 p-3 text-xs text-sky-700 dark:text-sky-300">
          Если правил нет — переходы свободные. Как только добавлено хотя бы
          одно правило, система разрешает переход только по графу.
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-sky-500" size={20} />
          </div>
        ) : rules.length === 0 ? (
          <EmptyState
            text="Правил нет — переходы свободные"
            hint="Добавьте первое правило ниже"
          />
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-xs text-slate-500">
                    Из шага
                  </th>
                  <th className="w-8"></th>
                  <th className="text-left px-3 py-2 font-medium text-xs text-slate-500">
                    В шаг
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-slate-50 dark:border-slate-800"
                  >
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                      {stepLabel(r.from_step_id)}
                    </td>
                    <td className="text-center text-slate-400">
                      <ArrowRight size={14} />
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                      {stepLabel(r.to_step_id)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => void handleDelete(r.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                        aria-label="Удалить правило"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Field label="Из шага">
            <select
              value={fromStepId}
              onChange={(e) => setFromStepId(e.target.value)}
              className={`${selectClass} min-w-[220px]`}
            >
              <option value="">— выберите —</option>
              {sorted.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.step_order}. {s.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="В шаг">
            <select
              value={toStepId}
              onChange={(e) => setToStepId(e.target.value)}
              className={`${selectClass} min-w-[220px]`}
            >
              <option value="">— выберите —</option>
              {sorted
                .filter((s) => s.id !== fromStepId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.step_order}. {s.title}
                  </option>
                ))}
            </select>
          </Field>
          <Button onClick={() => void handleAdd()} disabled={saving}>
            <Plus size={14} /> Добавить
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}