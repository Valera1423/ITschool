import type {
  Contract,
  ContractApproval,
  ContractVersion,
  ContractStatus,
} from '@/types';
import { api } from './api';

/**
 * Договоры и согласование.
 *
 * Статусы: Черновик → На проверке → Согласован → Подписан.
 * Шаблоны согласования: standard / short / legal.
 */

export const CONTRACT_STATUSES: ContractStatus[] = [
  'Черновик',
  'На проверке',
  'Согласован',
  'Подписан',
  'Отклонён',
  'Расторгнут',
];

export const APPROVAL_TEMPLATES = {
  standard: [
    { role: 'Менеджер', label: 'Менеджер' },
    { role: 'Юрист', label: 'Юридический отдел' },
    { role: 'Финансы', label: 'Финансовый контроль' },
    { role: 'Директор', label: 'Руководитель' },
  ],
  short: [
    { role: 'Менеджер', label: 'Менеджер' },
    { role: 'Директор', label: 'Руководитель' },
  ],
  legal: [
    { role: 'Юрист', label: 'Юридический отдел' },
    { role: 'Директор', label: 'Руководитель' },
  ],
} as const;

export type ApprovalTemplateKey = keyof typeof APPROVAL_TEMPLATES;

// ============================================================
// CRUD
// ============================================================

export async function listContracts(universityId?: string): Promise<Contract[]> {
  try {
    const query = universityId ? `?universityId=${universityId}` : '';
    return await api.get<Contract[]>(`/contracts${query}`);
  } catch {
    return [];
  }
}

export async function createContract(input: {
  university_id: string;
  title: string;
  contract_number?: string;
  amount?: number;
  currency?: string;   // NEW
  expires_at?: string | null;
  notes?: string;
  template?: ApprovalTemplateKey;
}): Promise<{ data: Contract | null; error: string | null }> {
  try {
    const data = await api.post<Contract>('/contracts', input);
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Ошибка' };
  }
}

export async function updateContract(
  id: string,
  patch: Partial<Contract>,
): Promise<string | null> {
  try {
    await api.patch(`/contracts/${id}`, patch);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function deleteContract(id: string): Promise<string | null> {
  try {
    await api.delete(`/contracts/${id}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

// ============================================================
// СОГЛАСОВАНИЕ
// ============================================================

export async function listApprovals(
  contractId: string,
): Promise<ContractApproval[]> {
  try {
    return await api.get<ContractApproval[]>(
      `/contracts/${contractId}/approvals`,
    );
  } catch {
    return [];
  }
}

export async function decideApproval(
  approvalId: string,
  decision: 'Одобрено' | 'Отклонено',
  comment: string,
  approverName: string,
): Promise<string | null> {
  try {
    await api.post(`/contracts/approvals/${approvalId}`, {
      decision,
      comment,
      approverName,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

export async function submitForApproval(
  contractId: string,
): Promise<string | null> {
  return updateContract(contractId, { status: 'На проверке' });
}

export async function markSigned(
  contractId: string,
  documentId?: string,
): Promise<string | null> {
  try {
    await api.post(`/contracts/${contractId}/sign`, {
      document_id: documentId,
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка';
  }
}

// ============================================================
// ВЕРСИИ
// ============================================================

export async function listVersions(
  contractId: string,
): Promise<ContractVersion[]> {
  try {
    return await api.get<ContractVersion[]>(
      `/contracts/${contractId}/versions`,
    );
  } catch {
    return [];
  }
}

/**
 * Загрузить новую версию договора.
 *
 * Через api.upload — единый обработчик 401, Idempotency-Key и ApiError.
 */
export async function addVersion(input: {
  contract_id: string;
  file: File;
  uploaded_by: string;
  comment?: string;
}): Promise<string | null> {
  try {
    const fd = new FormData();
    fd.append('file', input.file);
    fd.append('uploaded_by', input.uploaded_by);
    if (input.comment) fd.append('comment', input.comment);

    await api.upload(`/contracts/${input.contract_id}/versions`, fd);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка загрузки';
  }
}

// ============================================================
// ЦВЕТА
// ============================================================

export const STATUS_BADGE: Record<ContractStatus, string> = {
  Черновик: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'На проверке':
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Согласован: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  Подписан:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Отклонён: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  Расторгнут:
    'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export function fmtMoney(v: number, currency = 'RUB'): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

// ============================================================
// ЭДО (Диадок / СБИС)
// ============================================================

export interface EdoDocumentRow {
  id: string;
  provider: string;
  externalId: string | null;
  status: string;
  signedAt: string | null;
  rejectedAt: string | null;
  rejectionComment: string | null;
  createdAt: string;
}

export async function sendToDiadoc(contractId: string): Promise<string | null> {
  try {
    await api.post(`/edo/diadoc/contracts/${contractId}/send`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка отправки в Диадок';
  }
}

export async function sendToSbis(contractId: string): Promise<string | null> {
  try {
    await api.post(`/edo/sbis/contracts/${contractId}/send`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка отправки в СБИС';
  }
}

export async function listEdoDocuments(contractId: string): Promise<EdoDocumentRow[]> {
  try {
    return await api.get<EdoDocumentRow[]>(`/edo/contracts/${contractId}/documents`);
  } catch {
    return [];
  }
}

/**
 * Ручной запрос статуса по всем ЭДО-документам договора.
 *
 * Дёргает `POST /edo/contracts/:id/refresh` — на бэкенде это опрашивает
 * Диадок/СБИС и обновляет статусы в БД, возвращая число обновлённых
 * документов. Полезно, когда webhook не настроен или не пришёл.
 *
 * Возвращает количество обновлённых документов (0 — если запрос упал).
 */
export async function refreshEdoStatus(contractId: string): Promise<number> {
  try {
    const r = await api.post<{ refreshed: number }>(
      `/edo/contracts/${contractId}/refresh`,
    );
    return r.refreshed;
  } catch {
    return 0;
  }
}

// ============================================================
// Выгрузки во внешние системы (1С / SAP)
// ============================================================

export async function exportContractTo1C(contractId: string): Promise<string | null> {
  try {
    await api.post(`/exports/1c/contracts/${contractId}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка выгрузки в 1С';
  }
}

export async function exportUniversityToSap(universityId: string): Promise<string | null> {
  try {
    await api.post(`/exports/sap/universities/${universityId}`);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Ошибка выгрузки в SAP';
  }
}

/**
 * Поддерживаемые валюты договоров.
 * Курсы не конвертируем — показываем как в договоре (в рублях — отдельная колонка,
 * если когда-нибудь появится).
 */
export const CURRENCIES = [
  { code: 'RUB', label: '₽ Рубль', symbol: '₽' },
  { code: 'USD', label: '$ Доллар США', symbol: '$' },
  { code: 'EUR', label: '€ Евро', symbol: '€' },
  { code: 'CNY', label: '¥ Юань', symbol: '¥' },
  { code: 'KZT', label: '₸ Тенге', symbol: '₸' },
  { code: 'BYN', label: 'Br Белорусский рубль', symbol: 'Br' },
] as const;

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}