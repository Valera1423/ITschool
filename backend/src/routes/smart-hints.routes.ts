// backend/src/routes/smart-hints.routes.ts
import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { SmartHintsService } from '../services/smart-hints.service.js';
import { ok } from '../utils/response.js';

const router = Router();

router.post('/run', requireRole('admin'), async (_req, res, next) => {
  try {
    const result = await SmartHintsService.run();
    return ok(res, result);
  } catch (e) { next(e); }
});

export default router;