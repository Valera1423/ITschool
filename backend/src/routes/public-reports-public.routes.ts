import { Router } from 'express';
import { PublicReportsService } from '../services/public-reports.service.js';
import { ok } from '../utils/response.js';

const router = Router();

router.get('/:token', async (req, res, next) => {
  try {
    const password = String(
      req.query.password ?? req.headers['x-report-password'] ?? '',
    );
    const result = await PublicReportsService.get(req.params.token, password || undefined);
    return ok(res, result);
  } catch (e) { next(e); }
});

export default router;