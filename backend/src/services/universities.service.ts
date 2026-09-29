// backend/src/services/universities.service.ts
import { prisma } from '../db/prisma.js';
import { WsService } from './ws.service.js';
import { VersionsService } from './versions.service.js';
import { AppError } from '../errors/codes.js';
import type { AuthUser } from '../middleware/auth.js';
import { buildScopeWhere } from '../middleware/auth.js';
import { SecurityService } from './security.service.js';
import {
  PiiService,
  UNIVERSITY_PII_FIELDS,
  CONTACT_PII_FIELDS,
} from './pii.service.js';

interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  manager?: string;
  managerId?: string;
  directionId?: string;
  productId?: string;
  vendorId?: string;
  handoverStatus?: string;
  tagId?: string;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'status' | 'contractValue';
  sortDir?: 'asc' | 'desc';
  skip: number;
  take: number;
  auth: AuthUser;
}

interface CreateData {
  name: string;
  city: string;
  direction: string;
  product: string;
  vendorId?: string | null;
  directionId?: string | null;
  productId?: string | null;
  managerId?: string | null;
  contractNumber?: string | null;
  licenseSigned?: boolean;
  licenseExpiresAt?: string | null;
  status: string;
  handoverStatus: string;
  manager?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  telegram?: string | null;
  whatsapp?: string | null;
  maxMessenger?: string | null;
  notes?: string | null;
  contractValue?: number;
}

type UpdateData = Partial<CreateData>;

interface BulkPayload {
  ids: string[];
  action: 'update_status' | 'assign_manager' | 'add_tag' | 'remove_tag' | 'soft_delete';
  status?: string;
  managerId?: string;
  manager?: string;
  tagId?: string;
}

export class UniversitiesService {
  // ============================================================
  // LIST
  // ============================================================
  static async list(params: ListParams) {
    const scopeWhere = buildScopeWhere(params.auth, 'universities');
    const includeDeleted = params.includeDeleted === true;
    const onlyDeleted = params.onlyDeleted === true;

    const where: Record<string, unknown> = {
      ...scopeWhere,
      ...(onlyDeleted
        ? { deletedAt: { not: null } }
        : includeDeleted
          ? {}
          : { deletedAt: null }),
    };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { city: { contains: params.search, mode: 'insensitive' } },
        { contactName: { contains: params.search, mode: 'insensitive' } },
        { contactEmail: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params.status) where.status = params.status;
    if (params.managerId) where.managerId = params.managerId;
    if (params.manager) where.manager = params.manager;
    if (params.directionId) where.directionId = params.directionId;
    if (params.productId) where.productId = params.productId;
    if (params.vendorId) where.vendorId = params.vendorId;
    if (params.handoverStatus) where.handoverStatus = params.handoverStatus;
    if (params.tagId) where.tags = { some: { tagId: params.tagId } };

    const sortBy = params.sortBy ?? 'createdAt';
    const sortDir = params.sortDir ?? 'desc';

    const [items, total] = await Promise.all([
      prisma.university.findMany({
        where,
        include: {
          vendor: true,
          directionRef: true,
          productRef: true,
          managerRef: true,
          tags: { include: { tag: true } },
          // NEW: последняя привязка к workflow — для канбана «Вузы»
          workflowLinks: {
            take: 1,
            orderBy: { updatedAt: 'desc' },
            select: { currentStepId: true, workflowId: true, status: true },
          },
        },
        orderBy: { [sortBy]: sortDir },
        skip: params.skip,
        take: params.take,
      }),
      prisma.university.count({ where }),
    ]);

    // Разворачиваем workflow-привязку + расшифровываем ПД
    const normalised = items.map((u) => {
      const decrypted = PiiService.decryptFields(u as unknown as Record<string, unknown>, [
        ...UNIVERSITY_PII_FIELDS,
      ]);

      return {
        ...decrypted,
        current_step_id: u.workflowLinks[0]?.currentStepId ?? null,
        current_workflow_id: u.workflowLinks[0]?.workflowId ?? null,
        workflowLinks: undefined,
      };
    });

    return { items: normalised, total };
  }

  // ============================================================
  // GET BY ID
  // ============================================================
  static async getById(id: string, auth: AuthUser) {
    const scopeWhere = buildScopeWhere(auth, 'universities');
    const item = await prisma.university.findFirst({
      where: { id, deletedAt: null, ...scopeWhere },
      include: {
        vendor: true,
        directionRef: true,
        productRef: true,
        managerRef: true,
        tags: { include: { tag: true } },
        contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        workflowLinks: {
          take: 1,
          orderBy: { updatedAt: 'desc' },
          select: { currentStepId: true, workflowId: true, status: true },
        },
      },
    });
    if (!item) throw new AppError('UNIVERSITY_NOT_FOUND', 404);

    const decrypted = PiiService.decryptFields(
      item as unknown as Record<string, unknown>,
      [...UNIVERSITY_PII_FIELDS],
    );

    // ── 152-ФЗ / ФСТЭК: фиксируем доступ к ПД
    void PiiService.logAccess({
      userId: auth.profileId,
      userEmail: auth.email,
      subjectId: item.id,
      entity: 'universities',
      fields: [...UNIVERSITY_PII_FIELDS],
      purpose: 'view',
    });

    // Контакты тоже расшифровываем (у них свои поля ПД)
    const contacts = Array.isArray((decrypted as Record<string, unknown>).contacts)
      ? ((decrypted as Record<string, unknown>).contacts as Record<string, unknown>[]).map((c) =>
          PiiService.decryptFields(c, [...CONTACT_PII_FIELDS]),
        )
      : (decrypted as Record<string, unknown>).contacts;

    // ── ФСТЭК: логируем также доступ к контактам, если они есть
    if (Array.isArray(contacts) && contacts.length > 0) {
      void PiiService.logAccess({
        userId: auth.profileId,
        userEmail: auth.email,
        subjectId: item.id,
        entity: 'university_contacts',
        fields: [...CONTACT_PII_FIELDS],
        purpose: 'view',
      });
    }

    return {
      ...decrypted,
      contacts,
      current_step_id: item.workflowLinks[0]?.currentStepId ?? null,
      current_workflow_id: item.workflowLinks[0]?.workflowId ?? null,
      workflowLinks: undefined,
    };
  }

  // ============================================================
  // CREATE
  // ============================================================
  static async create(data: CreateData, auth: AuthUser) {
    // Роль nam — всегда создаёт вуз на себя, чужие managerId игнорируем
    const managerName =
      auth.role === 'nam' ? auth.name : (data.manager ?? 'Анна Кузнецова');

    const item = await prisma.university.create({
      data: {
        name: data.name,
        city: data.city,
        direction: data.direction,
        product: data.product,
        vendorId: data.vendorId ?? null,
        directionId: data.directionId ?? null,
        productId: data.productId ?? null,
        managerId: data.managerId ?? null,
        contractNumber: data.contractNumber ?? null,
        licenseSigned: data.licenseSigned ?? false,
        licenseExpiresAt: data.licenseExpiresAt
          ? new Date(data.licenseExpiresAt)
          : null,
        status: data.status,
        handoverStatus: data.handoverStatus,
        manager: managerName,
        contactName: data.contactName ?? null,
        // ── 152-ФЗ: шифруем ПД перед сохранением
        contactEmail: PiiService.encrypt(data.contactEmail),
        contactPhone: PiiService.encrypt(data.contactPhone),
        telegram: PiiService.encrypt(data.telegram),
        whatsapp: PiiService.encrypt(data.whatsapp),
        maxMessenger: PiiService.encrypt(data.maxMessenger),
        notes: data.notes ?? null,
        contractValue: data.contractValue ?? 0,
        source: 'Вручную',
      },
    });

    // 🆕 Автоматически привязываем к default workflow + первый шаг
    await this.attachToDefaultWorkflow(item.id).catch(() => {});

    // 🆕 WS-нотификация
    WsService.broadcast({
      type: 'universities:created',
      entity: 'universities',
      entityId: item.id,
      actor: auth.email,
    });

    return item;
  }

  /**
   * Привязка нового вуза к workflow по умолчанию.
   * Если default workflow нет — молча выходим.
   */
  private static async attachToDefaultWorkflow(universityId: string) {
    const wf = await prisma.workflow.findFirst({
      where: { isDefault: true, deletedAt: null },
      include: { steps: { orderBy: { stepOrder: 'asc' }, take: 1 } },
    });
    if (!wf || wf.steps.length === 0) return;

    await prisma.workflowUniversity.create({
      data: {
        workflowId: wf.id,
        universityId,
        currentStepId: wf.steps[0].id,
        status: 'В работе',
      },
    });
  }

  /**
   * Резолвит строковые значения из Excel в id-шники каталогов.
   *
   * Если сущность с таким именем уже есть — берём её id.
   * Если нет — создаём (для вендоров/направлений/продуктов это
   * ожидаемое поведение при первом импорте; ТЗ п.4.1 говорит
   * «каталоги … имеют возможность актуализироваться за счёт подгрузки»).
   *
   * Возвращает объект с id-шниками. Любое из полей может быть null,
   * если исходное имя пустое.
   */
  static async resolveCatalogsByName(input: {
    vendorName?: string | null;
    directionName?: string | null;
    productName?: string | null;
  }): Promise<{
    vendorId: string | null;
    directionId: string | null;
    productId: string | null;
  }> {
    const out: {
      vendorId: string | null;
      directionId: string | null;
      productId: string | null;
    } = {
      vendorId: null,
      directionId: null,
      productId: null,
    };

    // ─── Vendor ─────────────────────────────────────────
    const vendorName = input.vendorName?.trim();
    if (vendorName) {
      const existing = await prisma.vendor.findFirst({
        where: { name: vendorName },
        select: { id: true },
      });
      if (existing) {
        out.vendorId = existing.id;
      } else {
        const created = await prisma.vendor
          .create({
            data: { name: vendorName },
            select: { id: true },
          })
          .catch(() => null);
        out.vendorId = created?.id ?? null;
      }
    }

    // ─── Direction ──────────────────────────────────────
    const directionName = input.directionName?.trim();
    if (directionName) {
      const existing = await prisma.itDirection.findFirst({
        where: { name: directionName },
        select: { id: true },
      });
      if (existing) {
        out.directionId = existing.id;
      } else {
        const created = await prisma.itDirection
          .create({
            data: { name: directionName, sortOrder: 100 },
            select: { id: true },
          })
          .catch(() => null);
        out.directionId = created?.id ?? null;
      }
    }

    // ─── Product ────────────────────────────────────────
    const productName = input.productName?.trim();
    if (productName) {
      const existing = await prisma.itProduct.findFirst({
        where: { name: productName },
        select: { id: true, vendorId: true },
      });
      if (existing) {
        out.productId = existing.id;
        // Если у продукта ещё нет вендора, а мы знаем — привяжем
        if (out.vendorId && !existing.vendorId) {
          await prisma.itProduct
            .update({
              where: { id: existing.id },
              data: { vendorId: out.vendorId },
            })
            .catch(() => {});
        }
      } else {
        const created = await prisma.itProduct
          .create({
            data: {
              name: productName,
              vendorId: out.vendorId,
              sortOrder: 100,
            },
            select: { id: true },
          })
          .catch(() => null);
        out.productId = created?.id ?? null;
      }
    }

    return out;
  }

  // ============================================================
  // UPDATE
  // ============================================================
  static async update(id: string, data: UpdateData, auth: AuthUser) {
    const scopeWhere = buildScopeWhere(auth, 'universities');
    const before = await prisma.university.findFirst({
      where: { id, deletedAt: null, ...scopeWhere },
    });
    if (!before) throw new AppError('UNIVERSITY_NOT_FOUND', 404);

    // ── Разграничение прав на «ответственного» (ТЗ п.4.11).
    //
    // Только admin и manager могут менять ответственного за вуз.
    // Роль nam — не может, ни через managerId, ни через строку manager.
    //
    // ВАЖНО: раньше проверка была ТОЛЬКО на managerId. Поле `manager`
    // (строка) оставалось незащищённым — через него можно было
    // фактически передать вуз себе, указав manager = своё имя.
    // Теперь проверяем оба поля одновременно.
    if (auth.role === 'nam') {
      const triesManagerId =
        data.managerId !== undefined && data.managerId !== before.managerId;
      const triesManagerName =
        data.manager !== undefined && data.manager !== before.manager;
      if (triesManagerId || triesManagerName) {
        throw new AppError('CANNOT_ASSIGN_MANAGER', 403);
      }
    }

    // ── manager может редактировать только «свои» вузы
    //    (по managerId или по строке manager).
    //
    // Исключение — если у него есть user_scope, разрешающий шире
    // (например, «все вузы региона»). Проверяется через buildScopeWhere.
    if (auth.role === 'manager') {
      const ownedByManagerId = before.managerId
        ? await prisma.manager.findFirst({
            where: {
              id: before.managerId,
              profileId: auth.profileId ?? undefined,
            },
            select: { id: true },
          })
        : null;
      const ownedByName = before.manager === auth.name;

      if (!ownedByManagerId && !ownedByName) {
        // Проверим расширенный scope — вдруг ему разрешено больше
        const explicitScope = (auth.scopes ?? {})['universities'];
        if (!explicitScope || Object.keys(explicitScope).length === 0) {
          throw new AppError('ROLE_NOT_ALLOWED', 403, {
            reason: 'Можно редактировать только закреплённые за вами вузы',
          });
        }
      }
    }

    const item = await prisma.university.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.city !== undefined ? { city: data.city } : {}),
        ...(data.direction !== undefined ? { direction: data.direction } : {}),
        ...(data.product !== undefined ? { product: data.product } : {}),
        ...(data.vendorId !== undefined ? { vendorId: data.vendorId } : {}),
        ...(data.directionId !== undefined ? { directionId: data.directionId } : {}),
        ...(data.productId !== undefined ? { productId: data.productId } : {}),
        ...(data.managerId !== undefined ? { managerId: data.managerId } : {}),
        ...(data.contractNumber !== undefined ? { contractNumber: data.contractNumber } : {}),
        ...(data.licenseSigned !== undefined ? { licenseSigned: data.licenseSigned } : {}),
        ...(data.licenseExpiresAt !== undefined
          ? {
              licenseExpiresAt: data.licenseExpiresAt
                ? new Date(data.licenseExpiresAt)
                : null,
            }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.handoverStatus !== undefined ? { handoverStatus: data.handoverStatus } : {}),
        ...(data.manager !== undefined ? { manager: data.manager } : {}),
        ...(data.contactName !== undefined ? { contactName: data.contactName } : {}),
        // ── 152-ФЗ: шифруем изменяемые ПД
        ...(data.contactEmail !== undefined
          ? { contactEmail: PiiService.encrypt(data.contactEmail) }
          : {}),
        ...(data.contactPhone !== undefined
          ? { contactPhone: PiiService.encrypt(data.contactPhone) }
          : {}),
        ...(data.telegram !== undefined
          ? { telegram: PiiService.encrypt(data.telegram) }
          : {}),
        ...(data.whatsapp !== undefined
          ? { whatsapp: PiiService.encrypt(data.whatsapp) }
          : {}),
        ...(data.maxMessenger !== undefined
          ? { maxMessenger: PiiService.encrypt(data.maxMessenger) }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.contractValue !== undefined ? { contractValue: data.contractValue } : {}),
      },
    });

    // Сохраняем версию для истории
    await VersionsService.save(
      'universities',
      item.id,
      item as unknown as Record<string, unknown>,
      { before, after: item } as unknown as Record<string, unknown>,
      {
        authorId: auth.profileId,
        authorName: auth.name,
        comment: 'Обновление карточки',
      },
    ).catch(() => {});

    // 🆕 WS-нотификация: клиенты с открытой карточкой обновят данные
    WsService.broadcast({
      type: 'universities:updated',
      entity: 'universities',
      entityId: item.id,
      actor: auth.email,
      scopeUniversityId: item.id,
      payload: { changed: Object.keys(data) },
    });

    return item;
  }

  // ============================================================
  // SOFT DELETE
  // ============================================================
  static async softDelete(id: string, auth: AuthUser) {
    const scopeWhere = buildScopeWhere(auth, 'universities');
    const existing = await prisma.university.findFirst({
      where: { id, deletedAt: null, ...scopeWhere },
    });
    if (!existing) throw new AppError('UNIVERSITY_NOT_FOUND', 404);

    // ── manager может удалять только свои вузы (ТЗ п.4.11).
    //    Это доп. проверка поверх permission 'universities.delete':
    //    если он попытается удалить чужой вуз — 403.
    if (auth.role === 'manager') {
      const ownedByManagerId = existing.managerId
        ? await prisma.manager.findFirst({
            where: {
              id: existing.managerId,
              profileId: auth.profileId ?? undefined,
            },
            select: { id: true },
          })
        : null;
      const ownedByName = existing.manager === auth.name;

      if (!ownedByManagerId && !ownedByName) {
        const explicitScope = (auth.scopes ?? {})['universities'];
        if (!explicitScope || Object.keys(explicitScope).length === 0) {
          throw new AppError('ROLE_NOT_ALLOWED', 403, {
            reason: 'Можно удалять только закреплённые за вами вузы',
          });
        }
      }
    }

    await prisma.university.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.profileId,
        userEmail: auth.email,
        entity: 'universities',
        entityId: id,
        action: 'delete',
        before: existing as never,
        after: null as never,
      },
    }).catch(() => {});

    // 🆕 WS-нотификация
    WsService.broadcast({
      type: 'universities:deleted',
      entity: 'universities',
      entityId: id,
      actor: auth.email,
    });
  }

  // ============================================================
  // BULK
  // ============================================================
  static async bulk(payload: BulkPayload, auth: AuthUser) {
    const { ids, action } = payload;
    if (ids.length === 0) return { affected: 0, action };

    const scopeWhere = buildScopeWhere(auth, 'universities');

    // ── Все массовые операции проверяем на scope.
    //    Для manager'а дополнительно фильтруем по его вузам:
    //    либо через managerRef.profileId, либо через строку manager.
    let managerFilter: Record<string, unknown> = {};
    if (auth.role === 'manager') {
      const explicitScope = (auth.scopes ?? {})['universities'];
      const hasExplicitScope =
        explicitScope && Object.keys(explicitScope).length > 0;

      if (!hasExplicitScope) {
        managerFilter = {
          OR: [
            { managerRef: { profileId: auth.profileId ?? '__none__' } },
            { manager: auth.name },
          ],
        };
      }
    }

    const accessible = await prisma.university.findMany({
      where: {
        id: { in: ids },
        ...scopeWhere,
        ...managerFilter,
      },
      select: { id: true, status: true, managerId: true, manager: true },
    });
    const accessibleIds = accessible.map((u) => u.id);

    // Если часть ids отфильтрована — это сигнал о попытке выйти за scope.
    // Для nam и manager возвращаем 403, чтобы дыра не была «тихой».
    // Пишем событие — это подозрительная активность.
    if (
      (auth.role === 'nam' || auth.role === 'manager') &&
      accessibleIds.length < ids.length
    ) {
      void SecurityService.log({
        eventType: 'suspicious_bulk_attempt',
        severity: 'warning',
        userId: auth.profileId,
        email: auth.email,
        details: {
          action,
          role: auth.role,
          requestedIds: ids.length,
          accessibleIds: accessibleIds.length,
          rejectedIds: ids.filter((id) => !accessibleIds.includes(id)).slice(0, 20),
        },
      });

      throw new AppError('ROLE_NOT_ALLOWED', 403, {
        reason: 'Некоторые вузы не принадлежат вам',
        requested: ids.length,
        accessible: accessibleIds.length,
      });
    }

    if (accessibleIds.length === 0) {
      return { affected: 0, action };
    }

    let affected = 0;

    switch (action) {
      case 'update_status': {
        if (!payload.status) throw new AppError('VALIDATION_FAILED', 400);
        const r = await prisma.university.updateMany({
          where: { id: { in: accessibleIds } },
          data: { status: payload.status },
        });
        affected = r.count;
        break;
      }

      case 'assign_manager': {
        if (!payload.managerId) throw new AppError('VALIDATION_FAILED', 400);
        if (auth.role === 'nam') throw new AppError('CANNOT_ASSIGN_MANAGER', 403);

        const toManager = await prisma.manager.findUnique({
          where: { id: payload.managerId },
          select: { id: true, fullName: true, active: true },
        });
        if (!toManager) throw new AppError('NOT_FOUND', 404);
        if (!toManager.active) throw new AppError('STATE_CONFLICT', 409);

        const r = await prisma.university.updateMany({
          where: { id: { in: accessibleIds } },
          data: { managerId: toManager.id, manager: toManager.fullName },
        });
        affected = r.count;
        break;
      }

      case 'add_tag': {
        if (!payload.tagId) throw new AppError('VALIDATION_FAILED', 400);
        await prisma.universityTag.createMany({
          data: accessibleIds.map((universityId) => ({
            universityId,
            tagId: payload.tagId!,
          })),
          skipDuplicates: true,
        });
        affected = accessibleIds.length;
        break;
      }

      case 'remove_tag': {
        if (!payload.tagId) throw new AppError('VALIDATION_FAILED', 400);
        const r = await prisma.universityTag.deleteMany({
          where: {
            universityId: { in: accessibleIds },
            tagId: payload.tagId,
          },
        });
        affected = r.count;
        break;
      }

      case 'soft_delete': {
        const r = await prisma.university.updateMany({
          where: { id: { in: accessibleIds } },
          data: { deletedAt: new Date() },
        });
        affected = r.count;
        break;
      }
    }

    // 🆕 WS-нотификация — один broadcast на всю пачку
    WsService.broadcast({
      type: 'universities:bulk-changed',
      entity: 'universities',
      entityId: null,
      actor: auth.email,
      payload: { action, count: affected, ids: accessibleIds.slice(0, 50) },
    });

    return { affected, action };
  }

  // ============================================================
  // CONTACTS
  // ============================================================
  static async listContacts(universityId: string) {
    const items = await prisma.universityContact.findMany({
      where: { universityId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    return items.map((c) =>
      PiiService.decryptFields(c as unknown as Record<string, unknown>, [
        ...CONTACT_PII_FIELDS,
      ]),
    );
  }

  static async addContact(
    universityId: string,
    data: {
      fullName: string;
      role?: string | null;
      email?: string | null;
      phone?: string | null;
      telegram?: string | null;
      whatsapp?: string | null;
      isPrimary?: boolean;
      notes?: string | null;
    },
  ) {
    // Если это первый контакт — делаем его основным
    const count = await prisma.universityContact.count({ where: { universityId } });
    const isPrimary = data.isPrimary ?? count === 0;

    if (isPrimary) {
      await prisma.universityContact.updateMany({
        where: { universityId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return prisma.universityContact.create({
      data: {
        universityId,
        fullName: data.fullName,
        role: data.role ?? null,
        email: PiiService.encrypt(data.email),
        phone: PiiService.encrypt(data.phone),
        telegram: PiiService.encrypt(data.telegram),
        whatsapp: PiiService.encrypt(data.whatsapp),
        isPrimary,
        notes: data.notes ?? null,
      },
    });
  }

  static async updateContact(
    contactId: string,
    data: Partial<{
      fullName: string;
      role: string | null;
      email: string | null;
      phone: string | null;
      telegram: string | null;
      whatsapp: string | null;
      isPrimary: boolean;
      notes: string | null;
    }>,
  ) {
    const existing = await prisma.universityContact.findUnique({
      where: { id: contactId },
      select: { universityId: true },
    });
    if (!existing) throw new AppError('NOT_FOUND', 404);

    if (data.isPrimary === true) {
      await prisma.universityContact.updateMany({
        where: { universityId: existing.universityId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return prisma.universityContact.update({
      where: { id: contactId },
      data: {
        ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.email !== undefined ? { email: PiiService.encrypt(data.email) } : {}),
        ...(data.phone !== undefined ? { phone: PiiService.encrypt(data.phone) } : {}),
        ...(data.telegram !== undefined ? { telegram: PiiService.encrypt(data.telegram) } : {}),
        ...(data.whatsapp !== undefined ? { whatsapp: PiiService.encrypt(data.whatsapp) } : {}),
        ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
  }

  static async deleteContact(contactId: string) {
    await prisma.universityContact.delete({ where: { id: contactId } });
  }

  // ============================================================
  // DOCUMENTS
  // ============================================================
  static async listDocuments(universityId: string) {
    return prisma.document.findMany({
      where: { universityId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }
}