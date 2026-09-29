import type {
  UniversityMetrics,
  PeriodComparison,
  AbcCategory,
  XyzCategory,
  RfmResult,
  RfmSegment,
} from '@/types';
import { api } from './api';

// ============================================================
// Хелпер: pick по нескольким ключам (snake/camel)
// ============================================================

/**
 * Backend может отдавать данные в snake_case или camelCase
 * (в зависимости от версии API). Ищем первый не-null вариант.
 */
function pick<T = unknown>(obj: unknown, ...keys: string[]): T | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

/**
 * Локальная дата в формате YYYY-MM-DD.
 * НЕ используем toISOString() — она даёт UTC-дату и сдвигает период
 * на сутки в 00:00–03:00 МСК.
 */
function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ============================================================
// ABC/XYZ
// ============================================================

export interface AbcItem {
  university_id: string;
  name: string;
  manager: string;
  value: number;
  share: number;
  cumulative: number;
  category: AbcCategory;
}

export interface XyzItem {
  university_id: string;
  name: string;
  manager: string;
  mean: number;
  stddev: number;
  cv: number;
  category: XyzCategory;
}

export interface AbcXyzMatrix {
  AX: number; AY: number; AZ: number;
  BX: number; BY: number; BZ: number;
  CX: number; CY: number; CZ: number;
}

export async function fetchAbcXyz(
  from?: string,
  to?: string,
): Promise<{
  abcItems: AbcItem[];
  xyzItems: XyzItem[];
  matrix: AbcXyzMatrix;
}> {
  const empty = {
    abcItems: [] as AbcItem[],
    xyzItems: [] as XyzItem[],
    matrix: {
      AX: 0, AY: 0, AZ: 0,
      BX: 0, BY: 0, BZ: 0,
      CX: 0, CY: 0, CZ: 0,
    } as AbcXyzMatrix,
  };

  try {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const raw = await api.get<Record<string, unknown>>(
      `/analytics/abc-xyz?${params.toString()}`,
    );

    return {
      abcItems: pick<AbcItem[]>(raw, 'abc_items', 'abcItems') ?? [],
      xyzItems: pick<XyzItem[]>(raw, 'xyz_items', 'xyzItems') ?? [],
      matrix: pick<AbcXyzMatrix>(raw, 'matrix') ?? empty.matrix,
    };
  } catch {
    return empty;
  }
}

// ============================================================
// RFM
// ============================================================

export const RFM_SEGMENT_LABELS: Record<RfmSegment, string> = {
  champions: 'Чемпионы',
  loyal: 'Лояльные',
  potential_loyalist: 'Перспективные',
  new: 'Новые',
  promising: 'Многообещающие',
  need_attention: 'Требуют внимания',
  about_to_sleep: 'Засыпают',
  at_risk: 'В зоне риска',
  cant_lose: 'Нельзя терять',
  hibernating: 'Спящие',
  lost: 'Потерянные',
};

export async function fetchRfm(): Promise<RfmResult[]> {
  try {
    const raw = await api.get<RfmResult[] | { items?: RfmResult[] }>(
      '/analytics/rfm',
    );
    if (Array.isArray(raw)) return raw;
    return (raw as { items?: RfmResult[] }).items ?? [];
  } catch {
    return [];
  }
}

export function rfmDistribution(
  rfm: RfmResult[],
): { segment: RfmSegment; count: number; pct: number }[] {
  const safe = Array.isArray(rfm) ? rfm : [];
  const bySeg: Record<string, number> = {};
  safe.forEach((r) => {
    bySeg[r.segment] = (bySeg[r.segment] ?? 0) + 1;
  });
  const total = safe.length;

  return (Object.keys(RFM_SEGMENT_LABELS) as RfmSegment[])
    .map((s) => ({
      segment: s,
      count: bySeg[s] ?? 0,
      pct: total ? ((bySeg[s] ?? 0) / total) * 100 : 0,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

// ============================================================
// LTV
// ============================================================

export interface LtvEstimate {
  university_id: string;
  name: string;
  manager: string;
  lifetime_value: number;
  avg_monthly: number;
  projected_12m: number;
  /** Кол-во месяцев в базе. Алиасы: months_in_base (backend) / lifetime_months (UI). */
  months_in_base: number;
  /** @deprecated используйте months_in_base — оставлен для UI, который уже написан. */
  lifetime_months?: number;
  win_rate: number;
}

export async function fetchLtv(): Promise<LtvEstimate[]> {
  try {
    const raw = await api.get<LtvEstimate[] | { items?: LtvEstimate[] }>(
      '/analytics/ltv',
    );
    const list = Array.isArray(raw)
      ? raw
      : ((raw as { items?: LtvEstimate[] }).items ?? []);

    // Нормализуем алиасы — UI использует lifetime_months, backend отдаёт months_in_base
    return list.map((item) => ({
      ...item,
      lifetime_months: item.lifetime_months ?? item.months_in_base,
    }));
  } catch {
    return [];
  }
}

// ============================================================
// Когорты
// ============================================================

export interface CohortPivot {
  cohort: string;
  cohort_size: number;
  periods: { offset: number; active: number; retention: number }[];
}

export async function fetchCohortRetention(
  monthsBack = 12,
): Promise<CohortPivot[]> {
  try {
    const raw = await api.get<CohortPivot[] | { items?: CohortPivot[] }>(
      `/analytics/cohorts?monthsBack=${monthsBack}`,
    );
    if (Array.isArray(raw)) return raw;
    return (raw as { items?: CohortPivot[] }).items ?? [];
  } catch {
    return [];
  }
}

// ============================================================
// Сравнение периодов
// ============================================================

export async function fetchPeriodComparison(
  from: string,
  to: string,
  prevFrom: string,
  prevTo: string,
): Promise<PeriodComparison[]> {
  try {
    const params = new URLSearchParams({ from, to, prevFrom, prevTo });
    const raw = await api.get<PeriodComparison[] | { items?: PeriodComparison[] }>(
      `/analytics/period-comparison?${params.toString()}`,
    );
    if (Array.isArray(raw)) return raw;
    return (raw as { items?: PeriodComparison[] }).items ?? [];
  } catch {
    return [];
  }
}

/**
 * Дефолтные периоды для сравнения.
 * Локальная таймзона, БЕЗ toISOString() (иначе сдвиг UTC на сутки).
 *
 * «Текущий»:   с 1-го числа текущего месяца по сегодня
 * «Предыдущий»: с 1-го по последнее число прошлого месяца
 */
export function defaultPeriods(): {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
} {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = now;
  const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // Последний день предыдущего месяца: день 0 следующего месяца
  const prevTo = new Date(now.getFullYear(), now.getMonth(), 0);

  return {
    from: localISODate(from),
    to: localISODate(to),
    prevFrom: localISODate(prevFrom),
    prevTo: localISODate(prevTo),
  };
}

// ============================================================
// Метрики по вузам
// ============================================================

export async function fetchUniversityMetrics(
  from?: string,
  to?: string,
): Promise<UniversityMetrics[]> {
  try {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    const qs = params.toString();
    const raw = await api.get<
      { metrics?: UniversityMetrics[] } | UniversityMetrics[]
    >(`/analytics/metrics${qs ? `?${qs}` : ''}`);

    if (Array.isArray(raw)) return raw;
    return (raw as { metrics?: UniversityMetrics[] }).metrics ?? [];
  } catch {
    return [];
  }
}