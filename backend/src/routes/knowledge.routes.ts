// backend/src/routes/knowledge.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok, created, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { AiService } from '../services/ai.service.js';
import { logger } from '../config/logger.js';

const router = Router();

const articleBody = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  excerpt: z.string().nullable().optional(),
  content: z.string().default(''),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  pinned: z.boolean().default(false),
});

// ============================================================
// Debounce-переиндексация KB
//
// Сохранение статьи (POST/PATCH) → запускаем переиндексацию
// embeddings для поиска. Полный `embedAllArticles()` — тяжёлая
// операция (считает эмбеддинги для всех статей, пишет в pgvector),
// поэтому:
//   1) дебаунсим вызовы, чтобы серия сохранений подряд не гоняла
//      индексацию N раз;
//   2) не блокируем ответ — переиндексация идёт в фоне.
//
// Ночной cron (kb-reindex в 03:30) — страховка на случай, если
// фоновый вызов упал или сервис был недоступен.
//
// Если в AiService появится точечный метод `embedArticle(id)` —
// замените `embedAllArticles()` на него: это на порядок дешевле
// по CPU и обращению к внешнему API.
// ============================================================
let reindexTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleKbReindex(reason: string): void {
  if (reindexTimer) clearTimeout(reindexTimer);
  reindexTimer = setTimeout(() => {
    reindexTimer = null;
    void AiService.embedAllArticles()
      .then((result) => {
        logger.info({ result, reason }, '✓ KB reindexed (debounced)');
      })
      .catch((e) => {
        logger.warn({ err: e, reason }, 'KB reindex failed');
      });
  }, 5000);
}

/**
 * @openapi
 * /knowledge/categories:
 *   get:
 *     tags: [Knowledge]
 *     summary: Категории базы знаний
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Список }
 */
router.get('/categories', async (_req, res, next) => {
  try {
    const items = await prisma.kbCategory.findMany({ orderBy: { sortOrder: 'asc' } });
    return ok(res, items);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /knowledge/articles:
 *   get:
 *     tags: [Knowledge]
 *     summary: Статьи базы знаний
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: categoryId, schema: { type: string, format: uuid } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: Список }
 *   post:
 *     tags: [Knowledge]
 *     summary: Создать статью
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Создано }
 */
router.get('/articles', async (req, res, next) => {
  try {
    const where = {
      deletedAt: null,
      status: 'published' as const,
      categoryId: req.query.categoryId as string | undefined,
      ...(req.query.search
        ? {
            OR: [
              { title: { contains: String(req.query.search), mode: 'insensitive' as const } },
              { content: { contains: String(req.query.search), mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const items = await prisma.kbArticle.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

router.post('/articles', async (req, res, next) => {
  try {
    const data = articleBody.parse(req.body);
    // Генерация slug: транслит + timestamp для уникальности
    const slug =
      data.title
        .toLowerCase()
        .replace(/[а-яё]/g, (ch) => 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'.indexOf(ch).toString())
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Date.now().toString(36);

    const item = await prisma.kbArticle.create({
      data: {
        ...data,
        slug,
        authorId: req.auth?.profileId ?? null,
        authorName: req.auth?.name ?? 'Пользователь',
      },
    });

    // Переиндексация для семантического поиска (debounced, в фоне)
    if (item.status === 'published') {
      scheduleKbReindex(`created:${item.id}`);
    }

    return created(res, item);
  } catch (e) { next(e); }
});

/**
 * POST /knowledge/articles/:id/view
 * Инкремент счётчика просмотров.
 */
router.post('/articles/:id/view', async (req, res, next) => {
  try {
    await prisma.kbArticle.update({
      where: { id: req.params.id },
      data: { views: { increment: 1 } },
    });
    return noContent(res);
  } catch {
    // Тихо игнорируем — это не критичный счётчик
    return noContent(res);
  }
});

/**
 * @openapi
 * /knowledge/articles/{id}:
 *   get:
 *     tags: [Knowledge]
 *     summary: Одна статья
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Найдено }
 *       404:
 *         description: Не найдено
 *         content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } }
 *   patch:
 *     tags: [Knowledge]
 *     summary: Обновить статью
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Обновлено }
 *   delete:
 *     tags: [Knowledge]
 *     summary: Удалить статью
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       204: { description: Удалено }
 */
router.get('/articles/:id', async (req, res, next) => {
  try {
    const item = await prisma.kbArticle.findUnique({ where: { id: req.params.id } });
    if (!item) throw new AppError('NOT_FOUND', 404);

    // Инкремент просмотров (не блокирует ответ)
    prisma.kbArticle
      .update({ where: { id: item.id }, data: { views: { increment: 1 } } })
      .catch(() => {});

    return ok(res, item);
  } catch (e) { next(e); }
});

router.patch('/articles/:id', async (req, res, next) => {
  try {
    const data = articleBody.partial().parse(req.body);
    const item = await prisma.kbArticle.update({
      where: { id: req.params.id },
      data: { ...data, updatedAt: new Date() },
    });

    // Переиндексация при обновлении. Условия:
    //  - статья published (черновики и архивные в поиск не попадают);
    //  - изменилось что-то из значимых полей: title/content/excerpt/tags.
    //    Менять `pinned` или `status` на то же значение — не повод
    //    гонять embeddings.
    const touchedMeaningful =
      data.title !== undefined ||
      data.content !== undefined ||
      data.excerpt !== undefined ||
      data.tags !== undefined;

    if (item.status === 'published' && touchedMeaningful) {
      scheduleKbReindex(`updated:${item.id}`);
    }

    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/articles/:id', async (req, res, next) => {
  try {
    await prisma.kbArticle.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    // Удалённая статья должна исчезнуть из поиска — переиндексируем.
    // Id передаём для логов, но по факту полная переиндексация сама
    // выкинет удалённые записи.
    scheduleKbReindex(`deleted:${req.params.id}`);

    return noContent(res);
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /knowledge/articles/{id}/feedback:
 *   post:
 *     tags: [Knowledge]
 *     summary: Отзыв о статье
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [helpful]
 *             properties:
 *               helpful: { type: boolean }
 *               comment: { type: string }
 *     responses:
 *       201: { description: Отзыв сохранён }
 */
router.post('/articles/:id/feedback', async (req, res, next) => {
  try {
    const helpful = Boolean(req.body?.helpful);
    const item = await prisma.kbFeedback.create({
      data: {
        article: { connect: { id: req.params.id } },
        helpful,
        userId: req.auth?.profileId ?? null,
        comment: req.body?.comment ?? null,
      },
    });
    await prisma.kbArticle.update({
      where: { id: req.params.id },
      data: helpful
        ? { helpfulCount: { increment: 1 } }
        : { notHelpfulCount: { increment: 1 } },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

export default router;