import { Router } from 'express';
import { DiadocService } from '../services/edo/diadoc.service.js';
import { SbisService } from '../services/edo/sbis.service.js';
import { ok } from '../utils/response.js';
import { logger } from '../config/logger.js';

const router = Router();

router.post('/diadoc', async (req, res, next) => {
  try {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers[k.toLowerCase()] = v;
    }
    const result = await DiadocService.handleWebhook(req.body, headers);
    return ok(res, result);
  } catch (e) {
    logger.error({ err: e }, 'Diadoc webhook error');
    next(e);
  }
});

router.post('/sbis', async (req, res, next) => {
  try {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers[k.toLowerCase()] = v;
    }
    const result = await SbisService.handleWebhook(req.body, headers);
    return ok(res, result);
  } catch (e) { next(e); }
});

export default router;