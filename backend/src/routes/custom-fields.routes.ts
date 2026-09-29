// backend/src/routes/custom-fields.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok, created, noContent } from '../utils/response.js';
import { CustomFieldsService } from '../services/custom-fields.service.js';
import { requireRole, buildScopeWhere } from '../middleware/auth.js';
import { AppError } from '../errors/codes.js';

const router = Router();

/**
 * ВАЖНО: Управление определениями кастомных полей (создание/правка/удаление)
 * — только для admin/manager. Раньше любой аутентифицированный мог
 * переопределить структуру полей и сломать БД.
 */
const fieldBody = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(200),
  field_type: z.enum([
    'text', 'number', 'date', 'select', 'multiselect',
    'bool', 'url', 'phone', 'email',
  ]),
  options: z.array(z.string().max(200)).max(100).default([]),
  help_text: z.string().max(500).nullable().optional(),
  required: z.boolean().default(false),
  show_in_table: z.boolean().default(false),
  sort_order: z.number().int().default(100),
  entity: z.string().min(1).max(50).default('universities'),
});

/**
 * Проверка доступа к сущности, для которой читаем/пишем значения.
 * Сейчас поддерживаем только universities — по мере надобности расширим.
 */
async function requireEntityAccess(
  entityId: string,
  auth: NonNullable<Express.Request['auth']>,
): Promise<void> {
  const scopeWhere = buildScopeWhere(auth, 'universities');
  const uni = await prisma.university.findFirst({
    where: { id: entityId, deletedAt: null, ...scopeWhere },
    select: { id: true },
  });
  if (!uni) throw new AppError('UNIVERSITY_NOT_FOUND', 404);
}

// ============================================================
// ЗНАЧЕНИЯ
// ВАЖНО: /values — до /:id
// ============================================================

router.get('/values', async (req, res, next) => {
  try {
    const entityIds = String(req.query.entity_ids ?? req.query.entity_id ?? '')
      .split(',')
      .filter(Boolean);

    if (entityIds.length === 0) return ok(res, []);

    // Фильтруем список entityIds по scope — пользователь видит только свои
    const scopeWhere = buildScopeWhere(req.auth!, 'universities');
    const allowed = await prisma.university.findMany({
      where: { id: { in: entityIds }, deletedAt: null, ...scopeWhere },
      select: { id: true },
    });
    const allowedIds = allowed.map((u) => u.id);

    if (allowedIds.length === 0) return ok(res, []);

    const items = await prisma.customFieldValue.findMany({
      where: { entityId: { in: allowedIds } },
    });

    return ok(res, items.map((v) => ({
      id: v.id,
      field_id: v.fieldId,
      entity_id: v.entityId,
      value_text: v.valueText,
      value_number: v.valueNumber,
      value_date: v.valueDate ? v.valueDate.toISOString().slice(0, 10) : null,
      value_bool: v.valueBool,
      value_json: v.valueJson,
      updated_at: v.updatedAt.toISOString(),
      updated_by: v.updatedBy,
    })));
  } catch (e) { next(e); }
});

router.post('/values', async (req, res, next) => {
  try {
    const data = z.object({
      field_id: z.string().uuid(),
      entity_id: z.string().uuid(),
      value: z.unknown(),
    }).strict().parse(req.body);

    await requireEntityAccess(data.entity_id, req.auth!);

    await CustomFieldsService.saveValues(data.entity_id, [{
      field_id: data.field_id,
      value: data.value,
    }]);

    return noContent(res);
  } catch (e) { next(e); }
});

/**
 * Батч-сохранение (используется фронтом через upsertValues).
 */
router.post('/values/batch', async (req, res, next) => {
  try {
    const data = z.object({
      entity_id: z.string().uuid(),
      values: z.array(z.object({
        field_id: z.string().uuid(),
        value: z.unknown(),
      })).min(1).max(200),
    }).strict().parse(req.body);

    await requireEntityAccess(data.entity_id, req.auth!);

    await CustomFieldsService.saveValues(data.entity_id, data.values);
    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// ОПРЕДЕЛЕНИЯ ПОЛЕЙ
// ============================================================

router.get('/', async (req, res, next) => {
  try {
    const entity = String(req.query.entity ?? 'universities');
    const items = await prisma.customField.findMany({
      where: { entity },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

// ВАЖНО: создание определения — только admin/manager
router.post(
  '/',
  requireRole('admin', 'manager'),
  async (req, res, next) => {
    try {
      const data = fieldBody.parse(req.body);
      const item = await prisma.customField.create({
        data: {
          key: data.key,
          label: data.label,
          fieldType: data.field_type,
          options: data.options,
          helpText: data.help_text ?? null,
          required: data.required,
          showInTable: data.show_in_table,
          sortOrder: data.sort_order,
          entity: data.entity,
        },
      });
      return created(res, item);
    } catch (e) { next(e); }
  },
);

router.patch(
  '/:id',
  requireRole('admin', 'manager'),
  async (req, res, next) => {
    try {
      const data = fieldBody.partial().parse(req.body);
      const item = await prisma.customField.update({
        where: { id: req.params.id },
        data: {
          ...(data.key !== undefined ? { key: data.key } : {}),
          ...(data.label !== undefined ? { label: data.label } : {}),
          ...(data.field_type !== undefined ? { fieldType: data.field_type } : {}),
          ...(data.options !== undefined ? { options: data.options } : {}),
          ...(data.help_text !== undefined ? { helpText: data.help_text } : {}),
          ...(data.required !== undefined ? { required: data.required } : {}),
          ...(data.show_in_table !== undefined ? { showInTable: data.show_in_table } : {}),
          ...(data.sort_order !== undefined ? { sortOrder: data.sort_order } : {}),
          ...(data.entity !== undefined ? { entity: data.entity } : {}),
        },
      });
      return ok(res, item);
    } catch (e) { next(e); }
  },
);

router.delete(
  '/:id',
  requireRole('admin'),
  async (req, res, next) => {
    try {
      await prisma.customField.delete({ where: { id: req.params.id } });
      return noContent(res);
    } catch (e) { next(e); }
  },
);

export default router;