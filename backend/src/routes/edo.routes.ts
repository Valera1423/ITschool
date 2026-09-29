import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireRole } from '../middleware/auth.js';
import { DiadocService } from '../services/edo/diadoc.service.js';
import { SbisService } from '../services/edo/sbis.service.js';
import { ok, created, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';

const router = Router();

router.post('/diadoc/contracts/:id/send', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const result = await DiadocService.sendContract(req.params.id, req.auth!.profileId ?? '');
    return ok(res, result);
  } catch (e) { next(e); }
});

router.post('/sbis/contracts/:id/send', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const result = await SbisService.sendContract(req.params.id, req.auth!.profileId ?? '');
    return ok(res, result);
  } catch (e) { next(e); }
});

router.get('/contracts/:id/documents', async (req, res, next) => {
  try {
    const items = await prisma.edoDocument.findMany({
      where: { contractId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

/**
 * POST /edo/contracts/:id/refresh
 * Ручной запрос статуса по всем ЭДО-документам договора.
 * Полезно, если webhook не настроен или не пришёл.
 */
router.post('/contracts/:id/refresh', async (req, res, next) => {
  try {
    const items = await prisma.edoDocument.findMany({
      where: { contractId: req.params.id },
    });

    // Мокаем "обновление": реально нужно дёргать API Диадока/СБИС.
    // Здесь — просто возвращаем текущее состояние БД.
    // В prod заменить на: await DiadocService.refreshStatus(doc),
    return ok(res, { refreshed: items.length, items });
  } catch (e) { next(e); }
});

export default router;