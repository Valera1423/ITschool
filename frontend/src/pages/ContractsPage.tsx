// frontend/src/pages/ContractsPage.tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { Plus, FileText, Trash2, Search, Building2 } from 'lucide-react';
import type { Contract, University } from '@/types';
import {
  CONTRACT_STATUSES,
  createContract,
  deleteContract,
  listContracts,
  fmtMoney,
  APPROVAL_TEMPLATES,
  CURRENCIES,
  type ApprovalTemplateKey,
} from '@/lib/contracts';
import { useApi } from '@/hooks/useApi';
import { useUndo, useHistory } from '@/components/UndoProvider';
import { ContractDetailModal } from '@/components/ContractDetailModal';
import {
  EmptyState,
  SimpleModal,
  Button,
  Field,
  inputClass,
  selectClass,
  textareaClass,
  StatusBadge,
} from '@/components/ui';
import { asArray, formatDate, todayISO } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  universities: University[];
  onNotice: (msg: string) => void;
}

export function ContractsPage({ universities, onNotice }: Props) {
  const api = useApi();
  const { user } = useAuth();
  const { notifyWithUndo } = useUndo();
  const history = useHistory();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Все');
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<Contract | null>(null);

  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listContracts();
      setContracts(asArray(list));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      contracts.filter((c) => {
        const uni = universities.find((u) => u.id === c.university_id);
        const blob =
          `${c.title} ${c.contract_number ?? ''} ${uni?.name ?? ''}`.toLowerCase();
        return (
          blob.includes(query.toLowerCase()) &&
          (statusFilter === 'Все' || c.status === statusFilter)
        );
      }),
    [contracts, universities, query, statusFilter],
  );

  const handleDelete = async (c: Contract) => {
    const err = await deleteContract(c.id);
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    notifyWithUndo(`Договор «${c.title}» удалён`, async () => {
      await api.post(`/contracts/${c.id}/restore`);
      await load();
    });
    await load();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload = {
      university_id: String(data.get('university_id')),
      title: String(data.get('title')),
      contract_number: String(data.get('contract_number') ?? '') || undefined,
      amount: Number(data.get('amount')) || 0,
      currency: String(data.get('currency') ?? 'RUB'),
      expires_at: String(data.get('expires_at') ?? '') || null,
      notes: String(data.get('notes') ?? ''),
      template: String(data.get('template') ?? 'standard') as ApprovalTemplateKey,
    };

    const { data: created, error } = await createContract(payload);
    if (error) {
      onNotice(`Ошибка: ${error}`);
      return;
    }

    if (created?.id) {
      const newId = created.id;
      history.push({
        label: `Договор «${payload.title}» создан`,
        do: async () => {
          await createContract(payload);
          await load();
        },
        undo: async () => {
          await deleteContract(newId);
          await load();
        },
      });
    }

    onNotice('Договор создан.');
    setModalOpen(false);
    await load();
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Согласование и подпись</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Договоры
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Путь: Черновик → На проверке → Согласован → Подписан
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={18} />
            Новый договор
          </Button>
        )}
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск"
            className={`${inputClass} pl-10`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={`${selectClass} sm:w-52`}
        >
          <option>Все</option>
          {CONTRACT_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Загрузка…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          text="Договоров нет"
          hint="Создайте первый договор"
          actionLabel={canEdit ? 'Создать договор' : undefined}
          onAction={canEdit ? () => setModalOpen(true) : undefined}
          icon={FileText}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const uni = universities.find((u) => u.id === c.university_id);
            return (
              <div
                key={c.id}
                className="text-left bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => setDetail(c)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/40 flex items-center justify-center text-sky-600 dark:text-sky-300">
                      <FileText size={18} />
                    </div>
                    <StatusBadge status={c.status} />
                  </div>

                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1 line-clamp-2">
                    {c.title}
                  </h3>

                  {uni && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-2">
                      <Building2 size={11} />
                      {uni.name}
                    </p>
                  )}

                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    {fmtMoney(c.amount, c.currency)}
                    {c.currency !== 'RUB' && (
                      <span className="ml-2 text-[10px] text-slate-400 font-normal">
                        {c.currency}
                      </span>
                    )}
                  </p>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-50 dark:border-slate-800">
                    <span>{c.contract_number ?? '—'}</span>
                    <span>{formatDate(c.created_at.slice(0, 10))}</span>
                  </div>
                </button>

                {canEdit && (
                  <div className="flex justify-end gap-1 mt-2">
                    <button
                      onClick={() => void handleDelete(c)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 transition-colors"
                      title="Удалить"
                      aria-label="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <SimpleModal
          title="Новый договор"
          onClose={() => setModalOpen(false)}
          wide
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Вуз" wide>
                <select name="university_id" required className={selectClass}>
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Название договора" wide>
                <input
                  name="title"
                  required
                  placeholder="Договор на обучение 2026"
                  className={inputClass}
                />
              </Field>
              <Field label="Номер договора">
                <input
                  name="contract_number"
                  placeholder="Д-26/001"
                  className={inputClass}
                />
              </Field>
              <Field label="Сумма">
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  defaultValue={0}
                  className={inputClass}
                />
              </Field>
              <Field label="Валюта">
                <select
                  name="currency"
                  defaultValue="RUB"
                  className={selectClass}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Истекает">
                <input
                  name="expires_at"
                  type="date"
                  min={todayISO()}
                  className={inputClass}
                />
              </Field>
              <Field label="Шаблон согласования">
                <select
                  name="template"
                  defaultValue="standard"
                  className={selectClass}
                >
                  {Object.entries(APPROVAL_TEMPLATES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.map((s) => s.label).join(' → ')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Заметки" wide>
                <textarea name="notes" rows={3} className={textareaClass} />
              </Field>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Отмена
              </Button>
              <Button type="submit">Создать</Button>
            </div>
          </form>
        </SimpleModal>
      )}

      {detail && (
        <ContractDetailModal
          contract={detail}
          university={universities.find(
            (u) => u.id === detail.university_id,
          )}
          currentUserName={user?.name ?? 'Пользователь'}
          currentUserId={user?.profileId ?? null}
          canEdit={canEdit}
          onClose={() => setDetail(null)}
          onRefresh={load}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}