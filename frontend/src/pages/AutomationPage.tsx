import { useState } from 'react';
import {
  Plus,
  Zap,
  Pencil,
  Trash2,
  Play,
  Pause,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import type { AutomationRule } from '@/types';
import {
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  runRuleManually,
  describeTrigger,
  describeCondition,
  describeAction,
} from '@/lib/automation';
import { useAutomationRules } from '@/hooks/useAutomationRules';
import { StatusBadge, EmptyState, Button } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { RuleEditorModal } from '@/components/automation/RuleEditorModal';

/**
 * Автоматизация if-then.
 *
 * Примеры правил:
 * - «При статусе Отказ → создать задачу»
 * - «Новый вуз → назначить менеджера»
 *
 * Движок — на backend (Edge Function automation-runner).
 */
interface Props {
  onNotice: (msg: string) => void;
}

export function AutomationPage({ onNotice }: Props) {
  const { rules, loading, reload } = useAutomationRules();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [runningFor, setRunningFor] = useState<string | null>(null);

  const handleDelete = async (r: AutomationRule) => {
    if (!window.confirm(`Удалить правило «${r.name}»?`)) return;
    const err = await deleteRule(r.id);
    onNotice(err ? `Ошибка: ${err}` : 'Правило удалено.');
    if (!err) await reload();
  };

  const handleToggle = async (r: AutomationRule) => {
    const err = await toggleRule(r.id, !r.enabled);
    onNotice(
      err ? 'Ошибка.' : r.enabled ? 'Правило приостановлено.' : 'Правило включено.',
    );
    if (!err) await reload();
  };

  const handleTestRun = async (r: AutomationRule) => {
    const id = window.prompt('ID сущности для тестового запуска (uuid):');
    if (!id) return;
    setRunningFor(r.id);
    const res = await runRuleManually(r.id, id.trim());
    setRunningFor(null);
    onNotice(res.ok ? 'Правило выполнено.' : `Ошибка: ${res.error}`);
    await reload();
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Без кода</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Автоматизация
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Правила «если — то». Создавайте задачи, меняйте поля, отправляйте уведомления.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={18} />Новое правило
        </Button>
      </section>

      {loading ? (
        <p className="text-sm text-slate-400">Загрузка…</p>
      ) : rules.length === 0 ? (
        <EmptyState
          text="Правил пока нет"
          hint="Создайте первое правило — например, «при отказе создать задачу»"
          actionLabel="Создать правило"
          onAction={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          icon={Zap}
        />
      ) : (
        <div className="space-y-3">
          {rules.map((r) => {
            const isExpanded = expanded === r.id;
            const hasError = !!r.last_error;

            return (
              <div
                key={r.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden ${
                  r.enabled
                    ? 'border-slate-100 dark:border-slate-800'
                    : 'border-slate-200 dark:border-slate-800 opacity-70'
                }`}
              >
                <div className="flex items-start gap-3 p-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      r.enabled
                        ? 'bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Zap size={18} />
                  </div>

                  <button
                    onClick={() => setExpanded(isExpanded ? null : r.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {r.name}
                      </p>
                      {hasError && (
                        <AlertCircle size={14} className="text-rose-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                      {describeTrigger(r)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-400">
                      <StatusBadge status={r.enabled ? 'Активен' : 'На паузе'} />
                      <span>·</span>
                      <span>{r.run_count} срабатываний</span>
                      {r.last_run_at && (
                        <>
                          <span>·</span>
                          <span>последнее {formatDateTime(r.last_run_at)}</span>
                        </>
                      )}
                    </div>
                  </button>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => void handleToggle(r)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600 transition-colors"
                      title={r.enabled ? 'Приостановить' : 'Включить'}
                    >
                      {r.enabled ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button
                      onClick={() => void handleTestRun(r)}
                      disabled={runningFor === r.id}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600 transition-colors disabled:opacity-50"
                      title="Тестовый запуск"
                    >
                      <Play size={15} />
                    </button>
                    <button
                      onClick={() => {
                        setEditing(r);
                        setModalOpen(true);
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600 transition-colors"
                      title="Редактировать"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => void handleDelete(r)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : r.id)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown size={15} />
                      ) : (
                        <ChevronRight size={15} />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                    {r.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {r.description}
                      </p>
                    )}

                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                        Триггер
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        {describeTrigger(r)}
                      </p>
                    </div>

                    {r.conditions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                          Условия
                        </p>
                        <ul className="space-y-1">
                          {r.conditions.map((c, i) => (
                            <li
                              key={i}
                              className="text-sm text-slate-700 dark:text-slate-200 flex items-start gap-2"
                            >
                              <CheckCircle2
                                size={14}
                                className="text-emerald-500 mt-0.5 flex-shrink-0"
                              />
                              {describeCondition(c)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                        Действия
                      </p>
                      <ul className="space-y-1">
                        {r.actions.map((a, i) => (
                          <li
                            key={i}
                            className="text-sm text-slate-700 dark:text-slate-200 flex items-start gap-2"
                          >
                            <Zap size={14} className="text-sky-500 mt-0.5 flex-shrink-0" />
                            {describeAction(a)}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {r.last_error && (
                      <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-xs text-rose-700 dark:text-rose-300">
                        Последняя ошибка: {r.last_error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <RuleEditorModal
          rule={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={reload}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}