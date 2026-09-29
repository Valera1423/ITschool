// backend/src/routes/contracts.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok, created, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { WsService } from '../services/ws.service.js';
import { buildScopeWhere, requirePermission } from '../middleware/auth.js';

const router = Router();

const APPROVAL_ROLE_MAP: Record<string, Array<'admin' | 'manager' | 'nam'>> = {
  'Менеджер': ['manager', 'admin'],
  'Юрист': ['manager', 'admin'],
  'Финансы': ['manager', 'admin'],
  'Директор': ['admin'],
  'Администратор': ['admin'],
};

function canDecideStep(stepRole: string, userRole: string): boolean {
  const allowed = APPROVAL_ROLE_MAP[stepRole] ?? ['manager', 'admin'];
  return allowed.includes(userRole as 'admin' | 'manager' | 'nam');
}

function toCamel(s: string): string {
  return s.replace(/([a-z0-9])_([a-z0-9])/g, (_, p, c) => p + c.toUpperCase());
}

function normalizeBody(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(normalizeBody);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[toCamel(k)] = normalizeBody(v);
  }
  return out;
}

// ============================================================
// Схемы
//
// ВАЖНО (исправлено): expiresAt — колонка @db.Date в схеме Prisma,
// т.е. строго YYYY-MM-DD. Раньше стояло .string().nullable().optional() —
// любая строка пролезала, а потом падала Prisma, отдавая 500.
// ============================================================
const createBody = z.object({
  universityId: z.string().uuid(),
  title: z.string().min(1),
  contractNumber: z.string().nullable().optional(),
  amount: z.number().default(0),
  currency: z.string().default('RUB'),
  expiresAt: z.string().date().nullable().optional(),  // YYYY-MM-DD
  notes: z.string().nullable().optional(),
  template: z.enum(['standard', 'short', 'legal']).default('standard'),
});

const approvalBody = z.object({
  decision: z.enum(['Одобрено', 'Отклонено']),
  comment: z.string().default(''),
  approverName: z.string(),
});

// ============================================================
// GET /contracts
// ============================================================
router.get('/', async (req, res, next) => {
  try {
    const scopeWhere = buildScopeWhere(req.auth!, 'universities');
    const where = {
      deletedAt: null,
      universityId: req.query.universityId as string | undefined,
      status: req.query.status as string | undefined,
      university: { deletedAt: null, ...scopeWhere },
    };
    const items = await prisma.contract.findMany({
      where,
      include: {
        approvals: { orderBy: { stepOrder: 'asc' } },
        versions: { orderBy: { version: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

// ============================================================
// POST /contracts
// ============================================================
router.post(
  '/',
  requirePermission('contracts.create'),
  async (req, res, next) => {
    try {
      const data = createBody.parse(normalizeBody(req.body));
      const scopeWhere = buildScopeWhere(req.auth!, 'universities');
      const uni = await prisma.university.findFirst({
        where: { id: data.universityId, deletedAt: null, ...scopeWhere },
        select: { id: true },
      });
      if (!uni) throw new AppError('UNIVERSITY_NOT_FOUND', 404);

      const contract = await prisma.contract.create({
        data: {
          university: { connect: { id: data.universityId } },
          title: data.title,
          contractNumber: data.contractNumber ?? null,
          amount: data.amount,
          currency: data.currency,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          notes: data.notes ?? null,
          createdBy: req.auth?.profileId ?? null,
        },
      });

      const templates: Record<string, string[]> = {
        standard: ['Менеджер', 'Юрист', 'Финансы', 'Директор'],
        short: ['Менеджер', 'Директор'],
        legal: ['Юрист', 'Директор'],
      };
      const roles = templates[data.template];
      await prisma.contractApproval.createMany({
        data: roles.map((role, i) => ({
          contractId: contract.id,
          stepOrder: i + 1,
          role,
          status: 'Ожидает' as const,
        })),
      });

      WsService.broadcast({
        type: 'contracts:created',
        entity: 'contracts',
        entityId: contract.id,
        actor: req.auth?.email,
      });

      return created(res, contract);
    } catch (e) { next(e); }
  },
);

// ============================================================
// GET /contracts/:id/approvals
// ============================================================
router.get('/:id/approvals', async (req, res, next) => {
  try {
    const scopeWhere = buildScopeWhere(req.auth!, 'universities');
    const contract = await prisma.contract.findFirst({
      where: {
        id: req.params.id,
        deletedAt: null,
        university: { deletedAt: null, ...scopeWhere },
      },
      select: { id: true },
    });
    if (!contract) throw new AppError('CONTRACT_NOT_FOUND', 404);
    const items = await prisma.contractApproval.findMany({
      where: { contractId: contract.id },
      orderBy: { stepOrder: 'asc' },
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

// ============================================================
// GET /contracts/:id/versions
// ============================================================
router.get('/:id/versions', async (req, res, next) => {
  try {
    const scopeWhere = buildScopeWhere(req.auth!, 'universities');
    const contract = await prisma.contract.findFirst({
      where: {
        id: req.params.id,
        deletedAt: null,
        university: { deletedAt: null, ...scopeWhere },
      },
      select: { id: true },
    });
    if (!contract) throw new AppError('CONTRACT_NOT_FOUND', 404);
    const items = await prisma.contractVersion.findMany({
      where: { contractId: contract.id },
      orderBy: { version: 'desc' },
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

// ============================================================
// GET /contracts/:id
// ============================================================
router.get('/:id', async (req, res, next) => {
  try {
    const scopeWhere = buildScopeWhere(req.auth!, 'universities');
    const item = await prisma.contract.findFirst({
      where: {
        id: req.params.id,
        deletedAt: null,
        university: { deletedAt: null, ...scopeWhere },
      },
      include: {
        approvals: { orderBy: { stepOrder: 'asc' } },
        versions: { orderBy: { version: 'desc' } },
      },
    });
    if (!item) throw new AppError('CONTRACT_NOT_FOUND', 404);
    return ok(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// PATCH /contracts/:id
// ============================================================
router.patch(
  '/:id',
  requirePermission('contracts.update'),
  async (req, res, next) => {
    try {
      const data = createBody.partial().parse(normalizeBody(req.body));
      const scopeWhere = buildScopeWhere(req.auth!, 'universities');
      const existing = await prisma.contract.findFirst({
        where: {
          id: req.params.id,
          deletedAt: null,
          university: { deletedAt: null, ...scopeWhere },
        },
        select: { id: true },
      });
      if (!existing) throw new AppError('CONTRACT_NOT_FOUND', 404);

      const item = await prisma.contract.update({
        where: { id: req.params.id },
        data: {
          ...data,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
          updatedAt: new Date(),
        } as never,
      });
      WsService.broadcast({
        type: 'contracts:updated',
        entity: 'contracts',
        entityId: item.id,
        actor: req.auth?.email,
      });
      return ok(res, item);
    } catch (e) { next(e); }
  },
);

// ============================================================
// DELETE /contracts/:id — soft delete
// ============================================================
router.delete(
  '/:id',
  requirePermission('contracts.delete'),
  async (req, res, next) => {
    try {
      const scopeWhere = buildScopeWhere(req.auth!, 'universities');
      const existing = await prisma.contract.findFirst({
        where: {
          id: req.params.id,
          deletedAt: null,
          university: { deletedAt: null, ...scopeWhere },
        },
        select: { id: true },
      });
      if (!existing) return noContent(res);

      await prisma.contract.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date() },
      });
      WsService.broadcast({
        type: 'contracts:deleted',
        entity: 'contracts',
        entityId: req.params.id,
        actor: req.auth?.email,
      });
      return noContent(res);
    } catch (e) { next(e); }
  },
);

// ============================================================
// POST /contracts/:id/restore — восстановление soft-deleted
// ============================================================
router.post(
  '/:id/restore',
  requirePermission('contracts.update'),
  async (req, res, next) => {
    try {
      const scopeWhere = buildScopeWhere(req.auth!, 'universities');
      const existing = await prisma.contract.findFirst({
        where: {
          id: req.params.id,
          university: { deletedAt: null, ...scopeWhere },
        },
        __includeDeleted: true,
      } as never);
      if (!existing) return noContent(res);

      await prisma.contract.update({
        where: { id: req.params.id },
        data: { deletedAt: null },
      });

      WsService.broadcast({
        type: 'contracts:updated',
        entity: 'contracts',
        entityId: req.params.id,
        actor: req.auth?.email,
      });

      return noContent(res);
    } catch (e) { next(e); }
  },
);

// ============================================================
// POST /contracts/approvals/:approvalId
// ============================================================
router.post(
  '/approvals/:approvalId',
  requirePermission('contracts.approve'),
  async (req, res, next) => {
    try {
      const data = approvalBody.parse(normalizeBody(req.body));
      const actor = req.auth!;

      const approval = await prisma.contractApproval.findUnique({
        where: { id: req.params.approvalId },
      });
      if (!approval) throw new AppError('NOT_FOUND', 404);
      if (approval.status !== 'Ожидает') {
        throw new AppError('STATE_CONFLICT', 409);
      }
      if (!canDecideStep(approval.role, actor.role)) {
        throw new AppError('ROLE_NOT_ALLOWED', 403);
      }

      const earlier = await prisma.contractApproval.findMany({
        where: {
          contractId: approval.contractId,
          stepOrder: { lt: approval.stepOrder },
        },
      });
      const blockedBy = earlier.find((a) => a.status === 'Ожидает');
      if (blockedBy) throw new AppError('STATE_CONFLICT', 409);

      const updated = await prisma.contractApproval.update({
        where: { id: approval.id },
        data: {
          status: data.decision,
          comment: data.comment,
          approverName: data.approverName,
          approverId: actor.profileId,
          decidedAt: new Date(),
        },
      });

      const all = await prisma.contractApproval.findMany({
        where: { contractId: approval.contractId },
      });
      const anyRejected = all.some((a) => a.status === 'Отклонено');
      const allApproved = all.every((a) => a.status === 'Одобрено' || a.status === 'Пропущено');

      await prisma.contract.update({
        where: { id: approval.contractId },
        data: {
          status: anyRejected ? 'Отклонён' : allApproved ? 'Согласован' : 'На проверке',
          currentStep: approval.stepOrder,
        },
      });

      WsService.broadcast({
        type: 'contracts:approval',
        entity: 'contracts',
        entityId: approval.contractId,
        actor: actor.email,
        payload: { decision: data.decision, role: approval.role },
      });

      return ok(res, updated);
    } catch (e) { next(e); }
  },
);

// ============================================================
// POST /contracts/:id/sign
// ============================================================
router.post(
  '/:id/sign',
  requirePermission('contracts.sign'),
  async (req, res, next) => {
    try {
      const contract = await prisma.contract.findUnique({ where: { id: req.params.id } });
      if (!contract) throw new AppError('CONTRACT_NOT_FOUND', 404);
      if (contract.status !== 'Согласован') throw new AppError('STATE_CONFLICT', 409);

      const item = await prisma.contract.update({
        where: { id: req.params.id },
        data: { status: 'Подписан', signedAt: new Date() },
      });

      WsService.broadcast({
        type: 'contracts:signed',
        entity: 'contracts',
        entityId: item.id,
        actor: req.auth?.email,
      });

      return ok(res, item);
    } catch (e) { next(e); }
  },
);

export default router;