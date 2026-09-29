// frontend/src/components/ContractDetailModal.tsx
import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Download,
  FileDown,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  Upload,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type {
  Contract,
  ContractApproval,
  ContractVersion,
  University,
} from '@/types';
import {
  addVersion,
  decideApproval,
  exportContractTo1C,
  fmtMoney,
  listApprovals,
  listEdoDocuments,
  listVersions,
  markSigned,
  refreshEdoStatus,
  sendToDiadoc,
  sendToSbis,
  submitForApproval,
} from '@/lib/contracts';
import { exportContractPdf } from '@/lib/pdf';
import {
  SimpleModal,
  Button,
  StatusBadge,
  EmptyState,
} from '@/components/ui';
import { asArray, formatDate, formatDateTime } from '@/lib/utils';

interface Props {
  contract: Contract;
  university: University | undefined;
  currentUserName: string;
  currentUserId: string | null;
  canEdit: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onNotice: (msg: string) => void;
}

const APPROVAL_ROLE_MAP: Record<string, string[]> = {
  Менеджер: ['manager', 'admin'],
  Юрист: ['manager', 'admin'],
  Финансы: ['manager', 'admin'],
  Директор: ['admin'],
  Администратор: ['admin'],
};

function canDecideStep(stepRole: string, userRole: string): boolean {
  return (APPROVAL_ROLE_MAP[stepRole] ?? ['manager', 'admin']).includes(userRole);
}

export function ContractDetailModal({
  contract,
  university,
  currentUserName,
  currentUserId: _currentUserId,
  canEdit,
  onClose,
  onRefresh,
  onNotice,
}: Props) {
  const [approvals, setApprovals] = useState<ContractApproval[]>([]);
  const [versions, setVersions] = useState<ContractVersion[]>([]);
  const [tab, setTab] = useState<'approvals' | 'versions' | 'edo'>('approvals');
  const [busy, setBusy] = useState(false);
  const [exporting1C, setExporting1C] = useState(false);

  // ЭДО — через react-query с polling только когда вкладка открыта
  const edoQuery = useQuery({
    queryKey: ['edo', 'contract', contract.id],
    queryFn: () => listEdoDocuments(contract.id),
    refetchInterval: tab === 'edo' ? 30_000 : false,
    enabled: tab === 'edo',
    staleTime: 10_000,
  });

  const edoDocs = edoQuery.data ?? [];

  const load = useCallback(async () => {
    const [a, v] = await Promise.all([
      listApprovals(contract.id),
      listVersions(contract.id),
    ]);
    setApprovals(asArray(a));
    setVersions(asArray(v));
  }, [contract.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async (file: File) => {
    setBusy(true);
    try {
      const err = await addVersion({
        contract_id: contract.id,
        file,
        uploaded_by: currentUserName,
      });
      if (err) {
        onNotice(`Ошибка: ${err}`);
        return;
      }
      onNotice('Версия загружена.');
      await load();
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    const err = await submitForApproval(contract.id);
    onNotice(err ? `Ошибка: ${err}` : 'Отправлено на согласование.');
    if (!err) {
      await onRefresh();
      await load();
    }
  };

  const handleSign = async () => {
    if (!window.confirm('Отметить договор как подписанный?')) return;
    const err = await markSigned(contract.id);
    onNotice(err ? `Ошибка: ${err}` : 'Договор подписан.');
    if (!err) {
      await onRefresh();
      await load();
    }
  };

  const decideApprovalHandler = async (
    approvalId: string,
    decision: 'Одобрено' | 'Отклонено',
  ) => {
    const comment =
      window.prompt(
        decision === 'Одобрено'
          ? 'Комментарий (необязательно):'
          : 'Причина отклонения:',
      ) ?? '';
    const err = await decideApproval(approvalId, decision, comment, currentUserName);
    onNotice(err ? `Ошибка: ${err}` : decision + '.');
    if (!err) {
      await onRefresh();
      await load();
    }
  };

  const handleRefreshEdo = async () => {
    const n = await refreshEdoStatus(contract.id);
    await edoQuery.refetch();
    onNotice(n > 0 ? `Обновлено: ${n}` : 'Не удалось обновить статусы ЭДО.');
  };

  /**
   * Прямая выгрузка в 1С через новый endpoint /enterprise/1c/export.
   *
   * Отличается от старого экспорта из lib/contracts.ts:
   *  - старый писал строку в ExternalExportLog и обрабатывался в фоне;
   *  - новый синхронный: шлёт payload прямо в 1С (через интеграцию)
   *    и сразу возвращает externalId.
   *
   * Используем fetch напрямую, потому что нам нужен тонкий контроль
   * над телом запроса (payload = сам договор) и токеном.
   */
  const exportTo1C = async () => {
    setExporting1C(true);
    try {
      const { userManager } = await import('@/lib/oidc');
      const user = await userManager.getUser();
      if (!user || user.expired) {
        onNotice('Сессия истекла.');
        return;
      }
      const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
      const res = await fetch(`${apiBase}/enterprise/1c/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({
          integrationId: import.meta.env.VITE_INTEGRATION_1C_ID, // ← либо выбрать из списка
          entity: 'contracts',
          entityId: contract.id,
          payload: contract as unknown as Record<string, unknown>,
        }),
      });
      const data = await res.json();
      if (data.ok && data.data?.ok) {
        onNotice(`Выгружено в 1С: ${data.data.externalId ?? ''}`);
      } else {
        onNotice(`Ошибка: ${data.data?.error ?? data.message ?? 'неизвестная'}`);
      }
    } catch (e) {
      onNotice(`Ошибка: ${(e as Error).message}`);
    } finally {
      setExporting1C(false);
    }
  };

  return (
    <SimpleModal title={contract.title} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={contract.status} />
          {university && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {university.name}
            </span>
          )}
          {contract.contract_number && (
            <span className="text-xs text-slate-400 font-mono">
              № {contract.contract_number}
            </span>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400 mb-1">Сумма</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {fmtMoney(contract.amount, contract.currency)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400 mb-1">Создан</p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {formatDate(contract.created_at)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400 mb-1">
              {contract.signed_at ? 'Подписан' : 'Истекает'}
            </p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {contract.signed_at
                ? formatDate(contract.signed_at)
                : contract.expires_at
                  ? formatDate(contract.expires_at)
                  : '—'}
            </p>
          </div>
        </div>

        {contract.notes && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 text-sm text-slate-700 dark:text-slate-200">
            {contract.notes}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => void exportContractPdf(contract, university)}
          >
            <FileDown size={15} /> PDF
          </Button>
          {canEdit && contract.status === 'Черновик' && (
            <Button onClick={() => void handleSubmit()}>
              <Check size={15} /> Отправить на согласование
            </Button>
          )}
          {canEdit && contract.status === 'Согласован' && (
            <Button onClick={() => void handleSign()}>
              <Check size={15} /> Отметить как подписанный
            </Button>
          )}
          {canEdit && (
            <label className="inline-flex">
              <input
                type="file"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void handleUpload(f);
                }}
              />
              <span className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <Upload size={15} /> Загрузить версию
              </span>
            </label>
          )}
        </div>

        {/* ЭДО + внешние системы */}
        {canEdit && contract.status === 'Согласован' && (
          <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-900/40 p-4 space-y-3">
            <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
              Отправить в ЭДО / выгрузить
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  const err = await sendToDiadoc(contract.id);
                  onNotice(err ? `Ошибка: ${err}` : 'Отправлено в Диадок.');
                  if (!err) {
                    await edoQuery.refetch();
                    await onRefresh();
                    await load();
                  }
                }}
              >
                <Send size={14} /> Диадок
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  const err = await sendToSbis(contract.id);
                  onNotice(err ? `Ошибка: ${err}` : 'Отправлено в СБИС.');
                  if (!err) {
                    await edoQuery.refetch();
                    await onRefresh();
                    await load();
                  }
                }}
              >
                <Send size={14} /> СБИС
              </Button>

              {/* Прямая выгрузка в 1С через /enterprise/1c/export */}
              <button
                onClick={() => void exportTo1C()}
                disabled={exporting1C}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 transition-colors"
                title="Выгрузить договор в 1С через интеграцию"
              >
                {exporting1C ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                1С
              </button>

              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  const err = await exportContractTo1C(contract.id);
                  onNotice(err ? `Ошибка: ${err}` : 'Выгружено в 1С.');
                }}
              >
                <Download size={14} /> В 1С (журнал)
              </Button>
            </div>
          </div>
        )}

        {/* Табы */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {(
            [
              { key: 'approvals', label: `Согласование (${approvals.filter((a) => a.status === 'Одобрено').length}/${approvals.length})` },
              { key: 'versions', label: `Версии (${versions.length})` },
              { key: 'edo', label: `ЭДО (${edoDocs.length})` },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'approvals' && (
          <div className="space-y-2">
            {approvals.length === 0 && <EmptyState text="Нет шагов согласования" />}
            {approvals.map((a) => {
              const iconBg =
                a.status === 'Одобрено'
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300'
                  : a.status === 'Отклонено'
                    ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400';
              const Icon =
                a.status === 'Одобрено' ? Check : a.status === 'Отклонено' ? X : Clock;
              return (
                <div
                  key={a.id}
                  className="flex gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{a.role}</p>
                      <span className="text-xs text-slate-400">Шаг {a.step_order}</span>
                    </div>
                    {a.approver_name && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                        <UserIcon size={11} />
                        {a.approver_name}
                        {a.decided_at ? ` · ${formatDateTime(a.decided_at)}` : ''}
                      </p>
                    )}
                    {a.comment && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 p-2 rounded-lg bg-white dark:bg-slate-900">
                        {a.comment}
                      </p>
                    )}
                    {canEdit && a.status === 'Ожидает' && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => void decideApprovalHandler(a.id, 'Одобрено')}>
                          <Check size={13} /> Одобрить
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => void decideApprovalHandler(a.id, 'Отклонено')}
                        >
                          <X size={13} /> Отклонить
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'versions' && (
          <div className="space-y-2">
            {versions.length === 0 && <EmptyState text="Версий пока нет" />}
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
              >
                <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center text-slate-500">
                  <FileText size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    v{v.version} · {v.name ?? 'документ'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {v.uploaded_by} · {formatDateTime(v.created_at)}
                  </p>
                  {v.comment && <p className="text-xs text-slate-500 mt-1">{v.comment}</p>}
                </div>
                {v.storage_path && (
                  <a
                    href={`${import.meta.env.VITE_MINIO_PUBLIC_URL}/${v.storage_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-slate-400 hover:text-sky-600 transition-colors"
                    aria-label="Скачать"
                  >
                    <Download size={15} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'edo' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400">
                Автообновление каждые 30 секунд
                {edoQuery.isFetching && (
                  <RefreshCw
                    size={11}
                    className="inline-block ml-1.5 animate-spin text-sky-500"
                  />
                )}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleRefreshEdo()}
                disabled={edoQuery.isFetching}
              >
                <RefreshCw size={13} /> Обновить
              </Button>
            </div>

            {edoDocs.length === 0 && (
              <EmptyState
                text="Документов ЭДО нет"
                hint="Отправьте договор в Диадок или СБИС"
              />
            )}
            {edoDocs.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {d.provider} · {d.status}
                  </p>
                  <p className="text-xs text-slate-400 font-mono truncate">
                    ID: {d.externalId ?? '—'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(d.createdAt)}
                    {d.signedAt ? ` · подписан ${formatDateTime(d.signedAt)}` : ''}
                  </p>
                  {d.rejectionComment && (
                    <p className="text-xs text-rose-500 mt-1">{d.rejectionComment}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SimpleModal>
  );
}