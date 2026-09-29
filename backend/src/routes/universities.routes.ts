// backend/src/routes/universities.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { UniversitiesService } from '../services/universities.service.js';
import { TimelineService } from '../services/timeline.service.js';
import { VersionsService } from '../services/versions.service.js';
import { WsService } from '../services/ws.service.js';
import { PiiService } from '../services/pii.service.js';
import {
  created, noContent, ok, okPaginated, parsePagination, buildPagination,
} from '../utils/response.js';
import { parseCursor, buildCursorPage } from '../utils/pagination.js';
import { idempotency } from '../middleware/idempotency.js';
import {
  requireRole,
  requirePermission,
  requireMfa,
  buildScopeWhere,
} from '../middleware/auth.js';
import { AppError } from '../errors/codes.js';

const router = Router();

// ============================================================
// Схемы (без изменений)
// ============================================================
const listQuery = z.object({
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  manager: z.string().optional(),
  managerId: z.string().uuid().optional(),
  directionId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  handoverStatus: z.string().optional(),
  tagId: z.string().uuid().optional(),
  includeDeleted: z.coerce.boolean().optional(),
  onlyDeleted: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'status', 'contractValue']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

const createBody = z.object({
  name: z.string().min(1),
  city: z.string().default('Москва'),
  direction: z.string().default('Разработка'),
  product: z.string().default('Ростелеком DataLab'),
  vendorId: z.string().uuid().nullable().optional(),
  directionId: z.string().uuid().nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  contractNumber: z.string().nullable().optional(),
  licenseSigned: z.boolean().default(false),
  licenseExpiresAt: z.string().date().nullable().optional(),
  status: z.string().default('Новый'),
  handoverStatus: z.enum(['Не передан', 'Передан частично', 'Передан полностью', 'Отозван']).default('Не передан'),
  manager: z.string().optional(),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional().or(z.literal('')),
  contactPhone: z.string().nullable().optional(),
  telegram: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  maxMessenger: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  contractValue: z.coerce.number().min(0).default(0),
});

const updateBody = createBody.partial();

const bulkBody = z.object({
  ids: z.array(z.string().uuid()).max(5000).optional(),
  filters: z.record(z.unknown()).optional(),
  action: z.enum(['update_status', 'assign_manager', 'add_tag', 'remove_tag', 'soft_delete']),
  status: z.string().optional(),
  managerId: z.string().uuid().optional(),
  manager: z.string().optional(),
  tagId: z.string().uuid().optional(),
}).refine(
  (d) => (d.ids && d.ids.length > 0) || d.filters,
  { message: 'Нужно передать либо ids, либо filters' },
);

const contactBody = z.object({
  fullName: z.string().min(1),
  role: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
  telegram: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

const importContactSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
});

const importRowSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  direction: z.string().optional(),
  product: z.string().optional(),
  vendor_name: z.string().nullable().optional(),
  contract_number: z.string().nullable().optional(),
  license_signed: z.boolean().optional(),
  license_expires_at: z.string().nullable().optional(),
  status: z.string().optional(),
  handover_status: z.string().optional(),
  manager: z.string().optional(),
  contact_name: z.string().nullable().optional(),
  contact_email: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  telegram: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  max_messenger: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  source: z.string().optional(),
  __contacts: z.array(importContactSchema).optional(),
}).passthrough();

const importBodySchema = z.object({
  rows: z.array(importRowSchema).min(1).max(5000),
});

const contactImportRowSchema = z.object({
  full_name: z.string().min(1).max(300),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  university_name: z.string().min(1).max(500),
  notes: z.string().nullable().optional(),
}).passthrough();

const contactImportBodySchema = z.object({
  rows: z.array(contactImportRowSchema).min(1).max(5000),
  createMissingUniversities: z.boolean().default(false),
});

const transferBody = z.object({
  toManagerId: z.string().uuid(),
  comment: z.string().max(500).optional(),
});

// ============================================================
// GET /universities
// ============================================================
router.get('/', async (req, res, next) => {
  try {
    const q = listQuery.parse(req.query);
    const { page, pageSize, skip, take } = parsePagination(q);
    const { items, total } = await UniversitiesService.list({
      ...q,
      skip,
      take,
      auth: req.auth!,
    });
    return okPaginated(res, items, buildPagination(page, pageSize, total));
  } catch (e) { next(e); }
});

// ============================================================
// GET /universities/cursor
// ============================================================
router.get('/cursor', async (req, res, next) => {
  try {
    const { take, cursor, skip } = parseCursor(req);
    const scopeWhere = req.auth ? buildScopeWhere(req.auth, 'universities') : {};
    const items = await prisma.university.findMany({
      where: { deletedAt: null, ...scopeWhere },
      take: take + 1,
      cursor: cursor ?? undefined,
      skip,
      orderBy: { id: 'asc' },
    });
    const page = buildCursorPage(items, take);
    return ok(res, page);
  } catch (e) { next(e); }
});

// ============================================================
// POST /universities/import — импорт вузов из Excel
// ============================================================
router.post(
  '/import',
  requireRole('admin', 'manager'),
  requirePermission('universities.import'),
  async (req, res, next) => {
    try {
      const { rows } = importBodySchema.parse(req.body);
      const auth = req.auth!;
      let inserted = 0, updated = 0, failed = 0, contactsImported = 0;
      const errors: { rowIndex: number; message: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        try {
          const managerForCreate =
            auth.role === 'nam' ? auth.name : (r.manager ?? 'Анна Кузнецова');
          const existing = await prisma.university.findFirst({
            where: auth.role === 'nam'
              ? { name: r.name, deletedAt: null, manager: auth.name }
              : { name: r.name, deletedAt: null },
            select: { id: true },
          });

          // ── Резолвим каталоги по имени (вендор, направление, продукт).
          //    Создаём недостающие. Это закрывает ТЗ п.4.1 и даёт
          //    возможность фильтровать по вендору / продукту (п.4.Функц.1).
          const resolved = await UniversitiesService.resolveCatalogsByName({
            vendorName: r.vendor_name ?? null,
            directionName: r.direction ?? null,
            productName: r.product ?? null,
          });

          const baseData = {
            name: r.name,
            city: r.city ?? 'Москва',
            direction: r.direction ?? 'Разработка',
            product: r.product ?? 'Ростелеком DataLab',
            vendorId: resolved.vendorId,
            directionId: resolved.directionId,
            productId: resolved.productId,
            contractNumber: r.contract_number ?? null,
            licenseSigned: r.license_signed ?? false,
            licenseExpiresAt: r.license_expires_at
              ? new Date(r.license_expires_at)
              : null,
            status: r.status ?? 'Новый',
            handoverStatus: r.handover_status ?? 'Не передан',
            manager: managerForCreate,
            contactName: r.contact_name ?? null,
            // ── 152-ФЗ: ПД шифруем при импорте
            contactEmail: PiiService.encrypt(r.contact_email ?? null),
            contactPhone: PiiService.encrypt(r.contact_phone ?? null),
            telegram: PiiService.encrypt(r.telegram ?? null),
            whatsapp: PiiService.encrypt(r.whatsapp ?? null),
            maxMessenger: PiiService.encrypt(r.max_messenger ?? null),
            notes: r.notes ?? null,
            source: r.source ?? 'Импорт',
          };
          let universityId: string;
          if (existing) {
            await prisma.university.update({ where: { id: existing.id }, data: baseData });
            universityId = existing.id;
            updated++;
          } else {
            const createdUni = await prisma.university.create({ data: baseData });
            universityId = createdUni.id;
            inserted++;
          }
          if (r.__contacts && r.__contacts.length > 0) {
            for (const c of r.__contacts) {
              const dup = await prisma.universityContact.findFirst({
                where: { universityId, fullName: c.full_name, email: c.email ?? null },
                select: { id: true },
              });
              if (dup) continue;
              await prisma.universityContact.create({
                data: {
                  universityId,
                  fullName: c.full_name,
                  // ── 152-ФЗ: ПД контакта тоже шифруем
                  email: PiiService.encrypt(c.email ?? null),
                  phone: PiiService.encrypt(c.phone ?? null),
                  isPrimary: false,
                },
              });
              contactsImported++;
            }
          }
        } catch (e) {
          failed++;
          errors.push({ rowIndex: i, message: e instanceof Error ? e.message : 'unknown' });
        }
      }

      try {
        await prisma.auditLog.create({
          data: {
            userId: auth.profileId,
            userEmail: auth.email,
            entity: 'universities',
            entityId: null,
            action: 'insert',
            before: null as never,
            after: { import: true, total: rows.length, inserted, updated, failed, contactsImported } as never,
          },
        });
      } catch { /* ignore */ }

      return ok(res, { inserted, updated, failed, contactsImported, errors });
    } catch (e) { next(e); }
  },
);

// ============================================================
// POST /universities/contacts/import
// ============================================================
router.post(
  '/contacts/import',
  requireRole('admin', 'manager'),
  requirePermission('universities.import'),
  async (req, res, next) => {
    try {
      const { rows, createMissingUniversities } = contactImportBodySchema.parse(req.body);
      const auth = req.auth!;
      const scopeWhere = buildScopeWhere(auth, 'universities');
      let inserted = 0, updated = 0, skipped = 0, failed = 0, universitiesCreated = 0;
      const errors: { rowIndex: number; message: string }[] = [];
      const uniCache = new Map<string, string>();
      const normalize = (s: string) => s.trim().toLowerCase();
      const accessible = await prisma.university.findMany({
        where: { deletedAt: null, ...scopeWhere },
        select: { id: true, name: true },
      });
      accessible.forEach((u) => uniCache.set(normalize(u.name), u.id));

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        try {
          const uniKey = normalize(r.university_name);
          let universityId = uniCache.get(uniKey);
          if (!universityId) {
            if (!createMissingUniversities) {
              errors.push({ rowIndex: i, message: `Вуз «${r.university_name}» не найден` });
              failed++;
              continue;
            }
            const created = await prisma.university.create({
              data: {
                name: r.university_name.trim(),
                city: 'Москва',
                manager: auth.name,
                source: 'Импорт контактов',
              },
              select: { id: true },
            });
            universityId = created.id;
            uniCache.set(uniKey, universityId);
            universitiesCreated++;
          }
          const existing = await prisma.universityContact.findFirst({
            where: { universityId, fullName: r.full_name, email: r.email ?? null },
            select: { id: true },
          });
          if (existing) {
            await prisma.universityContact.update({
              where: { id: existing.id },
              data: {
                role: r.role ?? undefined,
                // ── 152-ФЗ: шифруем при обновлении
                phone: r.phone !== undefined
                  ? PiiService.encrypt(r.phone ?? null) ?? undefined
                  : undefined,
                notes: r.notes ?? undefined,
              },
            });
            updated++;
          } else {
            await prisma.universityContact.create({
              data: {
                universityId,
                fullName: r.full_name.trim(),
                // ── 152-ФЗ: шифруем при создании
                email: PiiService.encrypt(r.email ?? null),
                phone: PiiService.encrypt(r.phone ?? null),
                role: r.role ?? null,
                notes: r.notes ?? null,
                isPrimary: false,
              },
            });
            inserted++;
          }
        } catch (e) {
          failed++;
          errors.push({ rowIndex: i, message: e instanceof Error ? e.message : 'unknown' });
        }
      }

      await prisma.auditLog.create({
        data: {
          userId: auth.profileId,
          userEmail: auth.email,
          entity: 'university_contacts',
          entityId: null,
          action: 'insert',
          before: null as never,
          after: { import: true, inserted, updated, skipped, failed, universitiesCreated } as never,
        },
      }).catch(() => {});

      return ok(res, { inserted, updated, skipped, failed, universitiesCreated, errors });
    } catch (e) { next(e); }
  },
);

// ============================================================
// POST /universities/bulk
// ============================================================
router.post(
  '/bulk',
  requirePermission('universities.update'),
  requireMfa,
  idempotency(),
  async (req, res, next) => {
    try {
      const data = bulkBody.parse(req.body);
      const auth = req.auth!;

      // ВАЖНО: назначение/передача ответственного — только для admin/manager.
      // Роль nam должна получить ИМЕННО CRM-403-003 (CANNOT_ASSIGN_MANAGER),
      // а не generic CRM-403-002 из requirePermission.
      if (data.action === 'assign_manager' && auth.role === 'nam') {
        throw new AppError('CANNOT_ASSIGN_MANAGER', 403);
      }

      const scopeWhere = buildScopeWhere(auth, 'universities');
      let ids = data.ids ?? [];

      if (ids.length === 0 && data.filters) {
        const f = data.filters as Record<string, unknown>;
        const where = {
          ...scopeWhere,
          deletedAt: null,
          ...(f.search ? {
            OR: [
              { name: { contains: String(f.search), mode: 'insensitive' as const } },
              { city: { contains: String(f.search), mode: 'insensitive' as const } },
            ],
          } : {}),
          ...(f.status ? { status: String(f.status) } : {}),
          ...(f.managerId ? { managerId: String(f.managerId) } : {}),
          ...(f.tagId ? { tags: { some: { tagId: String(f.tagId) } } } : {}),
        };
        const rows = await prisma.university.findMany({
          where,
          select: { id: true },
          take: 5000,
        });
        ids = rows.map((r) => r.id);
        if (ids.length === 0) return ok(res, { affected: 0, action: data.action });
      }

      if (ids.length === 0) return ok(res, { affected: 0, action: data.action });

      const result = await UniversitiesService.bulk({ ...data, ids }, auth);
      return ok(res, result);
    } catch (e) { next(e); }
  },
);

// ============================================================
// POST /universities
// ============================================================
router.post(
  '/',
  requirePermission('universities.create'),
  idempotency(),
  async (req, res, next) => {
    try {
      const data = createBody.parse(req.body);
      const item = await UniversitiesService.create(data, req.auth!);
      return created(res, item);
    } catch (e) { next(e); }
  },
);

// ============================================================
// GET /universities/:id/timeline
// ============================================================
router.get('/:id/timeline', async (req, res, next) => {
  try {
    const scopeWhere = buildScopeWhere(req.auth!, 'universities');
    const allowed = await prisma.university.findFirst({
      where: { id: req.params.id, ...scopeWhere },
      select: { id: true },
    });
    if (!allowed) {
      return res.status(404).json({ ok: false, code: 'CRM-404-002', message: 'Вуз не найден' });
    }
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const items = await TimelineService.forUniversity(req.params.id, limit);
    return ok(res, items);
  } catch (e) { next(e); }
});

// ============================================================
// GET /universities/:id/comments
// ============================================================
router.get('/:id/comments', async (req, res, next) => {
  try {
    const items = await prisma.comment.findMany({
      where: { universityId: req.params.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

// ============================================================
// POST /universities/:id/comments
// ============================================================
router.post(
  '/:id/comments',
  requirePermission('universities.comment'),
  async (req, res, next) => {
    try {
      const data = z.object({
        body: z.string().min(1).max(5000),
        attachments: z.array(z.object({
          name: z.string().min(1).max(500),
          url: z.string().url().max(2000),
          size: z.number().int().min(0).optional(),
          mime: z.string().max(200).optional(),
        })).max(20).default([]),
      }).parse(req.body);

      const item = await prisma.comment.create({
        data: {
          universityId: req.params.id,
          body: data.body,
          author: req.auth?.name ?? 'Пользователь',
          attachments: data.attachments as never,
        },
      });
      return created(res, item);
    } catch (e) { next(e); }
  },
);

// ============================================================
// POST /universities/:id/tags/set
// ============================================================
router.post(
  '/:id/tags/set',
  requirePermission('universities.update'),
  async (req, res, next) => {
    try {
      const { tag_ids } = z.object({
        tag_ids: z.array(z.string().uuid()),
      }).parse(req.body);
      await prisma.$transaction([
        prisma.universityTag.deleteMany({ where: { universityId: req.params.id } }),
        prisma.universityTag.createMany({
          data: tag_ids.map((tagId) => ({ universityId: req.params.id, tagId })),
          skipDuplicates: true,
        }),
      ]);
      return noContent(res);
    } catch (e) { next(e); }
  },
);

// ============================================================
// GET /universities/:id
// ============================================================
router.get('/:id', async (req, res, next) => {
  try {
    const item = await UniversitiesService.getById(req.params.id, req.auth!);
    return ok(res, item);
  } catch (e) { next(e); }
});

// ============================================================
// POST /universities/:id/restore
// ============================================================
router.post(
  '/:id/restore',
  requirePermission('universities.update'),
  async (req, res, next) => {
    try {
      const scopeWhere = buildScopeWhere(req.auth!, 'universities');
      const existing = await prisma.university.findFirst({
        where: { id: req.params.id, ...scopeWhere },
        __includeDeleted: true,
      } as never);
      if (!existing) {
        return res.status(404).json({ ok: false, code: 'CRM-404-002', message: 'Вуз не найден' });
      }
      await prisma.university.update({
        where: { id: req.params.id },
        data: { deletedAt: null },
      });
      await prisma.auditLog.create({
        data: {
          userId: req.auth!.profileId,
          userEmail: req.auth!.email,
          entity: 'universities',
          entityId: req.params.id,
          action: 'restore',
          before: { deleted_at: existing.deletedAt } as never,
          after: { deleted_at: null } as never,
        },
      }).catch(() => {});
      return noContent(res);
    } catch (e) { next(e); }
  },
);

// ============================================================
// POST /universities/:id/transfer
// ============================================================
router.post(
  '/:id/transfer',
  requireRole('admin', 'manager'),
  requirePermission('universities.transfer'),
  async (req, res, next) => {
    try {
      const data = transferBody.parse(req.body);
      const auth = req.auth!;
      const scopeWhere = buildScopeWhere(auth, 'universities');

      const before = await prisma.university.findFirst({
        where: { id: req.params.id, deletedAt: null, ...scopeWhere },
      });
      if (!before) throw new AppError('UNIVERSITY_NOT_FOUND', 404);

      const toManager = await prisma.manager.findUnique({
        where: { id: data.toManagerId },
        select: { id: true, fullName: true, profileId: true, active: true },
      });
      if (!toManager) throw new AppError('NOT_FOUND', 404);
      if (!toManager.active) throw new AppError('STATE_CONFLICT', 409);

      if (before.managerId === toManager.id) {
        return res.status(409).json({
          ok: false, code: 'CRM-409-002', message: 'Уже назначен этот менеджер',
        });
      }

      const item = await prisma.university.update({
        where: { id: req.params.id },
        data: { managerId: toManager.id, manager: toManager.fullName },
      });

      await VersionsService.save(
        'universities',
        item.id,
        item as unknown as Record<string, unknown>,
        { before, after: item, reason: 'transfer' } as unknown as Record<string, unknown>,
        {
          authorId: auth.profileId,
          authorName: auth.name,
          comment: `Передача: ${before.manager} → ${toManager.fullName}${data.comment ? ` (${data.comment})` : ''}`,
        },
      ).catch(() => {});

      if (toManager.profileId) {
        await prisma.notification.create({
          data: {
            userId: toManager.profileId,
            type: 'transfer',
            title: `Вам передан вуз «${item.name}»`,
            body: `От: ${before.manager}${data.comment ? `. ${data.comment}` : ''}`,
            entity: 'universities',
            entityId: item.id,
            actionUrl: `/universities/${item.id}`,
          },
        }).catch(() => {});
      }
      if (before.managerId) {
        const prevMgr = await prisma.manager.findUnique({
          where: { id: before.managerId },
          select: { profileId: true },
        });
        if (prevMgr?.profileId) {
          await prisma.notification.create({
            data: {
              userId: prevMgr.profileId,
              type: 'transfer',
              title: `Вуз «${item.name}» передан`,
              body: `Новый ответственный: ${toManager.fullName}`,
              entity: 'universities',
              entityId: item.id,
              actionUrl: `/universities/${item.id}`,
            },
          }).catch(() => {});
        }
      }

      WsService.broadcast({
        type: 'universities:transferred',
        entity: 'universities',
        entityId: item.id,
        actor: auth.email,
      });

      return ok(res, item);
    } catch (e) { next(e); }
  },
);

// ============================================================
// PATCH /universities/:id
// ============================================================
router.patch(
  '/:id',
  requirePermission('universities.update'),
  async (req, res, next) => {
    try {
      const data = updateBody.parse(req.body);
      const item = await UniversitiesService.update(req.params.id, data, req.auth!);
      return ok(res, item);
    } catch (e) { next(e); }
  },
);

// ============================================================
// DELETE /universities/:id — только admin
// ============================================================
router.delete(
  '/:id',
  // ── ТЗ п.4.11: удаление вуза — привилегия admin'а.
  //    Даже если кастомная роль выдала nam/manager'у
  //    'universities.delete' — этот роут остаётся admin-only.
  //    Если нужен «мягкий» вариант для manager — есть отдельный
  //    bulk soft_delete с scope-проверкой.
  requireRole('admin'),
  requireMfa,
  requirePermission('universities.delete'),
  async (req, res, next) => {
    try {
      await UniversitiesService.softDelete(req.params.id, req.auth!);
      return noContent(res);
    } catch (e) { next(e); }
  },
);

// ============================================================
// Contacts
// ============================================================
router.get('/:id/contacts', async (req, res, next) => {
  try {
    const items = await UniversitiesService.listContacts(req.params.id);
    return ok(res, items);
  } catch (e) { next(e); }
});

router.post(
  '/:id/contacts',
  requirePermission('universities.update'),
  async (req, res, next) => {
    try {
      const data = contactBody.parse(req.body);
      const item = await UniversitiesService.addContact(req.params.id, data);
      return created(res, item);
    } catch (e) { next(e); }
  },
);

router.patch(
  '/contacts/:contactId',
  requirePermission('universities.update'),
  async (req, res, next) => {
    try {
      const data = contactBody.partial().parse(req.body);
      const item = await UniversitiesService.updateContact(req.params.contactId, data);
      return ok(res, item);
    } catch (e) { next(e); }
  },
);

router.delete(
  '/contacts/:contactId',
  requirePermission('universities.update'),
  async (req, res, next) => {
    try {
      await UniversitiesService.deleteContact(req.params.contactId);
      return noContent(res);
    } catch (e) { next(e); }
  },
);

// ============================================================
// Documents
// ============================================================
router.get('/:id/documents', async (req, res, next) => {
  try {
    const items = await UniversitiesService.listDocuments(req.params.id);
    return ok(res, items);
  } catch (e) { next(e); }
});

export default router;