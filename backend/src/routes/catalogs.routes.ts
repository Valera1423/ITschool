// backend/src/routes/catalogs.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { prisma } from '../db/prisma.js';
import { PiiService, VENDOR_PII_FIELDS } from '../services/pii.service.js';
import { requirePermission } from '../middleware/auth.js';
import { ok, created, noContent } from '../utils/response.js';

const router = Router();

const vendorBody = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  site: z.string().url().nullable().optional().or(z.literal('')),
  contactName: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional().or(z.literal('')),
  contactMethods: z.array(z.string()).default([]),
});

const directionBody = z.object({
  name: z.string().min(1),
  code: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  color: z.string().default('sky'),
  sortOrder: z.number().default(100),
});

const productBody = z.object({
  name: z.string().min(1),
  vendorId: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  licenseType: z.string().nullable().optional(),
  color: z.string().default('sky'),
  sortOrder: z.number().default(100),
});

const statusBody = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  color: z.string().default('slate'),
  sortOrder: z.number().default(100),
  isFinal: z.boolean().default(false),
});

const managerBody = z.object({
  fullName: z.string().min(1),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  avatarColor: z.string().default('blue'),
  active: z.boolean().default(true),
  sortOrder: z.number().default(100),
  notes: z.string().nullable().optional(),
  profileId: z.string().uuid().nullable().optional(),
});

// ============================================================
// VENDORS
// ============================================================
router.get('/vendors', async (_req, res, next) => {
  try {
    const items = await prisma.vendor.findMany({ orderBy: { name: 'asc' } });
    const decrypted = items.map((v) =>
      PiiService.decryptFields(v as unknown as Record<string, unknown>, [
        ...VENDOR_PII_FIELDS,
      ] as never),
    );
    return ok(res, decrypted);
  } catch (e) { next(e); }
});

router.post('/vendors', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    const data = vendorBody.parse(req.body);
    const item = await prisma.vendor.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        site: data.site || null,
        contactName: data.contactName ?? null,
        contactPhone: PiiService.encrypt(data.contactPhone),
        contactEmail: PiiService.encrypt(data.contactEmail),
        contactMethods: data.contactMethods,
      },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

router.patch('/vendors/:id', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    const data = vendorBody.partial().parse(req.body);
    const item = await prisma.vendor.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.site !== undefined ? { site: data.site || null } : {}),
        ...(data.contactName !== undefined ? { contactName: data.contactName } : {}),
        ...(data.contactPhone !== undefined
          ? { contactPhone: PiiService.encrypt(data.contactPhone) }
          : {}),
        ...(data.contactEmail !== undefined
          ? { contactEmail: PiiService.encrypt(data.contactEmail) }
          : {}),
        ...(data.contactMethods !== undefined
          ? { contactMethods: data.contactMethods }
          : {}),
        updatedAt: new Date(),
      },
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/vendors/:id', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    await prisma.vendor.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// DIRECTIONS
// ============================================================
router.get('/directions', async (_req, res, next) => {
  try {
    const items = await prisma.itDirection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

router.post('/directions', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    const data = directionBody.parse(req.body);
    const item = await prisma.itDirection.create({ data });
    return created(res, item);
  } catch (e) { next(e); }
});

router.patch('/directions/:id', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    const data = directionBody.partial().parse(req.body);
    const item = await prisma.itDirection.update({
      where: { id: req.params.id },
      data: { ...data, updatedAt: new Date() },
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/directions/:id', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    await prisma.itDirection.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// PRODUCTS
// ============================================================
router.get('/products', async (_req, res, next) => {
  try {
    const items = await prisma.itProduct.findMany({
      include: { vendor: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

router.post('/products', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    const data = productBody.parse(req.body);
    const item = await prisma.itProduct.create({ data });
    return created(res, item);
  } catch (e) { next(e); }
});

router.patch('/products/:id', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    const data = productBody.partial().parse(req.body);
    const item = await prisma.itProduct.update({
      where: { id: req.params.id },
      data: { ...data, updatedAt: new Date() },
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/products/:id', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    await prisma.itProduct.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// STATUSES
// ============================================================
router.get('/statuses', async (_req, res, next) => {
  try {
    const items = await prisma.workflowStatusCatalog.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

router.post('/statuses', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    const data = statusBody.parse(req.body);
    const item = await prisma.workflowStatusCatalog.create({ data });
    return created(res, item);
  } catch (e) { next(e); }
});

router.patch('/statuses/:id', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    const data = statusBody.partial().parse(req.body);
    const item = await prisma.workflowStatusCatalog.update({
      where: { id: req.params.id },
      data,
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/statuses/:id', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    await prisma.workflowStatusCatalog.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// MANAGERS
// ============================================================
router.get('/managers', async (req, res, next) => {
  try {
    const activeOnly = String(req.query.activeOnly) === 'true';
    const items = await prisma.manager.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { fullName: 'asc' }],
    });
    return ok(res, items);
  } catch (e) { next(e); }
});

router.post('/managers', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    const data = managerBody.parse(req.body);
    const item = await prisma.manager.create({
      data: { ...data, email: data.email || null },
    });
    return created(res, item);
  } catch (e) { next(e); }
});

router.patch('/managers/:id', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    const data = managerBody.partial().parse(req.body);
    const item = await prisma.manager.update({
      where: { id: req.params.id },
      data: { ...data, email: data.email || null, updatedAt: new Date() },
    });
    return ok(res, item);
  } catch (e) { next(e); }
});

router.delete('/managers/:id', requirePermission('catalogs.manage'), async (req, res, next) => {
  try {
    await prisma.manager.delete({ where: { id: req.params.id } });
    return noContent(res);
  } catch (e) { next(e); }
});

// ============================================================
// IMPORT CATALOGS
// ============================================================
const importCatalogBody = z.object({
  rows: z.array(z.object({
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    code: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    sortOrder: z.coerce.number().nullable().optional(),
    vendorName: z.string().nullable().optional(),
    licenseType: z.string().nullable().optional(),
    site: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    position: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    active: z.coerce.boolean().nullable().optional(),
    contactName: z.string().nullable().optional(),
    contactPhone: z.string().nullable().optional(),
    contactEmail: z.string().nullable().optional(),
    contactMethods: z.union([
      z.array(z.string()),
      z.string(),
      z.null(),
    ]).optional(),
  })).min(1).max(2000),
  mode: z.enum(['upsert', 'insert-only']).default('upsert'),
});

router.post(
  '/:entity/import',
  requirePermission('catalogs.manage'),
  async (req, res, next) => {
    try {
      const entity = req.params.entity as 'vendors' | 'directions' | 'products' | 'managers';
      if (!['vendors', 'directions', 'products', 'managers'].includes(entity)) {
        return res.status(404).json({ ok: false, code: 'CRM-404-001', message: 'Неизвестный каталог' });
      }
      const data = importCatalogBody.parse(req.body);
      let inserted = 0, updated = 0, skipped = 0, failed = 0;
      const errors: { rowIndex: number; message: string }[] = [];

      const vendorMap = new Map<string, string>();
      if (entity === 'products') {
        const vendors = await prisma.vendor.findMany({ select: { id: true, name: true } });
        vendors.forEach((v) => vendorMap.set(v.name.toLowerCase(), v.id));
      }

      for (let i = 0; i < data.rows.length; i++) {
        const r = data.rows[i];
        const name = r.name.trim();
        if (!name) { skipped++; continue; }
        try {
          if (entity === 'vendors') {
            const existing = await prisma.vendor.findFirst({ where: { name } });

            const methods = Array.isArray(r.contactMethods)
              ? r.contactMethods
              : typeof r.contactMethods === 'string'
                ? r.contactMethods.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
                : [];

            const payload = {
              description: r.description ?? undefined,
              site: r.site ?? undefined,
              contactName: r.contactName ?? undefined,
              contactPhone: r.contactPhone !== undefined
                ? PiiService.encrypt(r.contactPhone)
                : undefined,
              contactEmail: r.contactEmail !== undefined
                ? PiiService.encrypt(r.contactEmail)
                : undefined,
              ...(methods.length > 0 ? { contactMethods: methods } : {}),
            };

            if (existing) {
              if (data.mode === 'insert-only') { skipped++; continue; }
              await prisma.vendor.update({ where: { id: existing.id }, data: payload });
              updated++;
            } else {
              await prisma.vendor.create({ data: { name, ...payload } });
              inserted++;
            }
            continue;
          }
          if (entity === 'directions') {
            const existing = await prisma.itDirection.findFirst({ where: { name } });
            if (existing) {
              if (data.mode === 'insert-only') { skipped++; continue; }
              await prisma.itDirection.update({
                where: { id: existing.id },
                data: {
                  code: r.code ?? existing.code,
                  description: r.description ?? existing.description,
                  color: r.color ?? existing.color,
                  sortOrder: r.sortOrder ?? existing.sortOrder,
                  updatedAt: new Date(),
                },
              });
              updated++;
            } else {
              await prisma.itDirection.create({
                data: {
                  name,
                  code: r.code ?? null,
                  description: r.description ?? null,
                  color: r.color ?? 'sky',
                  sortOrder: r.sortOrder ?? 100,
                },
              });
              inserted++;
            }
            continue;
          }
          if (entity === 'managers') {
            const existing = await prisma.manager.findFirst({ where: { fullName: name } });
            if (existing) {
              if (data.mode === 'insert-only') { skipped++; continue; }
              await prisma.manager.update({
                where: { id: existing.id },
                data: {
                  email: r.email ?? existing.email,
                  phone: r.phone ?? existing.phone,
                  position: r.position ?? existing.position,
                  department: r.department ?? existing.department,
                  avatarColor: r.color ?? existing.avatarColor,
                  active: r.active ?? existing.active,
                  sortOrder: r.sortOrder ?? existing.sortOrder,
                  updatedAt: new Date(),
                },
              });
              updated++;
            } else {
              await prisma.manager.create({
                data: {
                  fullName: name,
                  email: r.email ?? null,
                  phone: r.phone ?? null,
                  position: r.position ?? null,
                  department: r.department ?? null,
                  avatarColor: r.color ?? 'blue',
                  active: r.active ?? true,
                  sortOrder: r.sortOrder ?? 100,
                },
              });
              inserted++;
            }
            continue;
          }
          const vendorId = r.vendorName
            ? vendorMap.get(r.vendorName.trim().toLowerCase()) ?? null
            : null;
          if (r.vendorName && !vendorId) {
            errors.push({
              rowIndex: i,
              message: `Вендор «${r.vendorName}» не найден — продукт создан без привязки`,
            });
          }
          const existing = await prisma.itProduct.findFirst({ where: { name } });
          if (existing) {
            if (data.mode === 'insert-only') { skipped++; continue; }
            await prisma.itProduct.update({
              where: { id: existing.id },
              data: {
                vendorId: vendorId ?? existing.vendorId,
                description: r.description ?? existing.description,
                licenseType: r.licenseType ?? existing.licenseType,
                color: r.color ?? existing.color,
                sortOrder: r.sortOrder ?? existing.sortOrder,
                updatedAt: new Date(),
              },
            });
            updated++;
          } else {
            await prisma.itProduct.create({
              data: {
                name,
                vendorId,
                description: r.description ?? null,
                licenseType: r.licenseType ?? null,
                color: r.color ?? 'sky',
                sortOrder: r.sortOrder ?? 100,
              },
            });
            inserted++;
          }
        } catch (e) {
          failed++;
          errors.push({ rowIndex: i, message: e instanceof Error ? e.message : 'unknown' });
        }
      }

      try {
        await prisma.auditLog.create({
          data: {
            userId: req.auth!.profileId,
            userEmail: req.auth!.email,
            entity: `catalog:${entity}`,
            entityId: null,
            action: 'insert',
            before: null as never,
            after: { import: true, inserted, updated, skipped, failed } as never,
          },
        });
      } catch { /* ignore */ }

      return ok(res, { inserted, updated, skipped, failed, errors });
    } catch (e) { next(e); }
  },
);

router.get('/:entity/template', async (req, res, next) => {
  try {
    const entity = req.params.entity as 'vendors' | 'directions' | 'products' | 'managers';
    if (!['vendors', 'directions', 'products', 'managers'].includes(entity)) {
      return res.status(404).json({ ok: false, code: 'CRM-404-001', message: 'Неизвестный каталог' });
    }
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ИТ Школа РТК · CRM';
    const ws = wb.addWorksheet('Импорт');

    if (entity === 'vendors') {
      ws.columns = [
        { header: 'Название', key: 'name', width: 30 },
        { header: 'ФИО контакта', key: 'contactName', width: 25 },
        { header: 'Телефон', key: 'contactPhone', width: 18 },
        { header: 'Почта', key: 'contactEmail', width: 26 },
        { header: 'Способ связи', key: 'contactMethods', width: 22 },
        { header: 'Описание', key: 'description', width: 40 },
        { header: 'Сайт', key: 'site', width: 30 },
      ];
      ws.addRow({
        name: 'ООО «Ростелеком»',
        contactName: 'Кузнецов Дмитрий Сергеевич',
        contactPhone: '+7 (922) 333-44-55',
        contactEmail: 'kuznetsov.ds@example.ru',
        contactMethods: 'Почта, Чат в ТГ',
        description: 'Интегратор',
        site: 'https://rt.ru',
      });
    } else if (entity === 'directions') {
      ws.columns = [
        { header: 'Название', key: 'name', width: 30 },
        { header: 'Код', key: 'code', width: 12 },
        { header: 'Описание', key: 'description', width: 40 },
        { header: 'Цвет', key: 'color', width: 12 },
        { header: 'Порядок', key: 'sortOrder', width: 10 },
      ];
      ws.addRow({ name: 'Разработка', code: 'DEV', description: 'Разработка ПО', color: 'sky', sortOrder: 10 });
    } else if (entity === 'managers') {
      ws.columns = [
        { header: 'ФИО', key: 'name', width: 30 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Телефон', key: 'phone', width: 20 },
        { header: 'Должность', key: 'position', width: 25 },
        { header: 'Отдел', key: 'department', width: 25 },
        { header: 'Цвет', key: 'color', width: 12 },
        { header: 'Порядок', key: 'sortOrder', width: 10 },
      ];
      ws.addRow({
        name: 'Кузнецова Анна',
        email: 'a.kuznetsova@rt.ru',
        phone: '+7 495 000-00-00',
        position: 'Руководитель направления',
        department: 'ИТ Школа',
        color: 'blue',
        sortOrder: 10,
      });
    } else {
      ws.columns = [
        { header: 'Название', key: 'name', width: 30 },
        { header: 'Вендор', key: 'vendorName', width: 25 },
        { header: 'Тип лицензии', key: 'licenseType', width: 18 },
        { header: 'Описание', key: 'description', width: 40 },
        { header: 'Порядок', key: 'sortOrder', width: 10 },
      ];
      ws.addRow({
        name: 'Ростелеком DataLab',
        vendorName: 'Ростелеком',
        licenseType: 'Enterprise',
        description: 'Платформа данных',
        sortOrder: 10,
      });
    }

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0284C7' },
    };

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="template-${entity}.xlsx"`,
    );
    return res.send(Buffer.from(buf as ArrayBuffer));
  } catch (e) { next(e); }
});

export default router;