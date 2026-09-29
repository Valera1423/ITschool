import ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';
import { AppError } from '../errors/codes.js';
import { VersionsService } from './versions.service.js';
import type { AuthUser } from '../middleware/auth.js';

interface ExportOptions {
  entity: 'universities' | 'tasks' | 'interactions';
  filters?: Record<string, unknown>;
  user: AuthUser;
}

interface ImportResult {
  updated: number;
  created: number;
  failed: number;
  unchanged: number;
  deleted: number;
  errors: { row: number; message: string }[];
  newVersion: string;
}

// Колонки, доступные для редактирования через Excel (snake_case)
const EDITABLE_FIELDS: Record<string, string[]> = {
  universities: [
    'name', 'city', 'direction', 'product', 'status',
    'handover_status', 'manager', 'contract_number',
    'contract_value', 'license_signed', 'license_expires_at',
    'contact_name', 'contact_email', 'contact_phone',
    'telegram', 'whatsapp', 'max_messenger', 'notes',
  ],
  tasks: [
    'title', 'description', 'status', 'priority',
    'due_date', 'assignee',
  ],
  interactions: [
    'type', 'title', 'details', 'interaction_date',
    'status', 'manager',
  ],
};

// Русские заголовки
const FIELD_LABELS: Record<string, string> = {
  name: 'Название',
  city: 'Город',
  direction: 'Направление',
  product: 'Продукт',
  status: 'Статус',
  handover_status: 'Передача ПО',
  manager: 'Менеджер',
  contract_number: 'Номер договора',
  contract_value: 'Сумма договора',
  license_signed: 'Лицензия подписана',
  license_expires_at: 'Срок лицензии',
  contact_name: 'Контактное лицо',
  contact_email: 'Email',
  contact_phone: 'Телефон',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  max_messenger: 'MAX',
  notes: 'Заметки',
  title: 'Название',
  description: 'Описание',
  priority: 'Приоритет',
  due_date: 'Срок',
  assignee: 'Ответственный',
  type: 'Тип',
  details: 'Детали',
  interaction_date: 'Дата',
};

export class ExcelSyncService {
  // ============================================================
  // EXPORT
  // ============================================================
  static async export(
    entity: ExportOptions['entity'],
    filters: Record<string, unknown>,
    user: AuthUser,
  ): Promise<{ buffer: Buffer; filename: string; sessionId: string }> {
    const rows = await this.loadRows(entity, filters);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ИТ Школа РТК · CRM';
    wb.created = new Date();

    const ws = wb.addWorksheet('Данные');

    ws.columns = [
      { header: '_id', key: '_id', width: 38, hidden: true },
      { header: '_rev', key: '_rev', width: 10, hidden: true },
      ...EDITABLE_FIELDS[entity].map((f) => ({
        header: FIELD_LABELS[f] ?? f,
        key: f,
        width: this.columnWidth(f),
      })),
      { header: '_delete', key: '_delete', width: 10 },
    ];

    // Стилизация заголовка
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0284C7' },
    };

    // Данные
    for (const r of rows) {
      const row = ws.addRow({
        _id: r.id,
        _rev: r.version ?? 1,
        ...EDITABLE_FIELDS[entity].reduce((acc, f) => {
          acc[f] = this.serializeValue(r[f]);
          return acc;
        }, {} as Record<string, unknown>),
        _delete: '',
      });
      row.alignment = { vertical: 'middle' };
    }

    ws.views = [{ state: 'frozen', ySplit: 1 }];

    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: ws.columns.length },
    };

    // Data validation для статусов
    if (entity === 'universities') {
      const statusCol = EDITABLE_FIELDS.universities.indexOf('status') + 3;
      const statuses = ['Новый', 'Переговоры', 'Обучение', 'Внедрение', 'Партнёр', 'Отказ'];
      for (let i = 2; i <= rows.length + 500; i++) {
        ws.getCell(i, statusCol).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`"${statuses.join(',')}"`],
        };
      }
    }

    const buffer = await wb.xlsx.writeBuffer();

    const session = await prisma.excelExportSession.create({
      data: {
        userId: user.profileId ?? '00000000-0000-0000-0000-000000000000',
        entity,
        filename: `export-${entity}-${new Date().toISOString().slice(0, 10)}.xlsx`,
        rowsCount: rows.length,
        filterHash: JSON.stringify(filters).slice(0, 200),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });

    return {
      buffer: Buffer.from(buffer as ArrayBuffer),
      filename: `crm-${entity}-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sessionId: session.id,
    };
  }

  // ============================================================
  // IMPORT
  // ============================================================
  static async import(
    entity: ExportOptions['entity'],
    fileBuffer: Buffer,
    user: AuthUser,
  ): Promise<ImportResult> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fileBuffer as unknown as ArrayBuffer);

    const ws = wb.worksheets[0];
    if (!ws) throw new AppError('VALIDATION_FAILED', 400, { reason: 'Файл пустой' });

    const headers: Record<string, number> = {};
    ws.getRow(1).eachCell((cell, colNumber) => {
      headers[String(cell.value ?? '').trim()] = colNumber;
    });

    if (!headers['_id']) {
      throw new AppError('VALIDATION_FAILED', 400, {
        reason: 'Отсутствует колонка _id. Используйте файл, выгруженный из CRM.',
      });
    }

    const result: ImportResult = {
      updated: 0,
      created: 0,
      failed: 0,
      unchanged: 0,
      deleted: 0,
      errors: [],
      newVersion: randomUUID(),
    };

    for (let rowNum = 2; rowNum <= ws.rowCount; rowNum++) {
      const row = ws.getRow(rowNum);
      const idCell = row.getCell(headers['_id']);
      const id = String(idCell.value ?? '').trim();

      const nonEmpty =
        Array.isArray(row.values) &&
        row.values.some((v) => v !== null && v !== undefined && v !== '');
      if (!nonEmpty) continue;

      if (!id) {
        result.errors.push({ row: rowNum, message: 'Нет _id — пропущено' });
        result.failed++;
        continue;
      }

      try {
        const update: Record<string, unknown> = {};
        const deleteCol = headers['_delete'];
        const deleteFlag = deleteCol
          ? String(row.getCell(deleteCol).value ?? '').trim().toLowerCase()
          : '';

        for (const field of EDITABLE_FIELDS[entity]) {
          const col = headers[FIELD_LABELS[field] ?? field];
          if (!col) continue;
          const rawValue = row.getCell(col).value;
          update[field] = this.deserializeValue(field, rawValue);
        }

        if (['да', 'yes', 'true', '1'].includes(deleteFlag)) {
          await this.deleteEntity(entity, id);
          result.deleted++;
          continue;
        }

        const existing = await this.loadEntityById(entity, id);
        if (!existing) {
          result.errors.push({ row: rowNum, message: `Запись ${id} не найдена` });
          result.failed++;
          continue;
        }

        // Правильное сравнение: snake_case → camelCase
        const hasChanges = Object.entries(update).some(([k, v]) => {
          const camel = this.snakeToCamel(k);
          return this.differs(existing[camel], v);
        });

        if (!hasChanges) {
          result.unchanged++;
          continue;
        }

        await this.updateEntity(entity, id, update, user);
        result.updated++;
      } catch (e) {
        result.errors.push({
          row: rowNum,
          message: e instanceof Error ? e.message : 'unknown',
        });
        result.failed++;
      }
    }

    return result;
  }

  // ============================================================
  // INTERNAL
  // ============================================================

  private static async loadRows(
    entity: string,
    filters: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    const where = { deletedAt: null, ...filters };
    switch (entity) {
      case 'universities':
        return (await prisma.university.findMany({ where, take: 10_000 })) as never;
      case 'tasks':
        return (await prisma.task.findMany({ where, take: 10_000 })) as never;
      case 'interactions':
        return (await prisma.interaction.findMany({ where, take: 10_000 })) as never;
      default:
        throw new AppError('VALIDATION_FAILED', 400, {
          reason: `entity=${entity} не поддерживается`,
        });
    }
  }

  private static async loadEntityById(
    entity: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    switch (entity) {
      case 'universities':
        return (await prisma.university.findUnique({ where: { id } })) as never;
      case 'tasks':
        return (await prisma.task.findUnique({ where: { id } })) as never;
      case 'interactions':
        return (await prisma.interaction.findUnique({ where: { id } })) as never;
      default:
        return null;
    }
  }

  private static async updateEntity(
    entity: string,
    id: string,
    update: Record<string, unknown>,
    user: AuthUser,
  ): Promise<void> {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(update)) {
      if (v === undefined) continue;
      const camel = this.snakeToCamel(k);

      if (
        (camel.endsWith('At') || camel.endsWith('Date')) &&
        typeof v === 'string' &&
        v
      ) {
        clean[camel] = new Date(v);
      } else if (camel === 'licenseSigned') {
        clean[camel] = Boolean(v);
      } else {
        clean[camel] = v;
      }
    }

    let saved: Record<string, unknown> | null = null;

    switch (entity) {
      case 'universities':
        saved = (await prisma.university.update({
          where: { id },
          data: clean as never,
        })) as never;
        break;
      case 'tasks':
        saved = (await prisma.task.update({
          where: { id },
          data: clean as never,
        })) as never;
        break;
      case 'interactions':
        saved = (await prisma.interaction.update({
          where: { id },
          data: clean as never,
        })) as never;
        break;
    }

    if (saved) {
      await VersionsService.save(
        entity,
        id,
        saved,
        { update: clean },
        { authorId: user.profileId, authorName: user.name, comment: 'Импорт из Excel' },
      );
    }
  }

  private static async deleteEntity(entity: string, id: string): Promise<void> {
    switch (entity) {
      case 'universities':
        await prisma.university.update({ where: { id }, data: { deletedAt: new Date() } });
        break;
      case 'tasks':
        await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
        break;
      case 'interactions':
        await prisma.interaction.update({ where: { id }, data: { deletedAt: new Date() } });
        break;
    }
  }

  private static serializeValue(v: unknown): unknown {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'boolean') return v ? 'да' : 'нет';
    if (typeof v === 'object' && v !== null && 'toNumber' in v) {
      return Number((v as { toNumber: () => number }).toNumber());
    }
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  }

  private static deserializeValue(field: string, raw: unknown): unknown {
    if (raw === null || raw === undefined) return '';
    if (typeof raw === 'object' && raw !== null && 'richText' in raw) {
      return (raw as { richText: { text: string }[] }).richText.map((r) => r.text).join('');
    }
    if (typeof raw === 'object' && raw !== null && 'text' in raw) {
      return String((raw as { text: string }).text);
    }
    if (typeof raw === 'object' && raw !== null && 'result' in raw) {
      return (raw as { result: unknown }).result;
    }
    const s = String(raw).trim();

    if (field === 'license_signed') {
      return ['да', 'yes', 'true', '1', 'on'].includes(s.toLowerCase());
    }
    if (field === 'contract_value' || field === 'amount') {
      const n = Number(s.replace(/[^\d.-]/g, ''));
      return isNaN(n) ? 0 : n;
    }
    if (
      field.endsWith('_date') ||
      field.endsWith('_at') ||
      field === 'due_date' ||
      field === 'license_expires_at'
    ) {
      return s || null;
    }
    return s;
  }

  private static differs(a: unknown, b: unknown): boolean {
    return this.normalize(a) !== this.normalize(b);
  }

  private static normalize(v: unknown): string {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'boolean') return v ? 'да' : 'нет';
    if (typeof v === 'object' && v !== null && 'toNumber' in v) {
      return String((v as { toNumber: () => number }).toNumber());
    }
    return String(v).trim();
  }

  private static snakeToCamel(s: string): string {
    return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  }

  private static columnWidth(field: string): number {
    if (field === 'notes' || field === 'description' || field === 'details') return 40;
    if (field === 'name' || field === 'title') return 30;
    if (field.includes('email')) return 28;
    return 18;
  }
}