// backend/src/routes/learners.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import {
  PiiService,
  LEARNER_IDENTITY_FIELDS,
  LEARNER_CONTACT_FIELDS,
} from '../services/pii.service.js';
import { LearnersImportService } from '../services/learners-import.service.js';
import { LearnersExportService } from '../services/learners-export.service.js';
import { requireRole, requireMfa } from '../middleware/auth.js';
import {
  ok,
  okPaginated,
  noContent,
  parsePagination,
  buildPagination,
} from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { strictRateLimit, reportRateLimit } from '../middleware/rateLimit.js';

const router = Router();

const ALL_PII = [
  ...LEARNER_CONTACT_FIELDS,
  ...LEARNER_IDENTITY_FIELDS,
] as const;

function decryptLearner<T extends Record<string, unknown>>(row: T): T {
  return PiiService.decryptFields(row, ALL_PII as never);
}

// ============================================================
// GET /learners
// ============================================================
router.get('/', requireMfa, async (req, res, next) => {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const search = String(req.query.search ?? '').trim();

    const where = search
      ? {
          OR: [
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { middleName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await prisma.$transaction([
      prisma.learner.findMany({
        where, skip, take,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      prisma.learner.count({ where }),
    ]);

    const decrypted = items.map((it) =>
      decryptLearner(it as unknown as Record<string, unknown>),
    );

    return okPaginated(
      res,
      decrypted,
      buildPagination(page, pageSize, total),
    );
  } catch (e) { next(e); }
});

// ============================================================
// POST /learners/import
// ============================================================
const learnerRowSchema = z.object({
  lastName: z.string().min(1),
  firstName: z.string().min(1),
  middleName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  snils: z.string().nullable().optional(),
  passportSeries: z.string().nullable().optional(),
  passportNumber: z.string().nullable().optional(),
  passportIssuedBy: z.string().nullable().optional(),
  passportIssuedAt: z.string().nullable().optional(),
  passportDeptCode: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  regRegion: z.string().nullable().optional(),
  regCity: z.string().nullable().optional(),
  regStreet: z.string().nullable().optional(),
  regHouse: z.string().nullable().optional(),
  regFlat: z.string().nullable().optional(),
  regIndex: z.string().nullable().optional(),
  educationLevel: z.string().nullable().optional(),
  diplomaProfession: z.string().nullable().optional(),
  diplomaInstitution: z.string().nullable().optional(),
  diplomaLastName: z.string().nullable().optional(),
  diplomaNumber: z.string().nullable().optional(),
  diplomaSeries: z.string().nullable().optional(),
  diplomaRegNumber: z.string().nullable().optional(),
  diplomaIssuedAt: z.string().nullable().optional(),
});

const importBody = z.object({
  rows: z.array(learnerRowSchema).min(1).max(5000),
  mode: z.enum(['upsert', 'create-only']).default('upsert'),
});

router.post(
  '/import',
  requireRole('admin', 'manager'),
  requireMfa,
  strictRateLimit,
  async (req, res, next) => {
    try {
      const data = importBody.parse(req.body);
      const result = await LearnersImportService.importBatch(
        data.rows,
        req.auth!,
        { createOnly: data.mode === 'create-only' },
      );
      return ok(res, result);
    } catch (e) { next(e); }
  },
);

// ============================================================
// GET /learners/export.xlsx
// GET /learners/export.pdf
// ВАЖНО: должны быть ДО /:id
// ============================================================
router.get(
  '/export.xlsx',
  requireMfa,
  reportRateLimit,
  async (req, res, next) => {
    try {
      const search = String(req.query.search ?? '').trim() || undefined;
      const buf = await LearnersExportService.toXlsx({ search });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="learners-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      );
      res.setHeader('Content-Length', buf.length);
      res.end(buf);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/export.pdf',
  requireMfa,
  reportRateLimit,
  async (req, res, next) => {
    try {
      const search = String(req.query.search ?? '').trim() || undefined;
      const buf = await LearnersExportService.toPdf({ search });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="learners-${new Date().toISOString().slice(0, 10)}.pdf"`,
      );
      res.setHeader('Content-Length', buf.length);
      res.end(buf);
    } catch (e) {
      next(e);
    }
  },
);

// ============================================================
// GET /learners/:id
// ============================================================
router.get('/:id', requireMfa, async (req, res, next) => {
  try {
    const item = await prisma.learner.findUnique({
      where: { id: req.params.id },
      include: {
        orders: {
          include: { course: true, stream: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!item) throw new AppError('NOT_FOUND', 404);

    const decrypted = decryptLearner(item as unknown as Record<string, unknown>);

    void PiiService.logAccess({
      userId: req.auth!.profileId,
      userEmail: req.auth!.email,
      subjectId: item.id,
      entity: 'learners',
      fields: [...ALL_PII],
      purpose: 'view',
      piiCategory: 'identity',
      ip: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string) ?? null,
    });

    return ok(res, decrypted);
  } catch (e) { next(e); }
});

// ============================================================
// DELETE /learners/:id — только admin
// ============================================================
router.delete('/:id', requireRole('admin'), requireMfa, async (req, res, next) => {
  try {
    await prisma.learner.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;