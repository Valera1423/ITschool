import { Router } from 'express';
import { z } from 'zod';
import { QUEUES } from '../jobs/queues.js';
import { ok } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/:queue/:jobId', async (req, res, next) => {
  try {
    const queueName = z.enum(['email', 'push', 'reports', 'integrations', 'excel', 'presentation']).parse(req.params.queue);
    const queue = QUEUES[queueName];
    if (!queue) throw new AppError('NOT_FOUND', 404);

    const job = await queue.getJob(req.params.jobId);
    if (!job) throw new AppError('NOT_FOUND', 404);

    return ok(res, {
      id: job.id,
      name: job.name,
      status: await job.getState(),
      progress: job.progress,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      attempts: job.attemptsMade,
      createdAt: job.timestamp,
    });
  } catch (e) { next(e); }
});

router.get('/stats', requireRole('admin'), async (_req, res, next) => {
  try {
    const stats: Record<string, unknown> = {};
    for (const [name, queue] of Object.entries(QUEUES)) {
      stats[name] = await queue.getJobCounts();
    }
    return ok(res, stats);
  } catch (e) { next(e); }
});

export default router;