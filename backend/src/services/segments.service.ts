import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { AppError } from '../errors/codes.js';
import type { Prisma } from '@prisma/client';

// ============================================================
// Типы
// ============================================================
type Operator =
  | 'equals' | 'not_equals' | 'contains' | 'not_contains'
  | 'greater' | 'less' | 'empty' | 'not_empty'
  | 'in' | 'not_in';

interface SegmentRule {
  field: string;
  operator: Operator;
  value?: unknown;
}

const DIRECT_FIELDS = new Set([
  'name', 'city', 'direction', 'product', 'status',
  'manager', 'contact_name', 'contact_email', 'contact_phone',
  'handover_status', 'contract_number', 'source',
]);

const COMPUTED_FIELDS = new Set([
  'license_days_left', 'last_touch_days', 'interactions_count',
  'open_tasks_count', 'has_email', 'has_phone', 'has_tags',
]);

export class SegmentsService {
  // ============================================================
  // evaluate
  // ============================================================
  static async evaluate(
    segmentId: string,
    opts: { limit?: number; skip?: number } = {},
  ): Promise<{ items: unknown[]; total: number }> {
    const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
    if (!segment) throw new AppError('NOT_FOUND', 404);

    const rules = (segment.rules ?? []) as SegmentRule[];
    const logic = (segment.logic as 'AND' | 'OR') ?? 'AND';

    const where = await this.buildWhere(rules, logic);

    const [items, total] = await prisma.$transaction([
      prisma.university.findMany({
        where,
        take: Math.min(1000, opts.limit ?? 100),
        skip: opts.skip ?? 0,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: true,
          directionRef: true,
          productRef: true,
          managerRef: true,
          contacts: { where: { isPrimary: true } },
          tags: { include: { tag: true } },
        },
      }),
      prisma.university.count({ where }),
    ]);

    // Обновляем статистику сегмента — «fire & forget»
    void prisma.segment.update({
      where: { id: segmentId },
      data: { lastCount: total, lastRunAt: new Date() },
    }).catch(() => {});

    return { items, total };
  }

  static async evaluateIds(segmentId: string): Promise<string[]> {
    const { items } = await this.evaluate(segmentId, { limit: 100_000 });
    return (items as { id: string }[]).map((i) => i.id);
  }

  // ============================================================
  // Построение where целиком
  // ============================================================
  private static async buildWhere(
    rules: SegmentRule[],
    logic: 'AND' | 'OR',
  ): Promise<Prisma.UniversityWhereInput> {
    if (rules.length === 0) return { deletedAt: null };

    const directRules = rules.filter((r) => DIRECT_FIELDS.has(r.field));
    const computedRules = rules.filter((r) => COMPUTED_FIELDS.has(r.field));

    // Прямые → готовые where-объекты
    const directClauses: Prisma.UniversityWhereInput[] = directRules
      .map((r) => this.ruleToWhere(r))
      .filter((w) => Object.keys(w).length > 0);

    // Вычисляемые → set of ids
    let computedIds: string[] | null = null;
    if (computedRules.length > 0) {
      computedIds = await this.computeIds(computedRules, logic);
    }

    // Собираем всё в один AND/OR высшего уровня
    const andParts: Prisma.UniversityWhereInput[] = [{ deletedAt: null }];

    if (logic === 'AND') {
      // Все прямые + (если есть) попадание в computed
      for (const c of directClauses) andParts.push(c);
      if (computedIds !== null) {
        andParts.push({ id: { in: computedIds } });
      }
    } else {
      // OR: либо прямое, либо computed
      const orParts: Prisma.UniversityWhereInput[] = [...directClauses];
      if (computedIds !== null) {
        orParts.push({ id: { in: computedIds } });
      }
      if (orParts.length === 0) {
        // Нет ни прямых, ни вычисляемых → пустой результат
        return { id: { in: [] } };
      }
      andParts.push({ OR: orParts });
    }

    return { AND: andParts };
  }

  // ============================================================
  // Прямое правило → Prisma.where
  // ============================================================
  private static ruleToWhere(rule: SegmentRule): Prisma.UniversityWhereInput {
    const { field, operator, value } = rule;
    const column = snakeToCamel(field);

    switch (operator) {
      case 'equals':
        return { [column]: value } as Prisma.UniversityWhereInput;
      case 'not_equals':
        return { NOT: { [column]: value } } as Prisma.UniversityWhereInput;
      case 'contains':
        return { [column]: { contains: String(value), mode: 'insensitive' } } as Prisma.UniversityWhereInput;
      case 'not_contains':
        return { NOT: { [column]: { contains: String(value), mode: 'insensitive' } } } as Prisma.UniversityWhereInput;
      case 'greater':
        return { [column]: { gt: value } } as Prisma.UniversityWhereInput;
      case 'less':
        return { [column]: { lt: value } } as Prisma.UniversityWhereInput;
      case 'empty':
        return { OR: [{ [column]: null }, { [column]: '' }] } as Prisma.UniversityWhereInput;
      case 'not_empty':
        return {
          AND: [{ [column]: { not: null } }, { NOT: { [column]: '' } }],
        } as Prisma.UniversityWhereInput;
      case 'in':
        return {
          [column]: { in: Array.isArray(value) ? value : [value] },
        } as Prisma.UniversityWhereInput;
      case 'not_in':
        return {
          NOT: { [column]: { in: Array.isArray(value) ? value : [value] } },
        } as Prisma.UniversityWhereInput;
      default:
        return {};
    }
  }

  // ============================================================
  // Вычисляемые правила
  // ============================================================
  private static async computeIds(
    rules: SegmentRule[],
    logic: 'AND' | 'OR',
  ): Promise<string[]> {
    if (rules.length === 0) return [];

    const sets = await Promise.all(
      rules.map(async (r) => new Set(await this.computeRuleIds(r))),
    );

    if (sets.length === 1) return Array.from(sets[0]);

    if (logic === 'AND') {
      let result = new Set(sets[0]);
      for (let i = 1; i < sets.length; i++) {
        result = new Set([...result].filter((id) => sets[i].has(id)));
      }
      return Array.from(result);
    }

    const union = new Set<string>();
    for (const s of sets) for (const id of s) union.add(id);
    return Array.from(union);
  }

  private static async computeRuleIds(rule: SegmentRule): Promise<string[]> {
    const { field, operator, value } = rule;
    const numValue = Number(value);

    switch (field) {
      case 'interactions_count': {
        const unis = await prisma.university.findMany({
          where: { deletedAt: null },
          select: { id: true, _count: { select: { interactions: true } } },
        });
        return unis
          .filter((u) => compareNum(u._count.interactions, operator, numValue))
          .map((u) => u.id);
      }

      case 'open_tasks_count': {
        const unis = await prisma.university.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            tasks: {
              where: { deletedAt: null, status: { notIn: ['Готово', 'Отменено'] } },
              select: { id: true },
            },
          },
        });
        return unis
          .filter((u) => compareNum(u.tasks.length, operator, numValue))
          .map((u) => u.id);
      }

      case 'last_touch_days': {
        const unis = await prisma.university.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            interactions: {
              where: { deletedAt: null },
              orderBy: { interactionDate: 'desc' },
              take: 1,
              select: { interactionDate: true },
            },
          },
        });
        const now = Date.now();
        return unis
          .map((u) => {
            const last = u.interactions[0]?.interactionDate;
            const days = last ? Math.floor((now - last.getTime()) / 86400000) : 999;
            return { id: u.id, days };
          })
          .filter((x) => compareNum(x.days, operator, numValue))
          .map((x) => x.id);
      }

      case 'license_days_left': {
        const unis = await prisma.university.findMany({
          where: { deletedAt: null, licenseExpiresAt: { not: null } },
          select: { id: true, licenseExpiresAt: true },
        });
        const now = Date.now();
        return unis
          .map((u) => ({
            id: u.id,
            days: Math.floor((u.licenseExpiresAt!.getTime() - now) / 86400000),
          }))
          .filter((x) => compareNum(x.days, operator, numValue))
          .map((x) => x.id);
      }

      case 'has_email': {
        const unis = await prisma.university.findMany({
          where: { deletedAt: null },
          select: { id: true, contactEmail: true },
        });
        const want = Boolean(value);
        return unis.filter((u) => Boolean(u.contactEmail) === want).map((u) => u.id);
      }

      case 'has_phone': {
        const unis = await prisma.university.findMany({
          where: { deletedAt: null },
          select: { id: true, contactPhone: true },
        });
        const want = Boolean(value);
        return unis.filter((u) => Boolean(u.contactPhone) === want).map((u) => u.id);
      }

      case 'has_tags': {
        const unis = await prisma.university.findMany({
          where: { deletedAt: null },
          select: { id: true, tags: { select: { tagId: true } } },
        });
        const want = Boolean(value);
        return unis.filter((u) => (u.tags.length > 0) === want).map((u) => u.id);
      }

      default:
        return [];
    }
  }
}

// ============================================================
// Helpers
// ============================================================
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function compareNum(actual: number, op: Operator, expected: number): boolean {
  switch (op) {
    case 'equals': return actual === expected;
    case 'greater': return actual > expected;
    case 'less': return actual < expected;
    default: return true;
  }
}