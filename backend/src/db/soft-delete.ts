/**
 * Soft-delete extension.
 *
 * Что делает:
 *   - В `findMany` / `findFirst` / `findFirstOrThrow` / `count` / `aggregate` / `groupBy`
 *     автоматически добавляет фильтр `deletedAt: null`, если пользователь явно
 *     не попросил обратного через `__includeDeleted: true`.
 *   - `findUnique` / `findUniqueOrThrow` — вызывает оригинал, потом проверяет
 *     результат: если запись помечена удалённой и не запрошен `__includeDeleted` —
 *     возвращает `null` (для findUniqueOrThrow — бросает ошибку).
 *
 * Что НЕ делает (специально):
 *   - НЕ превращает `delete` в `update { deletedAt: now }`.
 *     Это делается явно в сервисах через `update`. Так extension остаётся
 *     предсказуемым и не ломает hard-delete в purge.
 *
 * Использование флага:
 *   prisma.university.findMany({ where: { ... }, __includeDeleted: true })
 */

export const SOFT_DELETE_MODELS = new Set([
  'University',
  'Interaction',
  'Task',
  'Workflow',
  'Contract',
  'KbArticle',
  'Comment',
  'Integration',
  'AutomationRule',
]);

export function softDeleteExtension() {
  return {
    name: 'softDelete',
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string | undefined;
          operation: string;
          args: Record<string, unknown> & { where?: Record<string, unknown> };
          query: (args: unknown) => Promise<unknown>;
        }) {
          if (!model || !SOFT_DELETE_MODELS.has(model)) {
            return query(args);
          }

          const a = args;
          const includeDeleted = a.__includeDeleted === true;
          if (includeDeleted) {
            delete a.__includeDeleted;
          }

          switch (operation) {
            case 'findMany':
            case 'findFirst':
            case 'findFirstOrThrow':
            case 'count':
            case 'aggregate':
            case 'groupBy': {
              if (!includeDeleted) {
                a.where = { ...(a.where ?? {}), deletedAt: null };
              }
              return query(a);
            }

            case 'findUnique':
            case 'findUniqueOrThrow': {
              const res = (await query(a)) as { deletedAt?: unknown } | null;
              if (!includeDeleted && res && res.deletedAt) {
                if (operation === 'findUniqueOrThrow') {
                  throw new Error(`No ${model} found`);
                }
                return null;
              }
              return res;
            }

            // delete / deleteMany НЕ перехватываем — пусть работает как есть.
            // Soft delete в сервисах — явным update.
            default:
              return query(a);
          }
        },
      },
    },
  } as const;
}