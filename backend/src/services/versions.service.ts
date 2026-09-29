import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';

interface VersionContext {
  authorId: string | null;
  authorName: string | null;
  comment?: string;
}

/**
 * Сервис версионирования сущностей.
 *
 * Что делает:
 * - Пишет снапшот сущности на каждой мутации (snapshot = полный объект)
 * - Хранит отдельно diff (changes = { before, after } или структурированное)
 * - Нумерует версии 1, 2, 3, … последовательно для каждой (entity, entityId)
 * - Никогда не падает — версионирование не должно ломать основной запрос
 *
 * Где используется:
 * - UniversitiesService (create, update, bulk)
 * - Tasks (create, update)
 * - Interactions (update)
 * - Contracts (update, sign, approvals)
 * - ExcelSyncService.import
 * - Контроллеры передачи: transferUniversity, transferTask
 *
 * Где хранится:
 * - Таблица entity_versions (см. schema.prisma)
 * - Поля: entity, entityId, version, snapshot (JSONB), changes (JSONB),
 *         authorId, authorName, comment, createdAt
 * - Уникальный индекс (entity, entityId, version)
 */
export class VersionsService {
  /**
   * Сохранить новую версию сущности.
   *
   * Идемпотентно: если entityId пустой — выходим (защита от дурака).
   * Автоматически увеличивает номер версии.
   *
   * @param entity — 'universities' | 'tasks' | 'interactions' | 'contracts' | …
   * @param entityId — uuid сущности
   * @param snapshot — полный объект после мутации (что сохраняем)
   * @param changes — diff или метаданные (before/after/reason)
   * @param ctx — кто и почему
   */
  static async save(
    entity: string,
    entityId: string,
    snapshot: Record<string, unknown>,
    changes: Record<string, unknown>,
    ctx: VersionContext,
  ): Promise<void> {
    if (!entityId) return; // защита от дурака

    try {
      const last = await prisma.entityVersion.findFirst({
        where: { entity, entityId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const nextVersion = (last?.version ?? 0) + 1;

      await prisma.entityVersion.create({
        data: {
          entity,
          entityId,
          version: nextVersion,
          snapshot: snapshot as never,
          changes: changes as never,
          authorId: ctx.authorId,
          authorName: ctx.authorName,
          comment: ctx.comment ?? null,
        },
      });
    } catch (e) {
      // Не ломаем основной запрос — версия не критична
      logger.warn({ err: e, entity, entityId }, 'Не удалось сохранить версию');
    }
  }

  /**
   * Список версий сущности (метаданные, без snapshot).
   * Для UI-панели «История».
   */
  static async list(
    entity: string,
    entityId: string,
    limit = 50,
  ): Promise<Array<{
    id: number;
    version: number;
    authorId: string | null;
    authorName: string | null;
    comment: string | null;
    createdAt: Date;
    changes: unknown;
  }>> {
    return prisma.entityVersion.findMany({
      where: { entity, entityId },
      orderBy: { version: 'desc' },
      take: limit,
      select: {
        id: true,
        version: true,
        authorId: true,
        authorName: true,
        comment: true,
        createdAt: true,
        changes: true,
      },
    });
  }

  /**
   * Одна версия целиком (со snapshot).
   */
  static async get(
    entity: string,
    entityId: string,
    version: number,
  ): Promise<{
    id: number;
    entity: string;
    entityId: string;
    version: number;
    snapshot: unknown;
    changes: unknown;
    authorId: string | null;
    authorName: string | null;
    comment: string | null;
    createdAt: Date;
  } | null> {
    return prisma.entityVersion.findUnique({
      where: { entity_entityId_version: { entity, entityId, version } },
    });
  }

  /**
   * Diff двух версий: поля, которые отличаются.
   *
   * Не использует `diff`-библиотеку — сравнивает поля верхнего уровня
   * через `JSON.stringify`. Для вложенных объектов даст «всё изменилось»,
   * но для наших сущностей (плоские) — этого достаточно.
   *
   * Игнорирует служебные поля updatedAt / updated_at / createdAt,
   * чтобы не считать «просто сохранение» за изменение.
   */
  static async diff(
    entity: string,
    entityId: string,
    fromVersion: number,
    toVersion: number,
  ): Promise<{
    fromVersion: number;
    toVersion: number;
    changes: { field: string; before: unknown; after: unknown }[];
  } | null> {
    const [from, to] = await Promise.all([
      this.get(entity, entityId, fromVersion),
      this.get(entity, entityId, toVersion),
    ]);
    if (!from || !to) return null;

    const fromSnap = (from.snapshot ?? {}) as Record<string, unknown>;
    const toSnap = (to.snapshot ?? {}) as Record<string, unknown>;

    const result: { field: string; before: unknown; after: unknown }[] = [];
    const keys = new Set([...Object.keys(fromSnap), ...Object.keys(toSnap)]);

    for (const k of keys) {
      // Пропускаем служебные — они меняются при любом сохранении
      if (
        k === 'updatedAt' ||
        k === 'updated_at' ||
        k === 'createdAt' ||
        k === 'created_at'
      ) {
        continue;
      }

      if (JSON.stringify(fromSnap[k]) !== JSON.stringify(toSnap[k])) {
        result.push({
          field: k,
          before: fromSnap[k] ?? null,
          after: toSnap[k] ?? null,
        });
      }
    }

    return { fromVersion, toVersion, changes: result };
  }

  /**
   * Получить снапшот версии — для отката.
   *
   * ВАЖНО: сам откат делает вызывающий сервис через обычный update,
   * VersionsService только отдаёт данные. Это защищает от каскадных
   * откатов и позволяет проверить права/scope перед применением.
   */
  static async rollback(
    entity: string,
    entityId: string,
    version: number,
  ): Promise<Record<string, unknown> | null> {
    const v = await this.get(entity, entityId, version);
    if (!v) return null;
    return v.snapshot as Record<string, unknown>;
  }
}