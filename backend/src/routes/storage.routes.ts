// backend/src/routes/storage.routes.ts
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { StorageService } from '../services/storage.service.js';
import { AntivirusService } from '../services/antivirus.service.js';
import { logger } from '../config/logger.js';
import { created, noContent, ok } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { prisma } from '../db/prisma.js';
import { strictRateLimit } from '../middleware/rateLimit.js';
import { buildScopeWhere } from '../middleware/auth.js';

const router = Router();

/**
 * Разрешённые расширения по ТЗ пункт 3:
 * png, jpeg, pdf, zip, gzip, rar, doc, docx, xls, xlsx
 */
const ALLOWED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg',
  'pdf',
  'zip', 'gz', 'gzip', 'rar',
  'doc', 'docx',
  'xls', 'xlsx',
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 МБ по ТЗ

/**
 * Multer с fileFilter — отсеиваем неподходящие файлы ДО чтения в память.
 * Это важно: 20 МБ × N параллельных запросов = OOM при memoryStorage.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 10,
  },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(
        new AppError('UNSUPPORTED_FILE_TYPE', 400, {
          ext,
          allowed: [...ALLOWED_EXTENSIONS],
        }),
      );
      return;
    }
    cb(null, true);
  },
});

/**
 * Проверить, что пользователь имеет доступ к вузу.
 * Возвращает вуз или бросает 404 (не 403 — не палим чужие сущности).
 */
async function requireUniversityAccess(
  universityId: string,
  auth: NonNullable<Express.Request['auth']>,
): Promise<{ id: string }> {
  const scopeWhere = buildScopeWhere(auth, 'universities');
  const uni = await prisma.university.findFirst({
    where: { id: universityId, deletedAt: null, ...scopeWhere },
    select: { id: true },
  });
  if (!uni) throw new AppError('UNIVERSITY_NOT_FOUND', 404);
  return uni;
}

/**
 * Проверить, что пользователь имеет доступ к документу (через его вуз).
 * Возвращает документ.
 */
async function requireDocumentAccess(
  documentId: string,
  auth: NonNullable<Express.Request['auth']>,
) {
  const scopeWhere = buildScopeWhere(auth, 'universities');
  const doc = await prisma.document.findFirst({
    where: {
      id: documentId,
      deletedAt: null,
      university: { deletedAt: null, ...scopeWhere },
    },
  });
  if (!doc) throw new AppError('DOCUMENT_NOT_FOUND', 404);
  return doc;
}

/**
 * @openapi
 * /storage/upload:
 *   post:
 *     tags: [Storage]
 *     summary: Загрузить файл в MinIO
 *     security: [{ bearerAuth: [] }]
 */
router.post('/upload', strictRateLimit, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('MISSING_REQUIRED_FIELD', 400, { field: 'file' });

    const originalName = req.file.originalname;
    const ext = originalName.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new AppError('UNSUPPORTED_FILE_TYPE', 400, {
        ext,
        allowed: [...ALLOWED_EXTENSIONS],
      });
    }

    const universityId = String(req.body.universityId ?? '');
    if (!universityId) {
      throw new AppError('MISSING_REQUIRED_FIELD', 400, { field: 'universityId' });
    }
    const uuidCheck = z.string().uuid().safeParse(universityId);
    if (!uuidCheck.success) {
      throw new AppError('INVALID_UUID', 400, { field: 'universityId' });
    }

    // ВАЖНО: проверяем не только существование, но и доступ по scope
    const uni = await requireUniversityAccess(universityId, req.auth!);

    // ── Антивирусная проверка ДО сохранения в MinIO (ФСТЭК №117 п.19).
    //    ClamAV работает по INSTREAM; буфер до 20 МБ уходит одним
    //    куском, ничего не пишем на диск.
    const scan = await AntivirusService.scanBuffer(req.file.buffer);

    if (!scan.clean) {
      // Записать инцидент ИБ — обязательное требование
      await prisma.securityEvent
        .create({
          data: {
            userId: req.auth?.profileId ?? null,
            email: req.auth?.email ?? null,
            eventType: 'malware_detected',
            severity: 'critical',
            ip: req.ip ?? null,
            userAgent: req.headers['user-agent'] ?? null,
            details: {
              filename: originalName,
              sizeBytes: req.file.size,
              mimeType: req.file.mimetype,
              universityId: uni.id,
              reason: scan.reason,
              scanDurationMs: scan.durationMs,
            } as never,
          },
        })
        .catch((e) => logger.warn({ err: e }, 'Не удалось записать SecurityEvent'));

      throw new AppError('STATE_CONFLICT', 422, {
        reason: 'Файл не прошёл антивирусную проверку',
        virus: scan.reason,
      });
    }

    const safeName = originalName.replace(/[^\w.\-]+/g, '_');
    const key = `${uni.id}/${randomUUID()}-${safeName}`;

    const result = await StorageService.upload({
      key,
      body: req.file.buffer,
      contentType: req.file.mimetype,
      sizeBytes: req.file.size,
    });

    const doc = await prisma.document.create({
      data: {
        university: { connect: { id: uni.id } },
        name: originalName,
        description: String(req.body.description ?? '') || null,
        category: String(req.body.category ?? 'Документ'),
        storagePath: key,
        mimeType: req.file.mimetype,
        sizeBytes: BigInt(req.file.size),
        uploadedBy: req.auth?.name ?? 'Пользователь',
      },
    });

    // Заголовок для фронта — показывает, что файл прошёл проверку
    // (в т.ч. если ClamAV был выключен / недоступен — тогда 'skipped')
    res.setHeader(
      'X-AV-Status',
      scan.skipped ? scan.skipped : 'clean',
    );

    return created(res, { document: doc, url: result.url });
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /storage/{documentId}:
 *   delete:
 *     tags: [Storage]
 *     summary: Удалить файл
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/:documentId', async (req, res, next) => {
  try {
    // Проверяем scope, а не просто существование
    const doc = await requireDocumentAccess(req.params.documentId, req.auth!);

    await StorageService.delete(doc.storagePath);
    await prisma.document.update({
      where: { id: doc.id },
      data: { deletedAt: new Date() },
    });

    return noContent(res);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /storage/{documentId}/signed-url:
 *   get:
 *     tags: [Storage]
 *     summary: Временная ссылка на скачивание
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:documentId/signed-url', async (req, res, next) => {
  try {
    const doc = await requireDocumentAccess(req.params.documentId, req.auth!);

    const url = await StorageService.signedUrl(doc.storagePath);
    return ok(res, { url, expires_in: 3600 });
  } catch (e) { next(e); }
});

export default router;