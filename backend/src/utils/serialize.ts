/**
 * Рекурсивно преобразует camelCase ключи в snake_case.
 * Даты оставляет как ISO-строки.
 *
 * Зачем: frontend написан на snake_case (наследие Supabase),
 * а Prisma возвращает camelCase. Вместо правок фронта —
 * конвертируем ответ на выходе.
 *
 * ВАЖНО (даты): поля с типом `@db.Date` (interaction_date,
 * license_expires_at, due_date, expires_at и т.п.) Prisma
 * возвращает как `Date` с временем 00:00:00.000Z. Если сериализовать
 * их через `toISOString()`, получится "2026-02-05T00:00:00.000Z",
 * а фронт ожидает "2026-02-05" (см. `toISODate` в lib/calendar.ts).
 * Из-за этого сравнение ключей не срабатывает, и календарь остаётся
 * пустым. Здесь мы для «полуночных UTC-дат» отдаём только YYYY-MM-DD.
 *
 * ВАЖНО (Decimal): Prisma.Decimal — это объект из decimal.js с
 * внутренними полями `s`, `e`, `d` и методами. Если пропустить его
 * в ветку `typeof === 'object'`, `Object.entries` вытащит наружу
 * эти внутренние поля, включая функции, и `JSON.stringify` (или
 * `Prisma.json`) упадёт. Это ломало, в частности, `idempotency_keys.response`
 * (Json-колонка): middleware не мог сохранить закешированный ответ и
 * повторный POST создавал дубликат. Теперь Decimal распознаётся
 * отдельной проверкой и превращается в number.
 */

const CACHE: Record<string, string> = {};

function toSnake(key: string): string {
  if (CACHE[key]) return CACHE[key];
  const snake = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
  CACHE[key] = snake;
  return snake;
}

/**
 * Если Date пришёл как @db.Date (полночь UTC), отдаём только YYYY-MM-DD.
 * Иначе — полный ISO с временем и Z.
 *
 * Многие поля без времени (due_date, license_expires_at) хранятся как
 * @db.Date, поэтому ориентируемся именно на время 00:00:00.000Z.
 */
function serializeDate(value: Date): string {
  if (
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  ) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return value.toISOString();
}

/**
 * Определяем Prisma.Decimal по duck-typing:
 *  - есть методы toNumber / toFixed;
 *  - есть внутренние поля s, e, d (decimal.js).
 *
 * Проверять через `instanceof Prisma.Decimal` нельзя: клиентский код
 * не всегда импортирует тот же runtime-класс, что вернул Prisma.
 * Duck-typing работает в любом окружении.
 */
function isPrismaDecimal(value: unknown): value is {
  toNumber(): number;
  toFixed(digits?: number): string;
  toString(): string;
} {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.toNumber === 'function' &&
    typeof v.toFixed === 'function' &&
    's' in v &&
    'e' in v &&
    'd' in v
  );
}

export function toSnakeCase(value: unknown, seen = new WeakSet()): unknown {
  if (value === null || value === undefined) return value;

  // Date: сериализуем в ISO или YYYY-MM-DD
  if (value instanceof Date) return serializeDate(value);

  // Prisma.Decimal: превращаем в number.
  // Проверка идёт ДО `typeof === 'object'`, иначе Decimal уйдёт
  // в Object.entries и сломает Json-поля.
  if (isPrismaDecimal(value)) {
    return value.toNumber();
  }

  // Массивы: рекурсия по элементам
  if (Array.isArray(value)) {
    return value.map((v) => toSnakeCase(v, seen));
  }

  // BigInt → number (иначе JSON.stringify падает)
  if (typeof value === 'bigint') return Number(value);

  if (typeof value === 'object') {
    if (seen.has(value as object)) return value;
    seen.add(value as object);

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[toSnake(k)] = toSnakeCase(v, seen);
    }
    return out;
  }

  return value;
}