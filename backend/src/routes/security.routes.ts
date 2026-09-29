// backend/src/routes/security.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requirePermission, requireMfa } from '../middleware/auth.js';
import { ok, created, noContent } from '../utils/response.js';
import { getClientIp } from '../utils/ip.js';
import {
  PiiService,
  LEARNER_IDENTITY_FIELDS,
  LEARNER_CONTACT_FIELDS,
} from '../services/pii.service.js';

const router = Router();

// ============================================================
// SESSIONS
// ============================================================
router.get('/sessions', async (req, res, next) => {
  try {
    const userId = req.auth!.profileId;
    if (!userId) return ok(res, []);
    const items = await prisma.userSession.findMany({
      where: { userId, revoked: false, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

router.delete('/sessions/:id', async (req, res, next) => {
  try {
    await prisma.userSession.update({
      where: { id: req.params.id },
      data: { revoked: true },
    });
    return noContent(res);
  } catch (e) { next(e); }
});

router.post('/sessions/revoke-all', async (req, res, next) => {
  try {
    const userId = req.auth!.profileId;
    if (!userId) return noContent(res);
    await prisma.userSession.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// IP WHITELIST
// ============================================================
router.get(
  '/ip-whitelist',
  requireMfa,
  requirePermission('security.ip_whitelist'),
  async (_req, res, next) => {
    try {
      const items = await prisma.ipWhitelistEntry.findMany({ orderBy: { createdAt: 'desc' } });
      return ok(res, items);
    } catch (e) { next(e); }
  },
);

router.post(
  '/ip-whitelist',
  requireMfa,
  requirePermission('security.ip_whitelist'),
  async (req, res, next) => {
    try {
      const data = z.object({
        cidr: z.string().min(1),
        label: z.string().nullable().optional(),
      }).parse(req.body);
      const item = await prisma.ipWhitelistEntry.create({
        data: {
          cidr: data.cidr.trim(),
          label: data.label ?? null,
          createdBy: req.auth!.profileId,
        },
      });
      return created(res, item);
    } catch (e) { next(e); }
  },
);

router.patch(
  '/ip-whitelist/:id',
  requireMfa,
  requirePermission('security.ip_whitelist'),
  async (req, res, next) => {
    try {
      const data = z.object({ enabled: z.boolean() }).parse(req.body);
      const item = await prisma.ipWhitelistEntry.update({
        where: { id: req.params.id },
        data,
      });
      return ok(res, item);
    } catch (e) { next(e); }
  },
);

router.delete(
  '/ip-whitelist/:id',
  requireMfa,
  requirePermission('security.ip_whitelist'),
  async (req, res, next) => {
    try {
      await prisma.ipWhitelistEntry.delete({ where: { id: req.params.id } });
      return noContent(res);
    } catch (e) { next(e); }
  },
);

router.get('/check-ip', async (req, res, next) => {
  try {
    const ip = getClientIp(req);
    const entries = await prisma.ipWhitelistEntry.findMany({ where: { enabled: true } });
    if (entries.length === 0) return ok(res, { allowed: true, ip });
    const allowed = entries.some((e) => ipMatchesCidr(ip, e.cidr));
    return ok(res, { allowed, ip });
  } catch (e) { next(e); }
});

// ============================================================
// EVENTS
// ============================================================
router.get(
  '/events',
  requireMfa,
  requirePermission('security.ip_whitelist'),
  async (req, res, next) => {
    try {
      const limit = Math.min(500, Number(req.query.limit) || 200);
      const items = await prisma.securityEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return ok(res, items);
    } catch (e) { next(e); }
  },
);

router.post('/events', async (req, res, next) => {
  try {
    const data = z.object({
      eventType: z.string().min(1),
      severity: z.enum(['info', 'warning', 'critical']).default('info'),
      details: z.record(z.unknown()).optional(),
    }).parse(req.body);
    const item = await prisma.securityEvent.create({
      data: {
        userId: req.auth?.profileId ?? null,
        email: req.auth?.email ?? null,
        eventType: data.eventType,
        severity: data.severity,
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'] ?? null,
        details: (data.details ?? {}) as never,
      },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// CONSENTS
// ============================================================
router.get('/consents', async (req, res, next) => {
  try {
    const limit = Math.min(500, Number(req.query.limit) || 200);
    const items = await prisma.pdConsent.findMany({
      orderBy: { grantedAt: 'desc' },
      take: limit,
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

router.post('/consents', async (req, res, next) => {
  try {
    const data = z.object({
      subjectType: z.enum(['contact', 'user']),
      subjectEmail: z.string().email(),
      subjectName: z.string().nullable().optional(),
      consentType: z.string().default('pd_processing'),
      notes: z.string().nullable().optional(),
    }).parse(req.body);
    const item = await prisma.pdConsent.create({
      data: {
        subjectType: data.subjectType,
        subjectEmail: data.subjectEmail,
        subjectName: data.subjectName ?? null,
        consentType: data.consentType,
        granted: true,
        source: 'admin_panel',
        ip: getClientIp(req),
        notes: data.notes ?? null,
        createdBy: req.auth?.profileId ?? null,
      },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

router.patch('/consents/:id', async (req, res, next) => {
  try {
    const data = z.object({
      granted: z.boolean().optional(),
      notes: z.string().nullable().optional(),
    }).parse(req.body);
    const item = await prisma.pdConsent.update({
      where: { id: req.params.id },
      data: {
        granted: data.granted ?? undefined,
        revokedAt: data.granted === false ? new Date() : undefined,
        notes: data.notes ?? undefined,
      },
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// PD: экспорт / удаление (контакты вузов, contact)
// ============================================================
router.post('/pd/export', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const [universities, contacts, interactions, comments] = await Promise.all([
      prisma.university.findMany({ where: { contactEmail: email, deletedAt: null } }),
      prisma.universityContact.findMany({ where: { email } }),
      prisma.interaction.findMany({ where: { deletedAt: null } }),
      prisma.comment.findMany({ where: { deletedAt: null } }),
    ]);
    return ok(res, {
      subject_email: email,
      exported_at: new Date().toISOString(),
      universities,
      contacts,
      interactions: interactions.filter((i) =>
        JSON.stringify(i).toLowerCase().includes(email.toLowerCase()),
      ),
      comments: comments.filter((c) =>
        JSON.stringify(c).toLowerCase().includes(email.toLowerCase()),
      ),
    });
  } catch (e) { next(e); }
});

router.post('/pd/forget', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const contacts = await prisma.universityContact.updateMany({
      where: { email },
      data: { email: null, phone: null, telegram: null, whatsapp: null },
    });
    return ok(res, { ok: true, updated: contacts.count });
  } catch (e) { next(e); }
});

// ============================================================
// PD: экспорт / удаление (слушатели, identity — УЗ-1)
// ============================================================
router.post(
  '/pd/export-learner',
  requireMfa,
  requirePermission('security.view'),
  async (req, res, next) => {
    try {
      const { email } = z
        .object({ email: z.string().email() })
        .parse(req.body);

      const emailHash = PiiService.hashEmail(email);
      const learner = emailHash
        ? await prisma.learner.findUnique({ where: { emailHash } })
        : null;

      if (!learner) {
        return ok(res, { subject_email: email, found: false });
      }

      const decrypted = PiiService.decryptFields(
        learner as unknown as Record<string, unknown>,
        [...LEARNER_CONTACT_FIELDS, ...LEARNER_IDENTITY_FIELDS] as never,
      );

      void PiiService.logAccess({
        userId: req.auth!.profileId,
        userEmail: req.auth!.email,
        subjectId: learner.id,
        entity: 'learners',
        fields: [...LEARNER_CONTACT_FIELDS, ...LEARNER_IDENTITY_FIELDS],
        purpose: 'export',
        piiCategory: 'identity',
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'] ?? null,
      });

      return ok(res, {
        subject_email: email,
        found: true,
        learner: decrypted,
      });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/pd/forget-learner',
  requireMfa,
  requirePermission('security.view'),
  async (req, res, next) => {
    try {
      const { email } = z
        .object({ email: z.string().email() })
        .parse(req.body);

      const emailHash = PiiService.hashEmail(email);
      const learner = emailHash
        ? await prisma.learner.findUnique({
            where: { emailHash },
            select: { id: true },
          })
        : null;

      if (!learner) {
        return ok(res, { ok: true, updated: 0 });
      }

      await prisma.learner.update({
        where: { id: learner.id },
        data: {
          phone: null,
          email: null,
          snils: null,
          passportSeries: null,
          passportNumber: null,
          passportIssuedBy: null,
          passportDeptCode: null,
          diplomaNumber: null,
          diplomaSeries: null,
          diplomaRegNumber: null,
          regIndex: null,
          emailHash: null,
          phoneHash: null,
        },
      });

      void PiiService.logAccess({
        userId: req.auth!.profileId,
        userEmail: req.auth!.email,
        subjectId: learner.id,
        entity: 'learners',
        fields: [...LEARNER_CONTACT_FIELDS, ...LEARNER_IDENTITY_FIELDS],
        purpose: 'edit',
        piiCategory: 'identity',
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'] ?? null,
      });

      return ok(res, { ok: true, updated: 1 });
    } catch (e) {
      next(e);
    }
  },
);

// ============================================================
// PII ACCESS LOG
// ============================================================
router.get(
  '/pii-access-log',
  requireMfa,
  requirePermission('security.view'),
  async (req, res, next) => {
    try {
      const q = z.object({
        userId: z.string().uuid().optional(),
        subjectId: z.string().uuid().optional(),
        from: z.string().date().optional(),
        to: z.string().date().optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      }).parse(req.query);

      const where: Record<string, unknown> = {};
      if (q.userId) where.userId = q.userId;
      if (q.subjectId) where.subjectId = q.subjectId;
      if (q.from || q.to) {
        where.createdAt = {
          ...(q.from ? { gte: new Date(q.from) } : {}),
          ...(q.to ? { lte: new Date(q.to) } : {}),
        };
      }

      const items = await prisma.piiAccessLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: q.limit,
      });

      return ok(res, items);
    } catch (e) { next(e); }
  },
);

function ipMatchesCidr(ip: string | null, cidr: string): boolean {
  if (!ip) return false;
  if (!cidr.includes('/')) return ip === cidr;
  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  if (!Number.isFinite(bits)) return false;
  const ipToLong = (s: string) =>
    s.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
}

export default router;