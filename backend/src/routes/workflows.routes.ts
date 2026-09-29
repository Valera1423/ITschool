// backend/src/routes/workflows.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok, created, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { buildScopeWhere } from '../middleware/auth.js';
import { WsService } from '../services/ws.service.js';
import { WORKFLOW_TEMPLATES, findTemplate } from '../constants/workflow-templates.js';

const router = Router();

// ============================================================
// Нормализация тела: snake_case → camelCase
// ============================================================
function toCamel(str: string): string {
  return str.replace(/([a-z0-9])_([a-z0-9])/g, (_, p, c) => p + c.toUpperCase());
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
// ============================================================
const wfBody = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.string().default('Активен'),
  runsCount: z.number().int().min(0).default(0),
  isDefault: z.boolean().optional(),
});

const stepBody = z.object({
  title: z.string().min(1),
  stepOrder: z.number().int().min(0),
  status: z.string().default('Ожидает'),
  statusCode: z.string().nullable().optional(),
});

const transitionBody = z.object({
  stepId: z.string().uuid(),
  universityId: z.string().uuid(),
  fromStatus: z.string().nullable().optional(),
  toStatus: z.string(),
  comment: z.string().min(1).max(5000),
  /**
   * Вложения — теперь ТОЛЬКО documentId.
   * Клиент не может подсунуть произвольный URL: сервер сам
   * резолвит name / mime / size / storagePath из Document
   * и проверяет, что документ принадлежит тому же вузу.
   */
  attachmentDocumentIds: z
    .array(z.string().uuid())
    .max(50)
    .default([]),
  actorName: z.string().min(1).max(200),
});

// ============================================================
// GET /workflows — список
// ============================================================
router.get('/', async (req, res, next) => {
  try {
    const includeDeleted = req.query.includeDeleted === 'true';
    const items = await prisma.workflow.findMany({
      where: includeDeleted ? undefined : { deletedAt: null },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

// ============================================================
// POST /workflows
// ============================================================
router.post('/', async (req, res, next) => {
  try {
    const data = wfBody.parse(normalizeBody(req.body));

    let item;
    if (data.isDefault === true) {
      item = await prisma.$transaction(async (tx) => {
        await tx.workflow.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
        return tx.workflow.create({
          data: {
            name: data.name,
            description: data.description ?? null,
            status: data.status,
            runsCount: data.runsCount,
            isDefault: true,
          },
        });
      });
    } else {
      item = await prisma.workflow.create({
        data: {
          name: data.name,
          description: data.description ?? null,
          status: data.status,
          runsCount: data.runsCount,
          isDefault: data.isDefault ?? false,
        },
      });
    }

    return created(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// GET /workflows/universities/:universityId — до /:id
// ============================================================
router.get('/universities/:universityId', async (req, res, next) => {
  try {
    const link = await prisma.workflowUniversity.findFirst({
      where: { universityId: req.params.universityId },
      include: {
        workflow: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
        currentStep: true,
      },
    });

    return ok(res, link ?? null);
  } catch (e) { next(e); }
});

// ============================================================
// GET /workflows/transitions/:universityId — до /:id
// ============================================================
router.get('/transitions/:universityId', async (req, res, next) => {
  try {
    const items = await prisma.workflowTransition.findMany({
      where: { universityId: req.params.universityId },
      orderBy: { createdAt: 'desc' },
      include: {
        attachmentLinks: {
          include: {
            document: {
              select: {
                id: true,
                name: true,
                storagePath: true,
                mimeType: true,
                sizeBytes: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });

    const minioBase = (process.env.MINIO_PUBLIC_URL ?? '').replace(/\/$/, '');

    // Для каждого перехода отдаём унифицированные attachments:
    // — если есть attachmentLinks → собираем из них (актуальные URL)
    // — иначе → отдаём Json-слепок (старые записи)
    const rows = items.map((t) => ({
      ...t,
      attachments:
        t.attachmentLinks.length > 0
          ? t.attachmentLinks
              .filter((l) => l.document && l.document.deletedAt === null)
              .map((l) => ({
                id: l.document.id,
                name: l.document.name,
                url: `${minioBase}/${l.document.storagePath}`,
                size: Number(l.document.sizeBytes),
                mime: l.document.mimeType,
              }))
          : (t.attachments as { name: string; url: string; size?: number }[]),
      attachmentLinks: undefined,
    }));

    return ok(res, rows);
  } catch (e) { next(e); }
});

// ============================================================
// POST /workflows/transitions
//
// Переход между статусами шага workflow.
//
// ИСПРАВЛЕНО:
//  1) Всё в одной транзакции (transition + step.update + workflowUniversity).
//  2) Проверяем, что step принадлежит workflow, к которому привязан вуз.
//  3) Проверяем scope — пользователь не может двигать чужие вузы.
//  4) После транзакции — broadcast, чтобы клиенты с открытой карточкой
//     вуза обновили прогресс в реальном времени.
//  5) Проверка графа переходов по WorkflowTransitionRule.
//  6) Вложения резолвятся через Document (attachmentDocumentIds),
//     клиентские URL игнорируются.
// ============================================================
router.post('/transitions', async (req, res, next) => {
  try {
    const data = transitionBody.parse(normalizeBody(req.body));
    const actor = req.auth!;

    // 1. Шаг существует — и узнаём его workflowId
    const step = await prisma.workflowStep.findUnique({
      where: { id: data.stepId },
      select: { id: true, workflowId: true },
    });
    if (!step) throw new AppError('NOT_FOUND', 404, { reason: 'step not found' });

    // 2. Вуз доступен пользователю (scope) И привязан именно к этому workflow
    const scopeWhere = buildScopeWhere(actor, 'universities');
    const link = await prisma.workflowUniversity.findFirst({
      where: {
        universityId: data.universityId,
        workflowId: step.workflowId,
        university: { deletedAt: null, ...scopeWhere },
      },
      select: { id: true },
    });
    if (!link) {
      throw new AppError('NOT_FOUND', 404, {
        reason: 'Шаг не относится к workflow этого вуза или вуз недоступен',
      });
    }

    // 2.1. Проверка графа переходов.
    //
    // Если для workflow заданы правила — разрешаем переход только по ним.
    // Если правил нет вообще — считаем, что граф не настроен (legacy-режим),
    // и пропускаем проверку. Так после миграции старая логика не ломается.
    const rulesCount = await prisma.workflowTransitionRule.count({
      where: { workflowId: step.workflowId },
    });
    if (rulesCount > 0) {
      // Откуда идём? Текущий currentStepId в workflowUniversity.
      const linkState = await prisma.workflowUniversity.findFirst({
        where: {
          universityId: data.universityId,
          workflowId: step.workflowId,
        },
        select: { currentStepId: true },
      });
      const fromStepId = linkState?.currentStepId ?? null;

      if (!fromStepId) {
        throw new AppError('STATE_CONFLICT', 409, {
          reason: 'У вуза не определён текущий шаг workflow',
        });
      }
      if (fromStepId !== data.stepId) {
        throw new AppError('STATE_CONFLICT', 409, {
          reason: 'Переход возможен только из текущего шага',
          currentStepId: fromStepId,
        });
      }

      const allowed = await prisma.workflowTransitionRule.findFirst({
        where: {
          workflowId: step.workflowId,
          fromStepId,
          toStepId: step.id,
        },
      });
      if (!allowed) {
        throw new AppError('STATE_CONFLICT', 409, {
          reason: 'Переход запрещён правилами workflow',
        });
      }
    }

    // 3. Узнаём, финальный ли новый статус (по каталогу)
    const catalog = await prisma.workflowStatusCatalog.findUnique({
      where: { code: data.toStatus },
      select: { isFinal: true },
    });

    // ── Резолвим вложения: все documentId должны существовать
    //    и принадлежать тому же вузу.
    let resolvedAttachments: { id: string; name: string; url: string; size: number; mime: string | null }[] = [];

    if (data.attachmentDocumentIds.length > 0) {
      const docs = await prisma.document.findMany({
        where: {
          id: { in: data.attachmentDocumentIds },
          universityId: data.universityId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          storagePath: true,
          mimeType: true,
          sizeBytes: true,
        },
      });

      if (docs.length !== data.attachmentDocumentIds.length) {
        throw new AppError('VALIDATION_FAILED', 400, {
          reason: 'Некоторые вложения не найдены или принадлежат другому вузу',
        });
      }

      // Публичный URL собираем на сервере — из MINIO_PUBLIC_URL.
      // Клиентские URL игнорируем.
      const minioBase = (process.env.MINIO_PUBLIC_URL ?? '').replace(/\/$/, '');
      resolvedAttachments = docs.map((d) => ({
        id: d.id,
        name: d.name,
        url: `${minioBase}/${d.storagePath}`,
        size: Number(d.sizeBytes),
        mime: d.mimeType,
      }));
    }

    const transition = await prisma.$transaction(async (tx) => {
      const t = await tx.workflowTransition.create({
        data: {
          step: { connect: { id: data.stepId } },
          university: { connect: { id: data.universityId } },
          fromStatus: data.fromStatus ?? null,
          toStatus: data.toStatus,
          comment: data.comment,
          // Денормализованный слепок для UI (обратная совместимость):
          attachments: resolvedAttachments.map((a) => ({
            id: a.id,
            name: a.name,
            url: a.url,
            size: a.size,
          })) as never,
          actorName: data.actorName,
          actorId: actor.profileId ?? null,
        },
      });

      // Нормализованная связь — если переданы вложения
      if (resolvedAttachments.length > 0) {
        await tx.workflowTransitionAttachment.createMany({
          data: resolvedAttachments.map((a) => ({
            transitionId: t.id,
            documentId: a.id,
          })),
          skipDuplicates: true,
        });
      }

      await tx.workflowStep.update({
        where: { id: data.stepId },
        data: { statusCode: data.toStatus, status: data.toStatus },
      });

      // Обновляем текущий шаг workflowUniversity — иначе граф
      // переходов из Спринта 4 не будет знать, куда двигаться дальше.
      await tx.workflowUniversity.updateMany({
        where: {
          universityId: data.universityId,
          workflowId: step.workflowId,
        },
        data: {
          currentStepId: data.stepId,
          ...(catalog?.isFinal
            ? { status: 'Завершён', completedAt: new Date() }
            : {}),
        },
      });

      return t;
    });

    // 5. WebSocket broadcast — клиенты с открытой карточкой вуза
    //    обновят прогресс workflow без перезагрузки страницы.
    WsService.broadcast({
      type: 'workflows:transition',
      entity: 'universities',
      entityId: data.universityId,
      actor: actor.email,
      payload: {
        stepId: data.stepId,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        comment: data.comment.slice(0, 120),
        isFinal: !!catalog?.isFinal,
      },
      scopeUniversityId: data.universityId,
    });

    return created(res, transition);
  } catch (e) { next(e); }
});

// ============================================================
// PATCH /workflows/steps/:stepId — до /:id
// ============================================================
router.patch('/steps/:stepId', async (req, res, next) => {
  try {
    const data = stepBody.partial().parse(normalizeBody(req.body));
    const item = await prisma.workflowStep.update({
      where: { id: req.params.stepId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.stepOrder !== undefined ? { stepOrder: data.stepOrder } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.statusCode !== undefined ? { statusCode: data.statusCode } : {}),
      },
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// DELETE /workflows/steps/:stepId
// ============================================================
router.delete('/steps/:stepId', async (req, res, next) => {
  try {
    await prisma.workflowStep.delete({ where: { id: req.params.stepId } });
    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// POST /workflows/:id/steps
// ============================================================
router.post('/:id/steps', async (req, res, next) => {
  try {
    const data = stepBody.parse(normalizeBody(req.body));
    const item = await prisma.workflowStep.create({
      data: {
        workflow: { connect: { id: req.params.id } },
        title: data.title,
        stepOrder: data.stepOrder,
        status: data.status,
        statusCode: data.statusCode ?? null,
      },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// POST /workflows/:id/set-default
// ============================================================
router.post('/:id/set-default', async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.workflow.updateMany({
        where: { isDefault: true, id: { not: req.params.id } },
        data: { isDefault: false },
      });
      const wf = await tx.workflow.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!wf) throw new AppError('NOT_FOUND', 404);
      return tx.workflow.update({
        where: { id: req.params.id },
        data: { isDefault: true },
      });
    });
    return ok(res, result);
  } catch (e) { next(e); }
});

// ============================================================
// GET /workflows/:id
// ============================================================
router.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.workflow.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!item) throw new AppError('NOT_FOUND', 404);
    return ok(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// PATCH /workflows/:id
// ============================================================
router.patch('/:id', async (req, res, next) => {
  try {
    const data = wfBody.partial().parse(normalizeBody(req.body));

    if (data.isDefault === true) {
      const item = await prisma.$transaction(async (tx) => {
        await tx.workflow.updateMany({
          where: { isDefault: true, id: { not: req.params.id } },
          data: { isDefault: false },
        });
        return tx.workflow.update({
          where: { id: req.params.id },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.status !== undefined ? { status: data.status } : {}),
            ...(data.runsCount !== undefined ? { runsCount: data.runsCount } : {}),
            isDefault: true,
            updatedAt: new Date(),
          },
        });
      });
      return ok(res, item);
    }

    const item = await prisma.workflow.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.runsCount !== undefined ? { runsCount: data.runsCount } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        updatedAt: new Date(),
      },
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// DELETE /workflows/:id — soft delete
// ============================================================
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.workflow.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), isDefault: false },
    });
    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// GET /workflows/templates
// Список доступных шаблонов (для UI «Создать из шаблона»)
// ============================================================
router.get('/templates', async (_req, res, next) => {
  try {
    return ok(
      res,
      WORKFLOW_TEMPLATES.map((t) => ({
        key: t.key,
        name: t.name,
        description: t.description,
        stepsCount: t.steps.length,
      })),
    );
  } catch (e) { next(e); }
});

// ============================================================
// POST /workflows/from-template
// Создаёт workflow со всеми шагами из шаблона + опционально
// делает его дефолтным.
// ============================================================
const fromTemplateBody = z.object({
  templateKey: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  makeDefault: z.boolean().default(false),
});

router.post('/from-template', async (req, res, next) => {
  try {
    const data = fromTemplateBody.parse(normalizeBody(req.body));
    const template = findTemplate(data.templateKey);
    if (!template) {
      throw new AppError('NOT_FOUND', 404, { reason: 'Шаблон не найден' });
    }

    const workflow = await prisma.$transaction(async (tx) => {
      if (data.makeDefault) {
        await tx.workflow.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      const wf = await tx.workflow.create({
        data: {
          name: data.name ?? template.name,
          description: template.description,
          status: 'Активен',
          isDefault: data.makeDefault,
        },
      });

      await tx.workflowStep.createMany({
        data: template.steps.map((s, i) => ({
          workflowId: wf.id,
          title: s.title,
          stepOrder: i + 1,
          status: 'Ожидает',
          statusCode: s.statusCode ?? 'pending',
        })),
      });

      // Автоправила: из шага N можно идти в N+1 (линейный граф).
      // Пользователь потом донастроит через /transition-rules.
      const created = await tx.workflowStep.findMany({
        where: { workflowId: wf.id },
        orderBy: { stepOrder: 'asc' },
        select: { id: true },
      });
      for (let i = 0; i < created.length - 1; i++) {
        await tx.workflowTransitionRule.create({
          data: {
            workflowId: wf.id,
            fromStepId: created[i].id,
            toStepId: created[i + 1].id,
            requiresComment: true,
          },
        });
      }

      return wf;
    });

    // ── Привязка всех вузов без workflow к новому дефолтному
    if (data.makeDefault) {
      const unis = await prisma.university.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      const firstStep = await prisma.workflowStep.findFirst({
        where: { workflowId: workflow.id },
        orderBy: { stepOrder: 'asc' },
        select: { id: true },
      });
      if (firstStep) {
        for (const u of unis) {
          const existing = await prisma.workflowUniversity.findUnique({
            where: {
              workflowId_universityId: {
                workflowId: workflow.id,
                universityId: u.id,
              },
            },
          });
          if (existing) continue;
          await prisma.workflowUniversity
            .create({
              data: {
                workflowId: workflow.id,
                universityId: u.id,
                currentStepId: firstStep.id,
                status: 'В работе',
              },
            })
            .catch(() => {});
        }
      }
    }

    return created(res, workflow);
  } catch (e) { next(e); }
});

// ============================================================
// GRAPH RULES: чтение / замена / удаление
// ============================================================

// GET /workflows/:id/transition-rules
router.get('/:id/transition-rules', async (req, res, next) => {
  try {
    const rules = await prisma.workflowTransitionRule.findMany({
      where: { workflowId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    return ok(res, rules);
  } catch (e) { next(e); }
});

const transitionRuleBody = z.object({
  fromStepId: z.string().uuid(),
  toStepId: z.string().uuid(),
  condition: z.record(z.unknown()).optional(),
  requiresComment: z.boolean().optional(),
});

// POST /workflows/:id/transition-rules — добавить одно правило
router.post('/:id/transition-rules', async (req, res, next) => {
  try {
    const data = transitionRuleBody.parse(normalizeBody(req.body));

    // Проверка: шаги принадлежат этому workflow
    const steps = await prisma.workflowStep.findMany({
      where: {
        id: { in: [data.fromStepId, data.toStepId] },
        workflowId: req.params.id,
      },
      select: { id: true },
    });
    if (steps.length !== 2) {
      throw new AppError('VALIDATION_FAILED', 400, {
        reason: 'Шаги должны принадлежать указанному workflow',
      });
    }

    const rule = await prisma.workflowTransitionRule.upsert({
      where: {
        workflowId_fromStepId_toStepId: {
          workflowId: req.params.id,
          fromStepId: data.fromStepId,
          toStepId: data.toStepId,
        },
      },
      update: {
        condition: (data.condition ?? {}) as never,
        requiresComment: data.requiresComment ?? true,
      },
      create: {
        workflowId: req.params.id,
        fromStepId: data.fromStepId,
        toStepId: data.toStepId,
        condition: (data.condition ?? {}) as never,
        requiresComment: data.requiresComment ?? true,
      },
    });
    return created(res, rule);
  } catch (e) { next(e); }
});

// DELETE /workflows/:id/transition-rules/:ruleId
router.delete('/:id/transition-rules/:ruleId', async (req, res, next) => {
  try {
    await prisma.workflowTransitionRule.deleteMany({
      where: { id: req.params.ruleId, workflowId: req.params.id },
    });
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;