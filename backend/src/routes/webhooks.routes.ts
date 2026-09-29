// backend/src/routes/webhooks.routes.ts
import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { InboxService } from '../services/inbox/inbox.service.js';
import { IntegrationsService } from '../services/integrations.service.js';
import { WsService } from '../services/ws.service.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { ok } from '../utils/response.js';
import { PiiService } from '../services/pii.service.js';

const router = Router();

const webhookLimit = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip ?? 'unknown',
  message: { ok: false, code: 'CRM-429-001', message: 'Слишком много запросов' },
});

router.use(webhookLimit);

// ============================================================
// POST /webhooks/integrations/:integrationId
// ============================================================
router.post('/integrations/:integrationId', async (req, res, next) => {
  try {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers[k.toLowerCase()] = v;
      else if (Array.isArray(v)) headers[k.toLowerCase()] = v.join(', ');
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    const result = await InboxService.handleWebhook({
      integrationId: req.params.integrationId,
      body: req.body,
      headers,
      rawBody,
    });

    return ok(res, result);
  } catch (e) {
    logger.error(
      { err: e, integrationId: req.params.integrationId },
      'Webhook error',
    );
    next(e);
  }
});

// ============================================================
// GET /webhooks/telegram/:integrationId
// ============================================================
router.get('/telegram/:integrationId', (req, res) => {
  return ok(res, { status: 'ok', integrationId: req.params.integrationId });
});

// ============================================================
// GET /webhooks/whatsapp/:integrationId — Meta verify
// ============================================================
router.get('/whatsapp/:integrationId', async (req, res, next) => {
  try {
    const mode = String(req.query['hub.mode'] ?? '');
    const token = String(req.query['hub.verify_token'] ?? '');
    const challenge = String(req.query['hub.challenge'] ?? '');

    if (mode !== 'subscribe' || !challenge) {
      return res.status(403).send('Forbidden');
    }

    const integration = await prisma.integration.findUnique({
      where: { id: req.params.integrationId },
    });
    if (!integration) return res.status(404).send('Not found');

    const config = (integration.config ?? {}) as { webhook_verify_token?: string };
    if (!config.webhook_verify_token || config.webhook_verify_token !== token) {
      logger.warn(
        { integrationId: integration.id },
        'WhatsApp webhook verify_token mismatch',
      );
      return res.status(403).send('Forbidden');
    }

    return res.status(200).send(challenge);
  } catch (e) {
    next(e);
  }
});

// ============================================================
// POST /webhooks/laravel/:integrationId
// ============================================================
router.post('/laravel/:integrationId', async (req, res, next) => {
  try {
    const integration = await prisma.integration.findUnique({
      where: { id: req.params.integrationId },
    });
    if (!integration || integration.deletedAt) {
      return res.status(404).json({ ok: false, code: 'CRM-404-001', message: 'Интеграция не найдена' });
    }

    const config = (integration.config ?? {}) as {
      webhook_secret?: string;
      endpoint?: string;
      [k: string]: unknown;
    };

    const secret = config.webhook_secret ?? '';
    if (!secret) {
      logger.warn(
        { integrationId: integration.id },
        'Laravel webhook: у интеграции не задан webhook_secret',
      );
      return res.status(503).json({
        ok: false,
        code: 'CRM-500-004',
        message: 'Интеграция не готова принимать webhook',
      });
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody || rawBody.length === 0) {
      return res.status(400).json({ ok: false, code: 'CRM-400-001', message: 'Пустое тело' });
    }

    const signatureHeader = String(
      req.headers['x-laravel-signature'] ?? '',
    ).trim();
    if (!signatureHeader.startsWith('sha256=')) {
      return res.status(401).json({ ok: false, code: 'CRM-401-003', message: 'Нет подписи' });
    }
    const received = Buffer.from(signatureHeader.slice(7), 'hex');
    const expected = createHmac('sha256', secret).update(rawBody).digest();

    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      await prisma.securityEvent.create({
        data: {
          eventType: 'webhook_signature_mismatch',
          severity: 'warning',
          ip: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
          details: {
            integrationId: integration.id,
            endpoint: 'laravel',
          } as never,
        },
      }).catch(() => {});

      return res.status(401).json({ ok: false, code: 'CRM-401-003', message: 'Подпись не совпала' });
    }

    const body = req.body as {
      event?: string;
      lead?: {
        external_id?: string;
        university_external_id?: string;
        university_name?: string;
        contact_name?: string;
        contact_email?: string;
        message?: string;
        source?: string;
      };
    };

    if (!body?.lead) {
      return res.status(400).json({ ok: false, code: 'CRM-400-001', message: 'Нет поля lead' });
    }

    const lead = body.lead;
    const externalId = lead.external_id ?? `laravel-${Date.now()}`;

    const exists = await prisma.inboxMessage.findFirst({
      where: {
        externalId,
        integrationId: integration.id,
      },
      select: { id: true },
    });
    if (exists) {
      return ok(res, { duplicate: true, externalId });
    }

    let universityId: string | null = null;
    if (lead.university_external_id) {
      const uni = await prisma.university.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { name: lead.university_external_id },
            { name: lead.university_name ?? '' },
          ],
        },
        select: { id: true },
      });
      universityId = uni?.id ?? null;
    } else if (lead.university_name) {
      const uni = await prisma.university.findFirst({
        where: { name: lead.university_name, deletedAt: null },
        select: { id: true },
      });
      universityId = uni?.id ?? null;
    }

    const interaction = await prisma.interaction.create({
      data: {
        universityId: universityId ?? undefined,
        type: 'Письмо',
        title: `Заявка с сайта: ${lead.contact_name ?? lead.university_name ?? 'без названия'}`,
        details: lead.message ?? null,
        interactionDate: new Date(),
        status: 'Запланировано',
        manager: 'Анна Кузнецова',
      } as never,
    });

    await prisma.inboxMessage.create({
      data: {
        integrationId: integration.id,
        channel: 'web',
        direction: 'in',
        externalId,
        fromAddress: lead.contact_email ?? 'unknown@laravel',
        fromName: lead.contact_name ?? null,
        subject: `Заявка с сайта`,
        body: lead.message ?? '',
        raw: body as never,
        universityId: universityId ?? undefined,
        interactionId: interaction.id,
      } as never,
    });

    if (universityId) {
      await IntegrationsService.applyRules({
        integrationId: integration.id,
        endpointId: '',
        universityId,
        row: lead as unknown as Record<string, unknown>,
      }).catch((e) => {
        logger.warn({ err: e }, 'Laravel webhook: applyRules failed');
      });
    }

    WsService.broadcast({
      type: 'interactions:created',
      entity: 'interactions',
      entityId: interaction.id,
      actor: 'laravel-webhook',
      payload: {
        source: lead.source ?? 'laravel',
        universityId,
        contactName: lead.contact_name ?? null,
      },
    });

    return ok(res, {
      ok: true,
      externalId,
      interactionId: interaction.id,
      universityId,
    });
  } catch (e) {
    next(e);
  }
});

// ============================================================
// POST /webhooks/lms/:integrationId
//
// Принимает заявки от LMS. Подпись — HMAC-SHA256 в заголовке
// X-LMS-Signature: sha256=<hex>.
// ============================================================
router.post('/lms/:integrationId', async (req, res, next) => {
  try {
    const integration = await prisma.integration.findUnique({
      where: { id: req.params.integrationId },
    });
    if (!integration || integration.deletedAt) {
      return res.status(404).json({
        ok: false,
        code: 'CRM-404-001',
        message: 'Интеграция не найдена',
      });
    }

    const config = (integration.config ?? {}) as { webhook_secret?: string };
    const secret = config.webhook_secret ?? '';
    if (!secret) {
      return res.status(503).json({
        ok: false,
        code: 'CRM-500-004',
        message: 'Интеграция не готова принимать webhook',
      });
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody || rawBody.length === 0) {
      return res.status(400).json({
        ok: false,
        code: 'CRM-400-001',
        message: 'Пустое тело',
      });
    }

    const signatureHeader = String(
      req.headers['x-lms-signature'] ?? '',
    ).trim();
    if (!signatureHeader.startsWith('sha256=')) {
      return res.status(401).json({
        ok: false,
        code: 'CRM-401-003',
        message: 'Нет подписи',
      });
    }

    const received = Buffer.from(signatureHeader.slice(7), 'hex');
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      await prisma.securityEvent
        .create({
          data: {
            eventType: 'webhook_signature_mismatch',
            severity: 'warning',
            ip: req.ip ?? null,
            userAgent: req.headers['user-agent'] ?? null,
            details: {
              integrationId: integration.id,
              endpoint: 'lms',
            } as never,
          },
        })
        .catch(() => {});

      return res.status(401).json({
        ok: false,
        code: 'CRM-401-003',
        message: 'Подпись не совпала',
      });
    }

    const body = req.body as {
      event?: string;
      order?: {
        externalId?: string;
        courseName?: string;
        streamNumber?: number;
        student?: Record<string, unknown>;
      };
    };

    if (!body?.order?.externalId) {
      return res.status(400).json({
        ok: false,
        code: 'CRM-400-001',
        message: 'Нет externalId',
      });
    }

    const exists = await prisma.order.findUnique({
      where: { externalId: body.order.externalId },
      select: { id: true },
    });
    if (exists) {
      return ok(res, { duplicate: true, orderId: exists.id });
    }

    const student = body.order.student ?? {};
    const email = (student.email as string | undefined) ?? null;
    const phone = (student.phone as string | undefined) ?? null;
    const lastName = String(student.lastName ?? '').trim();
    const firstName = String(student.firstName ?? '').trim();

    if (!lastName || !firstName) {
      return res.status(400).json({
        ok: false,
        code: 'CRM-400-001',
        message: 'Нет ФИО слушателя',
      });
    }

    const emailHash = PiiService.hashEmail(email);
    const phoneHash = PiiService.hashPhone(phone);

    let learner = emailHash
      ? await prisma.learner.findUnique({
          where: { emailHash },
          select: { id: true },
        })
      : null;
    if (!learner && phoneHash) {
      learner = await prisma.learner.findUnique({
        where: { phoneHash },
        select: { id: true },
      });
    }

    if (!learner) {
      learner = await prisma.learner.create({
        data: {
          lastName,
          firstName,
          middleName: (student.middleName as string | undefined) ?? null,
          phone: PiiService.encrypt(phone),
          email: PiiService.encrypt(email),
          phoneHash,
          emailHash,
          snils: PiiService.encrypt(
            (student.snils as string | undefined) ?? null,
          ),
          passportSeries: PiiService.encrypt(
            (student.passportSeries as string | undefined) ?? null,
          ),
          passportNumber: PiiService.encrypt(
            (student.passportNumber as string | undefined) ?? null,
          ),
          passportIssuedBy: PiiService.encrypt(
            (student.passportIssuedBy as string | undefined) ?? null,
          ),
          passportDeptCode: PiiService.encrypt(
            (student.passportDeptCode as string | undefined) ?? null,
          ),
          diplomaNumber: PiiService.encrypt(
            (student.diplomaNumber as string | undefined) ?? null,
          ),
          diplomaSeries: PiiService.encrypt(
            (student.diplomaSeries as string | undefined) ?? null,
          ),
          diplomaRegNumber: PiiService.encrypt(
            (student.diplomaRegNumber as string | undefined) ?? null,
          ),
        },
        select: { id: true },
      });

      void PiiService.logAccess({
        userId: null,
        userEmail: 'lms-webhook',
        subjectId: learner.id,
        entity: 'learners',
        fields: [
          'email',
          'phone',
          'snils',
          'passportSeries',
          'passportNumber',
          'passportIssuedBy',
          'passportDeptCode',
          'diplomaNumber',
          'diplomaSeries',
          'diplomaRegNumber',
        ],
        purpose: 'edit',
        piiCategory: 'identity',
      });
    }

    const courseName = body.order.courseName ?? 'Без названия';
    const streamNumber = Number(body.order.streamNumber) || 1;

    const course = await prisma.course.upsert({
      where: { name: courseName },
      update: {},
      create: { name: courseName },
    });

    const stream = await prisma.courseStream.upsert({
      where: {
        courseId_number: { courseId: course.id, number: streamNumber },
      },
      update: {},
      create: { courseId: course.id, number: streamNumber },
    });

    const order = await prisma.order.create({
      data: {
        externalId: body.order.externalId,
        courseId: course.id,
        streamId: stream.id,
        learnerId: learner.id,
      },
    });

    WsService.broadcast({
      type: 'orders:created',
      entity: 'orders',
      entityId: order.id,
      actor: 'lms-webhook',
      payload: { externalId: body.order.externalId, courseName },
    });

    return ok(res, { orderId: order.id });
  } catch (e) {
    logger.error({ err: e }, 'LMS webhook error');
    next(e);
  }
});

export default router;