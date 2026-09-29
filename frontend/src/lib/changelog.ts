/**
 * Changelog + версия релиза.
 *
 * При обновлении приложения (новая версия фронтенда) показываем попап
 * один раз — до тех пор, пока пользователь не нажмёт «Понятно».
 *
 * Определение «что показать»: сравниваем APP_VERSION с localStorage.
 * Если у пользователя сохранена более старая версия — показываем новые
 * записи. Для новых пользователей — показываем всё.
 */

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: { type: 'feat' | 'fix' | 'improvement'; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.1.0',
    date: '2026-02-05',
    changes: [
      { type: 'feat', text: 'Кастомные роли и permissions' },
      { type: 'feat', text: 'Drag-n-drop в недельном календаре' },
      { type: 'feat', text: 'Голосовой ввод комментариев' },
      { type: 'feat', text: 'Импорт контактов из Excel' },
      { type: 'feat', text: 'Мультивалютные договоры' },
      { type: 'improvement', text: 'Поиск теперь находит документы' },
      { type: 'improvement', text: 'Undo/Redo и расширенные шорткаты' },
      { type: 'fix', text: 'Правильная обработка задач с пустой датой' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-01-15',
    changes: [
      { type: 'feat', text: 'Первый публичный релиз' },
    ],
  },
];

const STORAGE_KEY = 'crm:last-seen-version';

/** Текущая версия приложения */
export function currentVersion(): string {
  return import.meta.env.VITE_APP_VERSION ?? '1.0.0';
}

/**
 * Вернуть список записей, которые ещё не показывали пользователю.
 * Возвращает [] если ничего нового.
 */
export function unseenEntries(): ChangelogEntry[] {
  const lastSeen = (() => {
    try { return localStorage.getItem(STORAGE_KEY); }
    catch { return null; }
  })();

  if (!lastSeen) {
    // Первый запуск — показываем только текущую версию, чтобы не пугать
    return CHANGELOG.filter((e) => e.version === currentVersion());
  }

  return CHANGELOG.filter((e) => compareVersions(e.version, lastSeen) > 0);
}

/** Запомнить, что пользователь видел текущую версию. */
export function markVersionSeen(): void {
  try { localStorage.setItem(STORAGE_KEY, currentVersion()); }
  catch { /* ignore */ }
}

/** Сравнение semver-подобных строк. a > b → 1, a < b → -1, равно → 0 */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}