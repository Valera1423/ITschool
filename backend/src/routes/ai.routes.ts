// backend/src/routes/ai.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { AiService } from '../services/ai.service.js';
import { requireRole, requirePermission } from '../middleware/auth.js';
import { ok } from '../utils/response.js';
import { strictRateLimit } from '../middleware/rateLimit.js';
import { AppError } from '../errors/codes.js';

const router = Router();

const chatBody = z.object({
  question: z.string().min(3).max(1000),
  sessionId: z.string().uuid().optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000),
  })).max(10).default([]),
});

router.post('/kb-chat', strictRateLimit, async (req, res, next) => {
  try {
    const data = chatBody.parse(req.body);
    const sessionId = data.sessionId ?? randomUUID();

    const result = await AiService.answerKbQuestion(
      data.question,
      req.auth?.profileId ?? null,
      sessionId,
      data.history,
    );

    return ok(res, { ...result, sessionId });
  } catch (e) { next(e); }
});

// Переиндексация (admin)
router.post('/reindex', requireRole('admin'), async (_req, res, next) => {
  try {
    const result = await AiService.embedAllArticles();
    return ok(res, result);
  } catch (e) { next(e); }
});

// ============================================================
// POST /ai/suggest-workflow-step
//
// Подсказка по следующему шагу workflow для конкретного вуза.
// Возвращает id следующего шага + риски + приоритет.
//
// Ограничен strictRateLimit (20/мин), потому что:
//  - каждый вызов может бить во внешний LLM API;
//  - подсказка — «вспомогательная», не для массового использования.
// ============================================================
const suggestBody = z.object({
  universityId: z.string().uuid(),
});

router.post(
  '/suggest-workflow-step',
  requirePermission('universities.update'),
  strictRateLimit,
  async (req, res, next) => {
    try {
      const { universityId } = suggestBody.parse(req.body);

      const university = await prisma.university.findFirst({
        where: { id: universityId, deletedAt: null },
        select: {
          id: true,
          name: true,
          workflowLinks: {
            take: 1,
            orderBy: { updatedAt: 'desc' },
            select: {
              workflowId: true,
              currentStepId: true,
              workflow: {
                select: {
                  steps: {
                    orderBy: { stepOrder: 'asc' },
                    select: { id: true, title: true },
                  },
                },
              },
            },
          },
          workflowTransitions: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
              fromStatus: true,
              toStatus: true,
              comment: true,
              createdAt: true,
            },
          },
        },
      });
      if (!university) throw new AppError('UNIVERSITY_NOT_FOUND', 404);

      const link = university.workflowLinks[0];
      if (!link) {
        return ok(res, {
          suggestedNextStepId: null,
          reasoning: 'У вуза нет назначенного workflow.',
          risks: ['Workflow не назначен'],
          priority: 'high',
        });
      }

      const steps = link.workflow.steps;
      const currentStep =
        steps.find((s) => s.id === link.currentStepId)?.title ?? null;

      const suggestion = await AiService.suggestWorkflowStep({
        universityName: university.name,
        currentStepTitle: currentStep,
        steps,
        lastTransitions: university.workflowTransitions.map((t) => ({
          fromStatus: t.fromStatus,
          toStatus: t.toStatus,
          comment: t.comment,
          at: t.createdAt.toISOString(),
        })),
      });

      return ok(res, suggestion);
    } catch (e) {
      next(e);
    }
  },
);

export default router;