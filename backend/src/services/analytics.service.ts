// backend/src/services/analytics.service.ts
import { prisma } from '../db/prisma.js';
import { cached, invalidate } from '../db/redis.js';

// ============================================================
// Типы
// ============================================================
export interface AbcItem {
  university_id: string;
  name: string;
  manager: string;
  value: number;
  share: number;
  cumulative: number;
  category: 'A' | 'B' | 'C';
}

export interface XyzItem {
  university_id: string;
  name: string;
  manager: string;
  mean: number;
  stddev: number;
  cv: number;
  category: 'X' | 'Y' | 'Z';
}

export interface AbcXyzMatrix {
  AX: number; AY: number; AZ: number;
  BX: number; BY: number; BZ: number;
  CX: number; CY: number; CZ: number;
}

export interface RfmResult {
  university_id: string;
  name: string;
  manager: string;
  recency: number;
  frequency: number;
  monetary: number;
  r_score: number;
  f_score: number;
  m_score: number;
  segment: string;
}

export interface LtvEstimate {
  university_id: string;
  name: string;
  manager: string;
  lifetime_value: number;
  avg_monthly: number;
  projected_12m: number;
  months_in_base: number;
  win_rate: number;
}

export interface CohortPivot {
  cohort: string;
  cohort_size: number;
  periods: { offset: number; active: number; retention: number }[];
}

export interface ComparisonItem {
  metric: string;
  current_value: number;
  previous_value: number;
  change_pct: number;
}

export interface TopRevenueItem {
  id: string;
  name: string;
  manager: string;
  revenue: number;
}

export interface ManagerPerfItem {
  manager: string;
  total: number;
  won: number;
  lost: number;
  conversion: number;
  plan: number;
}

export interface UniversityMetric {
  university_id: string;
  name: string;
  manager: string;
  status: string;
  created_at: Date;
  contract_value: number;
  interactions_count: number;
  completed_interactions: number;
  last_touch_at: Date | null;
  first_touch_at: Date | null;
  days_since_last_touch: number;
  days_since_first_touch: number;
  open_tasks_count: number;
  done_tasks_count: number;
  contracts_value: number;
  contracts_count: number;
}

// ============================================================
// SERVICE
// ============================================================
export class AnalyticsService {
  // ------------------------------------------------------------
  // ABC/XYZ
  //
  // ВАЖНО (исправлено): XYZ теперь считается ПО КАЖДОМУ вузу.
  //
  //   Для каждого вуза берём количество касаний по интервалам
  //   (месяцы за период) → считаем mean, stddev, CV = stddev/mean.
  //   Классификация:
  //     CV < 0.33   → X (стабильно)
  //     0.33 ≤ CV < 0.6 → Y (средне)
  //     CV ≥ 0.6    → Z (нестабильно)
  //
  //   Раньше использовалось глобальное среднее — это давало
  //   одинаковую XYZ-категорию для всех вузов, что противоречит
  //   методологии анализа.
  // ------------------------------------------------------------
  static async abcXyz(from?: string, to?: string): Promise<{
    abcItems: AbcItem[];
    xyzItems: XyzItem[];
    matrix: AbcXyzMatrix;
  }> {
    const key = `analytics:abc-xyz:${from ?? 'all'}:${to ?? 'now'}`;
    return cached(key, () => this.computeAbcXyz(from, to), 300);
  }

  private static async computeAbcXyz(from?: string, to?: string) {
    const dateFrom = from ? new Date(from) : new Date('2000-01-01');
    const dateTo = to ? new Date(to) : new Date();

    // ABC: по выручке (contract_value) — что было
    const where = {
      deletedAt: null,
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: dateFrom } : {}),
              ...(to ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    const unis = await prisma.university.findMany({
      where,
      select: {
        id: true,
        name: true,
        manager: true,
        contractValue: true,
      },
    });

    const sorted = unis
      .map((u) => ({
        university_id: u.id,
        name: u.name,
        manager: u.manager,
        value: Number(u.contractValue),
      }))
      .filter((u) => u.value > 0)
      .sort((a, b) => b.value - a.value);

    const total = sorted.reduce((s, u) => s + u.value, 0);
    let cumulative = 0;
    const abcItems: AbcItem[] = sorted.map((u) => {
      const share = total > 0 ? (u.value / total) * 100 : 0;
      cumulative += share;
      const category: 'A' | 'B' | 'C' = cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C';
      return {
        university_id: u.university_id,
        name: u.name,
        manager: u.manager,
        value: u.value,
        share,
        cumulative,
        category,
      };
    });

    // XYZ: пер-вузовский CV по числу касаний на интервалах
    // Считаем месячные "корзины" в диапазоне [dateFrom, dateTo].
    // Если диапазон меньше 2 месяцев — берём последние 6 месяцев.
    const periods = this.buildMonthPeriods(dateFrom, dateTo);

    // Все interaction для вузов из abcItems — одним запросом
    const universityIds = abcItems.map((a) => a.university_id);
    const interactions = universityIds.length
      ? await prisma.interaction.findMany({
          where: {
            universityId: { in: universityIds },
            deletedAt: null,
            interactionDate: { gte: periods[0].start, lte: periods[periods.length - 1].end },
          },
          select: { universityId: true, interactionDate: true },
        })
      : [];

    // Группируем: count[uniId][periodIndex]
    const countsByUni: Map<string, number[]> = new Map(
      universityIds.map((id) => [id, new Array(periods.length).fill(0)]),
    );
    for (const i of interactions) {
      const idx = periods.findIndex(
        (p) => i.interactionDate >= p.start && i.interactionDate <= p.end,
      );
      if (idx < 0) continue;
      const arr = countsByUni.get(i.universityId);
      if (arr) arr[idx] += 1;
    }

    const xyzItems: XyzItem[] = abcItems.map((a) => {
      const counts = countsByUni.get(a.university_id) ?? [];
      const { mean, stddev, cv, category } = this.classifyXyz(counts);
      return {
        university_id: a.university_id,
        name: a.name,
        manager: a.manager,
        mean,
        stddev,
        cv,
        category,
      };
    });

    // Матрица ABC × XYZ
    const matrix: AbcXyzMatrix = {
      AX: 0, AY: 0, AZ: 0,
      BX: 0, BY: 0, BZ: 0,
      CX: 0, CY: 0, CZ: 0,
    };
    const xyzMap = new Map(xyzItems.map((x) => [x.university_id, x.category]));
    for (const a of abcItems) {
      const xyz = xyzMap.get(a.university_id) ?? 'Z';
      const key = `${a.category}${xyz}` as keyof AbcXyzMatrix;
      if (matrix[key] !== undefined) matrix[key]++;
    }

    return { abcItems, xyzItems, matrix };
  }

  /**
   * Разбить период на месячные интервалы.
   * Возвращает минимум 2 интервала (иначе CV не считается).
   */
  private static buildMonthPeriods(
    from: Date,
    to: Date,
  ): { start: Date; end: Date }[] {
    const start = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth() + 1, 0, 23, 59, 59, 999);

    const periods: { start: Date; end: Date }[] = [];
    let cur = new Date(start);
    while (cur <= end && periods.length < 36) {
      const pStart = new Date(cur);
      const pEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999);
      periods.push({ start: pStart, end: pEnd });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }

    // Если диапазон меньше 2 месяцев — берём последние 6 месяцев до `to`
    if (periods.length < 2) {
      const fallback: { start: Date; end: Date }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(to.getFullYear(), to.getMonth() - i, 1);
        fallback.push({
          start: d,
          end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999),
        });
      }
      return fallback;
    }
    return periods;
  }

  /**
   * XYZ-классификация по массиву счётчиков.
   * Если счётчики пусты или mean = 0 — возвращаем Z (нестабильно).
   */
  private static classifyXyz(counts: number[]): {
    mean: number;
    stddev: number;
    cv: number;
    category: 'X' | 'Y' | 'Z';
  } {
    const n = counts.length;
    if (n === 0) return { mean: 0, stddev: 0, cv: 0, category: 'Z' };

    const mean = counts.reduce((s, c) => s + c, 0) / n;
    if (mean === 0) return { mean: 0, stddev: 0, cv: 0, category: 'Z' };

    const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);
    const cv = stddev / mean;

    const category: 'X' | 'Y' | 'Z' = cv < 0.33 ? 'X' : cv < 0.6 ? 'Y' : 'Z';
    return { mean, stddev, cv, category };
  }

  // ------------------------------------------------------------
  // RFM
  // ------------------------------------------------------------
  static async rfm(): Promise<RfmResult[]> {
    return cached('analytics:rfm', () => this.computeRfm(), 600);
  }

  private static async computeRfm(): Promise<RfmResult[]> {
    const unis = await prisma.university.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        manager: true,
        contractValue: true,
        interactions: {
          where: { deletedAt: null },
          orderBy: { interactionDate: 'desc' },
          take: 1,
          select: { interactionDate: true },
        },
        _count: { select: { interactions: true } },
      },
    });

    const now = Date.now();
    return unis.map((u) => {
      const last = u.interactions[0]?.interactionDate;
      const recency = last ? Math.floor((now - last.getTime()) / 86400000) : 9999;
      const frequency = u._count.interactions;
      const monetary = Number(u.contractValue);

      const r = recency < 30 ? 5 : recency < 90 ? 4 : recency < 180 ? 3 : recency < 365 ? 2 : 1;
      const f = frequency >= 20 ? 5 : frequency >= 10 ? 4 : frequency >= 5 ? 3 : frequency >= 2 ? 2 : 1;
      const m = monetary >= 1_000_000 ? 5 : monetary >= 300_000 ? 4 : monetary >= 100_000 ? 3 : monetary > 0 ? 2 : 1;

      let segment = 'new';
      if (r >= 4 && f >= 4 && m >= 4) segment = 'champions';
      else if (r >= 3 && f >= 3 && m >= 3) segment = 'loyal';
      else if (r >= 4 && f <= 2) segment = 'new';
      else if (r >= 3 && m >= 4) segment = 'potential_loyalist';
      else if (r <= 2 && f >= 4 && m >= 4) segment = 'cant_lose';
      else if (r <= 2 && m >= 3) segment = 'at_risk';
      else if (r <= 2 && f <= 2) segment = 'lost';

      return {
        university_id: u.id,
        name: u.name,
        manager: u.manager,
        recency,
        frequency,
        monetary,
        r_score: r,
        f_score: f,
        m_score: m,
        segment,
      };
    });
  }

  // ------------------------------------------------------------
  // LTV
  // ------------------------------------------------------------
  static async ltv(): Promise<LtvEstimate[]> {
    return cached('analytics:ltv', () => this.computeLtv(), 600);
  }

  private static async computeLtv(): Promise<LtvEstimate[]> {
    const unis = await prisma.university.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        manager: true,
        contractValue: true,
        createdAt: true,
        contracts: {
          where: { deletedAt: null },
          select: { amount: true, status: true },
        },
      },
    });

    const now = Date.now();
    return unis
      .map((u) => {
        const won = u.contracts.filter((c) =>
          ['Согласован', 'Подписан'].includes(c.status),
        );
        const all = u.contracts;
        const lifetimeValue =
          won.reduce((s, c) => s + Number(c.amount), 0) || Number(u.contractValue);

        const monthsInBase = Math.max(
          1,
          Math.floor((now - u.createdAt.getTime()) / (30 * 86400000)),
        );
        const avgMonthly = lifetimeValue / monthsInBase;

        return {
          university_id: u.id,
          name: u.name,
          manager: u.manager,
          lifetime_value: lifetimeValue,
          avg_monthly: Math.round(avgMonthly),
          projected_12m: Math.round(avgMonthly * 12),
          months_in_base: monthsInBase,
          win_rate: all.length ? Math.round((won.length / all.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.lifetime_value - a.lifetime_value);
  }

  // ------------------------------------------------------------
  // Cohorts
  // ------------------------------------------------------------
  static async cohorts(monthsBack: number): Promise<CohortPivot[]> {
    const key = `analytics:cohorts:${monthsBack}`;
    return cached(key, () => this.computeCohorts(monthsBack), 600);
  }

  private static async computeCohorts(monthsBack: number): Promise<CohortPivot[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - monthsBack);

    const unis = await prisma.university.findMany({
      where: { deletedAt: null, createdAt: { gte: since } },
      select: {
        id: true,
        createdAt: true,
        interactions: {
          where: { deletedAt: null },
          select: { createdAt: true },
        },
        tasks: {
          where: { deletedAt: null },
          select: { createdAt: true },
        },
        comments: {
          where: { deletedAt: null },
          select: { createdAt: true },
        },
      },
    });

    const monthKey = (d: Date): string =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const cohorts: Record<
      string,
      { size: number; activityByMonth: Record<string, Set<string>> }
    > = {};

    for (const u of unis) {
      const cohortKey = monthKey(u.createdAt);
      if (!cohorts[cohortKey]) {
        cohorts[cohortKey] = { size: 0, activityByMonth: {} };
      }
      cohorts[cohortKey].size++;

      const activity = [
        ...u.interactions.map((i) => i.createdAt),
        ...u.tasks.map((t) => t.createdAt),
        ...u.comments.map((c) => c.createdAt),
      ];

      for (const a of activity) {
        const mk = monthKey(a);
        if (!cohorts[cohortKey].activityByMonth[mk]) {
          cohorts[cohortKey].activityByMonth[mk] = new Set();
        }
        cohorts[cohortKey].activityByMonth[mk].add(u.id);
      }
    }

    return Object.entries(cohorts)
      .map(([cohort, data]) => {
        const [cy, cm] = cohort.split('-').map(Number);
        const periods = Object.entries(data.activityByMonth)
          .map(([m, set]) => {
            const [my, mm] = m.split('-').map(Number);
            const offset = (my - cy) * 12 + (mm - cm);
            return {
              offset,
              active: set.size,
              retention:
                data.size > 0 ? Math.round((set.size / data.size) * 100) : 0,
            };
          })
          .sort((a, b) => a.offset - b.offset);

        return { cohort, cohort_size: data.size, periods };
      })
      .sort((a, b) => a.cohort.localeCompare(b.cohort));
  }

  // ------------------------------------------------------------
  // Period comparison
  // ------------------------------------------------------------
  static async periodComparison(p: {
    from: string;
    to: string;
    prevFrom: string;
    prevTo: string;
  }): Promise<ComparisonItem[]> {
    const key = `analytics:cmp:${p.from}:${p.to}:${p.prevFrom}:${p.prevTo}`;
    return cached(
      key,
      async () => {
        const [currU, prevU, currC, prevC, currI, prevI] = await Promise.all([
          prisma.university.count({
            where: { deletedAt: null, createdAt: { gte: new Date(p.from), lte: new Date(p.to) } },
          }),
          prisma.university.count({
            where: { deletedAt: null, createdAt: { gte: new Date(p.prevFrom), lte: new Date(p.prevTo) } },
          }),
          prisma.contract.aggregate({
            where: {
              deletedAt: null,
              createdAt: { gte: new Date(p.from), lte: new Date(p.to) },
              status: { in: ['Согласован', 'Подписан'] },
            },
            _sum: { amount: true },
          }),
          prisma.contract.aggregate({
            where: {
              deletedAt: null,
              createdAt: { gte: new Date(p.prevFrom), lte: new Date(p.prevTo) },
              status: { in: ['Согласован', 'Подписан'] },
            },
            _sum: { amount: true },
          }),
          prisma.interaction.count({
            where: {
              deletedAt: null,
              interactionDate: { gte: new Date(p.from), lte: new Date(p.to) },
            },
          }),
          prisma.interaction.count({
            where: {
              deletedAt: null,
              interactionDate: { gte: new Date(p.prevFrom), lte: new Date(p.prevTo) },
            },
          }),
        ]);

        const cmp = (
          metric: string,
          current: number,
          previous: number,
        ): ComparisonItem => ({
          metric,
          current_value: current,
          previous_value: previous,
          change_pct:
            previous > 0
              ? Math.round(((current - previous) / previous) * 100)
              : current > 0
                ? 100
                : 0,
        });

        return [
          cmp('Новые вузы', currU, prevU),
          cmp('Выручка (согласовано)', Number(currC._sum.amount ?? 0), Number(prevC._sum.amount ?? 0)),
          cmp('Взаимодействия', currI, prevI),
        ];
      },
      300,
    );
  }

  // ------------------------------------------------------------
  // Top by revenue
  // ------------------------------------------------------------
  static async topByRevenue(limit = 10): Promise<TopRevenueItem[]> {
    const unis = await prisma.university.findMany({
      where: { deletedAt: null },
      orderBy: { contractValue: 'desc' },
      take: limit,
      select: { id: true, name: true, manager: true, contractValue: true },
    });
    return unis.map((u) => ({
      id: u.id,
      name: u.name,
      manager: u.manager,
      revenue: Number(u.contractValue),
    }));
  }

  // ------------------------------------------------------------
  // Manager performance
  // ------------------------------------------------------------
  static async managerPerformance(plan = 5): Promise<ManagerPerfItem[]> {
    const unis = await prisma.university.findMany({
      where: { deletedAt: null },
      select: { manager: true, status: true },
    });
    const map: Record<string, ManagerPerfItem> = {};
    for (const u of unis) {
      const m = u.manager || 'Без менеджера';
      if (!map[m]) map[m] = { manager: m, total: 0, won: 0, lost: 0, conversion: 0, plan };
      map[m].total++;
      if (u.status === 'Партнёр') map[m].won++;
      else if (u.status === 'Отказ') map[m].lost++;
    }
    return Object.values(map)
      .map((m) => ({
        ...m,
        conversion: m.total > 0 ? Math.round((m.won / m.total) * 100) : 0,
      }))
      .sort((a, b) => b.conversion - a.conversion);
  }

  // ------------------------------------------------------------
  // Metrics (порт SQL RPC university_metrics)
  // ------------------------------------------------------------
  static async metrics(from?: string, to?: string): Promise<UniversityMetric[]> {
    const key = `analytics:metrics:${from ?? 'all'}:${to ?? 'now'}`;
    return cached(key, () => this.computeMetrics(from, to), 300);
  }

  private static async computeMetrics(
    from?: string,
    to?: string,
  ): Promise<UniversityMetric[]> {
    const dateFrom = from ? new Date(from) : new Date('2000-01-01');
    const dateTo = to ? new Date(to) : new Date();

    const unis = await prisma.university.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        manager: true,
        status: true,
        createdAt: true,
        contractValue: true,
        interactions: {
          where: {
            deletedAt: null,
            interactionDate: { gte: dateFrom, lte: dateTo },
          },
          select: {
            createdAt: true,
            status: true,
            interactionDate: true,
          },
        },
        tasks: {
          where: { deletedAt: null },
          select: { status: true, dueDate: true },
        },
        contracts: {
          where: {
            deletedAt: null,
            status: { in: ['Согласован', 'Подписан'] },
          },
          select: { amount: true },
        },
      },
    });

    const now = Date.now();

    return unis.map((u) => {
      const interactions = u.interactions;
      const interactionsCount = interactions.length;
      const completed = interactions.filter((i) => i.status === 'Завершено').length;

      const times = interactions.map((i) => i.createdAt.getTime());
      const lastTouch = times.length ? new Date(Math.max(...times)) : null;
      const firstTouch = times.length ? new Date(Math.min(...times)) : null;

      const openTasks = u.tasks.filter(
        (t) => !['Готово', 'Отменено'].includes(t.status),
      ).length;
      const doneTasks = u.tasks.filter((t) => t.status === 'Готово').length;

      const contractsValue = u.contracts.reduce(
        (s, c) => s + Number(c.amount),
        0,
      );

      return {
        university_id: u.id,
        name: u.name,
        manager: u.manager,
        status: u.status,
        created_at: u.createdAt,
        contract_value: Number(u.contractValue),
        interactions_count: interactionsCount,
        completed_interactions: completed,
        last_touch_at: lastTouch,
        first_touch_at: firstTouch,
        days_since_last_touch: lastTouch
          ? Math.floor((now - lastTouch.getTime()) / 86400000)
          : 999,
        days_since_first_touch: firstTouch
          ? Math.floor((now - firstTouch.getTime()) / 86400000)
          : 999,
        open_tasks_count: openTasks,
        done_tasks_count: doneTasks,
        contracts_value: contractsValue,
        contracts_count: u.contracts.length,
      };
    });
  }

  static async invalidateCache(): Promise<void> {
    await invalidate('analytics:*');
  }
}