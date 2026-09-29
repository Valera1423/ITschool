import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ExcelSyncService } from '../services/excel-sync.service.js';
import { ok, created } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { strictRateLimit } from '../middleware/rateLimit.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

const exportQuery = z.object({
  entity: z.enum(['universities', 'tasks', 'interactions']).default('universities'),
  filters: z.string().optional(), // JSON
});

/**
 * GET /excel-sync/export?entity=universities
 * Скачивает XLSX со скрытыми колонками _id / _rev.
 */
router.get('/export', async (req, res, next) => {
  try {
    const q = exportQuery.parse(req.query);
    const filters = q.filters ? JSON.parse(q.filters) : {};

    const { buffer, filename } = await ExcelSyncService.export(
      q.entity,
      filters,
      req.auth!,
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (e) { next(e); }
});

/**
 * POST /excel-sync/import?entity=universities
 * Принимает файл и делает smart-merge.
 */
router.post(
  '/import',
  strictRateLimit,
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) throw new AppError('MISSING_REQUIRED_FIELD', 400, { field: 'file' });

      const entity = z
        .enum(['universities', 'tasks', 'interactions'])
        .parse(req.query.entity ?? 'universities');

      const result = await ExcelSyncService.import(entity, req.file.buffer, req.auth!);
      return ok(res, result);
    } catch (e) { next(e); }
  },
);

/**
 * GET /excel-sync/template?entity=universities
 * Пустой шаблон без данных.
 */
router.get('/template', async (req, res, next) => {
  try {
    const entity = z
      .enum(['universities', 'tasks', 'interactions'])
      .parse(req.query.entity ?? 'universities');

    const { buffer, filename } = await ExcelSyncService.export(entity, { id: { equals: '00000000-0000-0000-0000-000000000000' } }, req.auth!);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="template-${entity}.xlsx"`);
    return res.send(buffer);
  } catch (e) { next(e); }
});

export default router;