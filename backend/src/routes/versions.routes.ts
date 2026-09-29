import { Router } from 'express';
import { z } from 'zod';
import { VersionsService } from '../services/versions.service.js';
import { ok } from '../utils/response.js';
import { AppError } from '../errors/codes.js';

const router = Router();

const paramsSchema = z.object({
  entity: z.string().min(1).max(64),
  entityId: z.string().uuid(),
});

const versionParam = z.coerce.number().int().min(1);

// GET /versions/:entity/:entityId
router.get('/:entity/:entityId', async (req, res, next) => {
  try {
    const { entity, entityId } = paramsSchema.parse(req.params);
    const items = await VersionsService.list(entity, entityId);
    return ok(res, items);
  } catch (e) { next(e); }
});

// GET /versions/:entity/:entityId/:version
router.get('/:entity/:entityId/:version', async (req, res, next) => {
  try {
    const { entity, entityId } = paramsSchema.parse(req.params);
    const version = versionParam.parse(req.params.version);
    const item = await VersionsService.get(entity, entityId, version);
    if (!item) throw new AppError('NOT_FOUND', 404);
    return ok(res, item);
  } catch (e) { next(e); }
});

// GET /versions/:entity/:entityId/diff/:from/:to
router.get('/:entity/:entityId/diff/:from/:to', async (req, res, next) => {
  try {
    const { entity, entityId } = paramsSchema.parse(req.params);
    const from = versionParam.parse(req.params.from);
    const to = versionParam.parse(req.params.to);
    const diff = await VersionsService.diff(entity, entityId, from, to);
    if (!diff) throw new AppError('NOT_FOUND', 404);
    return ok(res, diff);
  } catch (e) { next(e); }
});

// POST /versions/:entity/:entityId/:version/rollback
router.post('/:entity/:entityId/:version/rollback', async (req, res, next) => {
  try {
    const { entity, entityId } = paramsSchema.parse(req.params);
    const version = versionParam.parse(req.params.version);
    const snapshot = await VersionsService.rollback(entity, entityId, version);
    return ok(res, { snapshot });
  } catch (e) { next(e); }
});

export default router;