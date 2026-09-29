import { Router } from 'express';
import { z } from 'zod';
import { SearchService } from '../services/search.service.js';
import { ok } from '../utils/response.js';
import { strictRateLimit } from '../middleware/rateLimit.js';

const router = Router();

router.get('/', strictRateLimit, async (req, res, next) => {
  try {
    const { q, limit } = z.object({
      q: z.string().min(2),
      limit: z.coerce.number().min(1).max(50).default(20),
    }).parse(req.query);

    const hits = await SearchService.search(q, limit);
    return ok(res, hits);
  } catch (e) { next(e); }
});

export default router;