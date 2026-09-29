// backend/prisma/seed.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================
// KB_GUIDES — временный массив «руководств».
//
// Исторически эти гайды лежали в ./kb-content.ts, но файл
// отсутствует в репозитории. Чтобы seed оставался рабочим и
// KB не была пустой, объявляем массив прямо здесь.
//
// Когда восстановишь prisma/kb-content.ts — удали этот массив
// и раскомментируй импорт:
import { KB_GUIDES } from './kb-content.js';
// ============================================================
const KB_GUIDES: {
  slug: string;
  categorySlug: string;
  title: string;
  excerpt?: string;
  content: string;
  pinned?: boolean;
  tags?: string[];
}[] = [
  {
    slug: 'user-guide-first-steps',
    categorySlug: 'user-guide',
    title: 'Руководство пользователя: первые шаги',
    excerpt: 'Что нужно знать перед началом работы',
    content: `# Первые шаги в CRM

## Вход в систему

1. Откройте адрес CRM в браузере
2. Нажмите «Войти через SSO»
3. Введите корпоративные учётные данные Keycloak

## Рабочий стол

После входа вы попадаете на дашборд. Он показывает:

- Ключевые показатели (KPI)
- Последнюю активность по вузам
- Срочные задачи
- Workflow в работе

## Быстрые клавиши

- \`⌘K\` / \`Ctrl+K\` — поиск по всей базе
- \`/\` — поиск
- \`g u\` — перейти в раздел «Вузы»
- \`n u\` — создать новый вуз
- \`?\` / \`F1\` — справка

## Что дальше

Перейдите в раздел **Вузы** и добавьте первую карточку.`,
    tags: ['старт', 'онбординг'],
  },
  {
    slug: 'admin-guide-security',
    categorySlug: 'admin-guide',
    title: 'Руководство администратора: безопасность',
    excerpt: 'Настройка прав, IP-фильтр, аудит',
    content: `# Безопасность системы

## Роли и права

В системе три базовые роли Keycloak:

- **admin** — полный доступ, управление пользователями и настройками
- **manager** — работа с данными, назначение ответственных
- **nam** — менеджер по вузам, работа со своими карточками

Дополнительно можно создавать **кастомные роли** (раздел «Роли») с точечными permission'ами.

## IP-whitelist

Раздел **Безопасность → IP-доступ**:

- Пустой список — доступ разрешён со всех IP
- Есть хотя бы один CIDR — доступ только с этих диапазонов

## Аудит

Раздел **Журнал** логирует все изменения:

- Кто изменил
- Что было до и после (before/after)
- Когда

Логи хранятся в таблице \`audit_log\`.

## 152-ФЗ

См. раздел **Безопасность → Персональные данные**:

- Экспорт ПД по email субъекта
- Удаление (анонимизация) ПД
- Журнал согласий`,
    tags: ['безопасность', '152-ФЗ'],
  },
  {
    slug: 'architecture-152fz',
    categorySlug: 'architecture',
    title: 'Соответствие 152-ФЗ и ФСТЭК №117',
    excerpt: 'Как система защищает персональные данные',
    content: `# Защита персональных данных

## Что относится к ПД

В системе хранятся:

- ФИО контактных лиц вузов
- Email, телефоны
- Мессенджеры (Telegram, WhatsApp, MAX)

## Меры защиты

### 1. Шифрование на уровне БД

Поля \`contact_email\` и \`contact_phone\` в таблице \`universities\` **шифруются**, если задан \`PII_KEY\` (≥ 32 символа). Ключ — переменная окружения на бэкенде, не попадает в БД.

### 2. Разграничение доступа

- Базовые роли: admin / manager / nam
- Кастомные роли с permission'ами
- User scopes — фильтры, ограничивающие видимость данных
- IP-whitelist

### 3. Аудит

Все изменения сущностей логируются в \`audit_log\` через триггер БД. Включены поля \`before\` и \`after\`.

### 4. Права субъектов ПД

Раздел «Безопасность → Персональные данные»:

- **Экспорт** всех данных по email — JSON-файл
- **Удаление (анонимизация)** — необратимо
- **Журнал согласий** (\`pd_consents\`) — кто, когда, на что дал согласие

### 5. Отзыв согласия

Раздел **Безопасность → Журнал согласий** → кнопка «Отозвать» на активном согласии.

## Резервное копирование

Раздел **Бэкапы** — экспорт JSON всех таблиц, восстановление из файла.`,
    tags: ['152-ФЗ', 'ФСТЭК', 'архитектура'],
  },
];

// ============================================================
// Хелперы
// ============================================================

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

const rng = makeRng(20260916);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAhead(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ============================================================
// Справочники
// ============================================================

const CITIES = [
  'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
  'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
  'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград',
  'Краснодар', 'Саратов', 'Тюмень', 'Ижевск', 'Барнаул',
  'Ульяновск', 'Иркутск', 'Хабаровск', 'Ярославль', 'Владивосток',
  'Томск', 'Оренбург', 'Рязань', 'Тула', 'Сочи',
] as const;

const UNIVERSITIES = [
  'МГУ им. М.В. Ломоносова', 'МФТИ', 'ИТМО', 'ВШЭ', 'МГТУ им. Баумана',
  'СПбГУ', 'НГУ', 'УрФУ', 'КФУ', 'ННГУ им. Лобачевского',
  'ЮУрГУ', 'СамГУ', 'ОмГУ', 'ЮФУ', 'БашГУ',
  'СФУ', 'ВГУ', 'ПГНИУ', 'ВолгГТУ', 'КубГУ',
  'СГУ им. Чернышевского', 'ТюмГУ', 'УдГУ', 'АлтГУ', 'УлГУ',
  'ИГУ', 'ТОГУ', 'ЯрГУ', 'ДВФУ', 'ТГУ',
] as const;

const DIRECTIONS = [
  'Разработка', 'DevOps', 'QA', 'Аналитика данных', 'Информационная безопасность',
] as const;

const PRODUCTS = [
  'Ростелеком DataLab', 'ИТ-платформа Практикум', 'Ростелеком Security Lab',
] as const;

const HANDOVER = ['Не передан', 'Передан частично', 'Передан полностью', 'Отозван'] as const;
const INTERACTION_TYPES = ['Звонок', 'Встреча', 'Письмо', 'Документ'] as const;
const TASK_PRIORITIES = ['Низкий', 'Средний', 'Высокий', 'Срочный'] as const;
const CONTACT_ROLES = [
  'Заведующий кафедрой', 'Декан факультета',
  'Проректор по учебной работе', 'Координатор программы',
] as const;

const FIRST_NAMES_M = ['Иван', 'Пётр', 'Александр', 'Дмитрий', 'Сергей'];
const FIRST_NAMES_F = ['Елена', 'Ольга', 'Анна', 'Мария', 'Татьяна'];
const LAST_NAMES_M = ['Иванов', 'Петров', 'Смирнов', 'Кузнецов', 'Соколов'];
const LAST_NAMES_F = ['Иванова', 'Петрова', 'Смирнова', 'Кузнецова', 'Соколова'];

function randomPerson(): string {
  const isMale = rng() > 0.5;
  const first = pick(isMale ? FIRST_NAMES_M : FIRST_NAMES_F);
  const last = pick(isMale ? LAST_NAMES_M : LAST_NAMES_F);
  return `${last} ${first}`;
}

function randomEmail(name: string): string {
  const translit: Record<string, string> = {
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',
    к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
    х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',' ':'.',
  };
  const slug = name.toLowerCase().split('').map((c) => translit[c] ?? c).join('');
  return `${slug}@${pick(['mipt.ru', 'hse.ru', 'itmo.ru', 'msu.ru', 'sfu.ru'])}`;
}

function randomPhone(): string {
  return `+7 ${randInt(900, 999)} ${randInt(100, 999)}-${String(randInt(0, 99)).padStart(2, '0')}-${String(randInt(0, 99)).padStart(2, '0')}`;
}

// ============================================================
// 1. Каталоги
// ============================================================

async function seedVendors() {
  const items = [
    { name: 'Ростелеком', description: 'Российский интегратор' },
    { name: 'Яндекс', description: 'Яндекс.Облако' },
    { name: 'Сбер', description: 'СберТех, GigaChat' },
    { name: '1С', description: '1С:Предприятие' },
  ];
  for (const it of items) {
    await prisma.vendor.upsert({ where: { name: it.name }, update: {}, create: it });
  }
  console.log(`✓ vendors: ${items.length}`);
}

async function seedDirections() {
  const items = [
    { name: 'Разработка', code: 'DEV', color: 'sky', sortOrder: 10 },
    { name: 'DevOps', code: 'OPS', color: 'emerald', sortOrder: 20 },
    { name: 'QA', code: 'QA', color: 'amber', sortOrder: 30 },
    { name: 'Аналитика данных', code: 'DATA', color: 'violet', sortOrder: 40 },
    { name: 'Информационная безопасность', code: 'SEC', color: 'rose', sortOrder: 50 },
  ];
  for (const it of items) {
    await prisma.itDirection.upsert({ where: { name: it.name }, update: {}, create: it });
  }
  console.log(`✓ directions: ${items.length}`);
}

async function seedProducts() {
  const items = [
    { name: 'Ростелеком DataLab', description: 'Платформа данных', sortOrder: 10 },
    { name: 'ИТ-платформа Практикум', description: 'Практические курсы', sortOrder: 20 },
    { name: 'Ростелеком Security Lab', description: 'Лаборатория ИБ', sortOrder: 30 },
  ];
  for (const it of items) {
    await prisma.itProduct.upsert({ where: { name: it.name }, update: {}, create: it });
  }
  console.log(`✓ products: ${items.length}`);
}

async function seedManagers() {
  const items = [
    { fullName: 'Анна Кузнецова', email: 'anna.kuznetsova@rt.ru', position: 'Руководитель направления', avatarColor: 'blue', sortOrder: 10 },
    { fullName: 'Максим Орлов', email: 'maxim.orlov@rt.ru', position: 'Менеджер по вузам', avatarColor: 'green', sortOrder: 20 },
    { fullName: 'Ольга Миронова', email: 'olga.mironova@rt.ru', position: 'Менеджер по вузам', avatarColor: 'orange', sortOrder: 30 },
    { fullName: 'Дмитрий Соколов', email: 'dmitry.sokolov@rt.ru', position: 'Менеджер по вузам', avatarColor: 'purple', sortOrder: 40 },
    { fullName: 'Екатерина Волкова', email: 'ekaterina.volkova@rt.ru', position: 'Менеджер по вузам', avatarColor: 'blue', sortOrder: 50 },
  ];
  for (const it of items) {
    await prisma.manager.upsert({ where: { fullName: it.fullName }, update: {}, create: it });
  }
  console.log(`✓ managers: ${items.length}`);
}

async function linkManagersToProfiles() {
  const managers = await prisma.manager.findMany();
  const profiles = await prisma.profile.findMany();
  let linked = 0;
  for (const m of managers) {
    const profile = profiles.find((p) => p.fullName === m.fullName);
    if (!profile || m.profileId === profile.id) continue;
    await prisma.manager.update({ where: { id: m.id }, data: { profileId: profile.id } });
    linked++;
  }
  console.log(`✓ managers ↔ profiles: linked ${linked}`);
}

async function seedWorkflowStatuses() {
  const items = [
    { code: 'pending', label: 'Ожидает', color: 'slate', sortOrder: 10, isFinal: false },
    { code: 'in_progress', label: 'В работе', color: 'sky', sortOrder: 20, isFinal: false },
    { code: 'waiting', label: 'На проверке', color: 'amber', sortOrder: 30, isFinal: false },
    { code: 'done', label: 'Готово', color: 'emerald', sortOrder: 40, isFinal: false },
    { code: 'cancelled', label: 'Отменён', color: 'rose', sortOrder: 50, isFinal: true },
    { code: 'skipped', label: 'Пропущено', color: 'slate', sortOrder: 60, isFinal: true },
  ];
  for (const it of items) {
    await prisma.workflowStatusCatalog.upsert({ where: { code: it.code }, update: {}, create: it });
  }
  console.log(`✓ workflow statuses: ${items.length}`);
}

async function seedDefaultWorkflow() {
  const existing = await prisma.workflow.findFirst({
    where: { name: 'Полный цикл взаимодействия с вузом' },
  });
  if (existing) {
    console.log('✓ default workflow: already exists');
    return existing;
  }

  const steps = [
    'Поиск контактов ответственного в вузе',
    'Коммуникация и уточнение актуальности программ',
    'Организация встречи с представителями вуза',
    'Обмен пакетом документов',
    'Корректировка документов перед подписанием',
    'Подписание документов',
    'Передача обучающих материалов, лицензии, документации',
    'Сопровождение внедрения ИТ-продуктов',
    'Обучение преподавателей',
    'Актуализация учебной программы',
    'Ведение занятий',
    'Актуализация документации по продукту',
    'Повышение квалификации преподавателей',
    'Контроль за исполнением каждого этапа',
  ];

  const wf = await prisma.workflow.create({
    data: {
      name: 'Полный цикл взаимодействия с вузом',
      description: 'Базовый workflow ИТ Школы РТК из 14 шагов',
      status: 'Активен',
      isDefault: true,
    },
  });

  await prisma.workflowStep.createMany({
    data: steps.map((title, i) => ({
      workflowId: wf.id,
      title,
      stepOrder: i + 1,
      status: 'Ожидает',
      statusCode: 'pending',
    })),
  });

  console.log(`✓ default workflow: 1 workflow, ${steps.length} steps`);
  return wf;
}

async function seedTags() {
  const items = [
    { name: 'VIP', color: 'violet', description: 'Ключевой партнёр' },
    { name: 'Приоритет', color: 'rose', description: 'Требует внимания' },
    { name: 'Проблемный', color: 'amber', description: 'Есть сложности' },
    { name: 'Долгосрочный', color: 'emerald', description: 'Договор 3+ года' },
  ];
  for (const it of items) {
    await prisma.tag.upsert({ where: { name: it.name }, update: {}, create: it });
  }
  console.log(`✓ tags: ${items.length}`);
}

async function seedCustomFields() {
  const items = [
    { key: 'inn', label: 'ИНН', fieldType: 'text', options: [] as string[], helpText: '10 или 12 цифр', sortOrder: 10, showInTable: false },
    { key: 'ogrn', label: 'ОГРН', fieldType: 'text', options: [], helpText: null, sortOrder: 20, showInTable: false },
    { key: 'federal', label: 'Федеральный / региональный', fieldType: 'select', options: ['Федеральный','Региональный','Муниципальный'], helpText: null, sortOrder: 30, showInTable: true },
    { key: 'accreditation', label: 'Уровень аккредитации', fieldType: 'select', options: ['Базовый','Повышенный','Лидер'], helpText: null, sortOrder: 40, showInTable: false },
    { key: 'quota', label: 'Квота приёма', fieldType: 'number', options: [], helpText: 'Мест на программу', sortOrder: 50, showInTable: false },
  ];
  for (const it of items) {
    await prisma.customField.upsert({
      where: { key: it.key },
      update: {},
      create: { ...it, entity: 'universities' },
    });
  }
  console.log(`✓ custom fields: ${items.length}`);
}

async function seedKbCategories() {
  const items = [
    { name: 'Начало работы', slug: 'getting-started', description: 'Первый вход', icon: 'Rocket', color: 'sky', sortOrder: 10 },
    { name: 'Вузы и клиенты', slug: 'universities', description: 'Карточки вузов', icon: 'Building2', color: 'emerald', sortOrder: 20 },
    { name: 'Задачи и календарь', slug: 'tasks', description: 'Планирование', icon: 'CheckSquare', color: 'amber', sortOrder: 30 },
    { name: 'Аналитика', slug: 'analytics', description: 'Отчёты и метрики', icon: 'BarChart3', color: 'violet', sortOrder: 40 },
    { name: 'Интеграции', slug: 'integrations', description: 'АТС, мессенджеры, API', icon: 'Plug', color: 'rose', sortOrder: 50 },
    { name: 'Руководство пользователя', slug: 'user-guide', description: 'Пошагово', icon: 'BookOpen', color: 'sky', sortOrder: 5 },
    { name: 'Руководство администратора', slug: 'admin-guide', description: 'Настройка, безопасность', icon: 'ShieldCheck', color: 'violet', sortOrder: 6 },
    { name: 'Архитектура и ИБ', slug: 'architecture', description: '152-ФЗ, ФСТЭК №117', icon: 'Layers', color: 'rose', sortOrder: 7 },
    { name: 'FAQ', slug: 'faq', description: 'Частые вопросы', icon: 'CircleHelp', color: 'amber', sortOrder: 8 },
  ];
  for (const it of items) {
    await prisma.kbCategory.upsert({ where: { slug: it.slug }, update: {}, create: it });
  }
  console.log(`✓ kb categories: ${items.length}`);
}

/**
 * Статьи KB.
 * Базовые 5 + KB_GUIDES (объявлен вверху файла).
 */
async function seedKbArticles() {
  const categories = await prisma.kbCategory.findMany();
  const bySlug = (slug: string) => categories.find((c) => c.slug === slug);

  const articles = [
    {
      slug: 'welcome-to-crm',
      categorySlug: 'getting-started',
      title: 'Добро пожаловать в CRM ИТ Школы РТК',
      excerpt: 'Как войти и с чего начать работу',
      content: `# Добро пожаловать

Это CRM для работы с вузами по ИТ-направлениям.

## Первые шаги

1. Войдите через корпоративный SSO
2. Откройте раздел «Вузы»
3. Перейдите в карточку вуза
4. Создайте первое взаимодействие`,
      pinned: true,
      tags: ['онбординг', 'старт'],
    },
    {
      slug: 'how-to-add-university',
      categorySlug: 'universities',
      title: 'Как добавить вуз',
      excerpt: 'Пошагово: от кнопки «Добавить» до сохранения',
      content: `# Добавление вуза

1. Откройте раздел **Вузы**
2. Нажмите **Добавить**
3. Заполните поля
4. Сохраните карточку`,
      pinned: false,
      tags: ['вузы', 'инструкция'],
    },
    {
      slug: 'workflow-explained',
      categorySlug: 'tasks',
      title: 'Что такое Workflow',
      excerpt: '14 шагов взаимодействия с вузом',
      content: `# Workflow

Последовательность шагов от поиска контактов до контроля исполнения.`,
      pinned: false,
      tags: ['workflow'],
    },
    {
      slug: 'security-152fz',
      categorySlug: 'architecture',
      title: 'Соответствие 152-ФЗ',
      excerpt: 'Как система защищает ПД',
      content: `# Защита ПД

- Шифрование полей PII_KEY
- Аудит согласий (PdConsent)
- Права субъекта: экспорт, удаление`,
      pinned: false,
      tags: ['152-ФЗ'],
    },
    {
      slug: 'faq-common',
      categorySlug: 'faq',
      title: 'Частые вопросы',
      excerpt: 'Что делать, если…',
      content: `# FAQ

**Не приходят push** — разрешите уведомления в браузере.

**Забыл пароль** — обратитесь к администратору.`,
      pinned: false,
      tags: ['faq'],
    },
  ];

  const allArticles = [...articles, ...KB_GUIDES];

  let inserted = 0;
  let updated = 0;

  for (const a of allArticles) {
    const category = bySlug(a.categorySlug);
    const existing = await prisma.kbArticle.findUnique({ where: { slug: a.slug } });

    if (existing) {
      await prisma.kbArticle.update({
        where: { slug: a.slug },
        data: {
          title: a.title,
          excerpt: a.excerpt,
          content: a.content,
          categoryId: category?.id ?? null,
          tags: a.tags ?? [],
          pinned: a.pinned ?? false,
        },
      });
      updated++;
    } else {
      await prisma.kbArticle.create({
        data: {
          slug: a.slug,
          categoryId: category?.id ?? null,
          title: a.title,
          excerpt: a.excerpt,
          content: a.content,
          tags: a.tags ?? [],
          status: 'published',
          pinned: a.pinned ?? false,
          authorName: 'ИТ Школа РТК',
        },
      });
      inserted++;
    }
  }

  console.log(`✓ kb articles: ${allArticles.length} (created ${inserted}, updated ${updated})`);
}

async function seedOnboardingSteps() {
  const items = [
    { stepKey: 'nav-universities', title: 'Вузы', description: 'Карточки вузов: контакты, документы, история.', targetSelector: '[data-tour="nav-universities"]', position: 'right', sortOrder: 10 },
    { stepKey: 'add-university', title: 'Добавьте первый вуз', description: 'Нажмите сюда, чтобы создать карточку.', targetSelector: '[data-tour="add-university"]', position: 'bottom', sortOrder: 20 },
    { stepKey: 'university-detail-workflow', title: 'Работайте с workflow', description: 'Вкладка Workflow — переходите между статусами.', targetSelector: '[data-tour="university-workflow-tab"]', position: 'bottom', sortOrder: 30 },
    { stepKey: 'nav-interactions', title: 'Взаимодействия', description: 'Каждое касание фиксируется здесь.', targetSelector: '[data-tour="nav-interactions"]', position: 'right', sortOrder: 40 },
    { stepKey: 'nav-calendar', title: 'Календарь', description: 'Планируйте встречи.', targetSelector: '[data-tour="nav-calendar"]', position: 'right', sortOrder: 50 },
    { stepKey: 'nav-tasks', title: 'Задачи', description: 'Kanban-доска и список.', targetSelector: '[data-tour="nav-tasks"]', position: 'right', sortOrder: 60 },
    { stepKey: 'nav-analytics', title: 'Аналитика', description: 'ABC/XYZ, RFM, когорты, LTV.', targetSelector: '[data-tour="nav-analytics"]', position: 'right', sortOrder: 70 },
    { stepKey: 'search', title: 'Быстрый поиск', description: '⌘K — мгновенный поиск.', targetSelector: '[data-tour="search"]', position: 'bottom', sortOrder: 80 },
    { stepKey: 'nav-settings', title: 'Настройки', description: 'Профиль, push, Google Calendar, 2FA.', targetSelector: '[data-tour="nav-settings"]', position: 'right', sortOrder: 90 },
  ];
  for (const it of items) {
    await prisma.onboardingStep.upsert({
      where: { stepKey: it.stepKey },
      update: it,
      create: it,
    });
  }
  console.log(`✓ onboarding steps: ${items.length}`);
}

async function seedFeatureFlags() {
  const items = [
    { key: 'dashboard.executive', description: 'Дашборд руководства', enabled: true, allowedRoles: ['admin', 'manager'] },
    { key: 'reports.public_links', description: 'Публичные ссылки', enabled: true, allowedRoles: [] as string[] },
    { key: 'inbox.unified', description: 'Единый инбокс', enabled: true, allowedRoles: [] as string[] },
    { key: 'automation.rules', description: 'Автоматизация', enabled: true, allowedRoles: ['admin'] },
    { key: 'ab.tests', description: 'A/B-тесты', enabled: true, allowedRoles: ['admin'] },
  ];
  for (const it of items) {
    await prisma.featureFlag.upsert({ where: { key: it.key }, update: {}, create: it });
  }
  console.log(`✓ feature flags: ${items.length}`);
}

async function seedIntegrations() {
  const existing = await prisma.integration.findFirst({ where: { name: 'LMS ИТ Школы РТК' } });
  if (existing) {
    console.log('✓ integrations: already exists');
    return;
  }
  const integrations = [
    { name: 'LMS ИТ Школы РТК', type: 'custom_api', config: { endpoint: 'https://lms.rt.ru/api/v1', api_key: 'CHANGE_ME', header_name: 'X-API-Key', method: 'GET' }, status: 'Отключена', autoSync: false, syncSchedule: '0 */2 * * *' },
    { name: 'Веб-сайт ИТ Школы (Laravel)', type: 'custom_api', config: { endpoint: 'https://school.rt.ru/api/v1', api_key: 'CHANGE_ME', header_name: 'Authorization', method: 'GET' }, status: 'Отключена', autoSync: false, syncSchedule: '*/30 * * * *' },
  ];
  for (const it of integrations) {
    const created = await prisma.integration.create({ data: it });
    const eps = it.name.includes('LMS')
      ? [
          { name: 'Студенты', path: '/students', entity: 'lms_students', sortOrder: 10 },
          { name: 'Записи на курс', path: '/enrollments', entity: 'lms_enrollments', sortOrder: 20 },
          { name: 'Курсы', path: '/courses', entity: 'lms_courses', sortOrder: 30 },
          { name: 'Посещаемость', path: '/attendance', entity: 'lms_attendance', sortOrder: 40 },
        ]
      : [
          { name: 'Заявки с сайта', path: '/leads', entity: 'site_leads', sortOrder: 10 },
          { name: 'Обратная связь', path: '/feedback', entity: 'site_feedback', sortOrder: 20 },
          { name: 'Публикации', path: '/articles', entity: 'site_articles', sortOrder: 30 },
        ];
    for (const ep of eps) {
      await prisma.integrationEndpoint.create({
        data: { ...ep, integrationId: created.id, method: 'GET', enabled: true },
      });
    }
  }
  console.log(`✓ integrations: ${integrations.length}`);
}

async function seedAutomationRules() {
  const rules = [
    {
      name: 'При отказе — задача выяснить причину',
      description: 'Если вуз → Отказ — создать задачу',
      triggerType: 'on_field_change',
      triggerConfig: { field: 'status', to: 'Отказ' },
      conditions: [],
      actions: [{ type: 'create_task', params: { title: 'Выяснить причину отказа', priority: 'Высокий', due_days: 2 } }],
      enabled: true, entity: 'universities',
    },
    {
      name: 'Уведомление в Telegram о новой задаче',
      description: 'При создании задачи — уведомление',
      triggerType: 'on_create',
      triggerConfig: {},
      conditions: [],
      actions: [{ type: 'send_telegram', params: { message: '📋 Новая задача: {{title}}' } }],
      enabled: false, entity: 'tasks',
    },
    {
      name: 'Напоминание: просроченная задача',
      description: 'Ежедневно в 10:00',
      triggerType: 'on_schedule',
      triggerConfig: { cron: '0 10 * * *' },
      conditions: [
        { field: 'status', operator: 'not_in', value: ['Готово', 'Отменено'] },
        { field: 'due_date', operator: 'less', value: 'today' },
      ],
      actions: [{ type: 'send_telegram', params: { message: '⚠️ Просроченная задача: {{title}}' } }],
      enabled: false, entity: 'tasks',
    },
    {
      name: 'Задача куратору при назначении нового вуза',
      description: 'Если назначен новый менеджер',
      triggerType: 'on_field_change',
      triggerConfig: { field: 'manager', to: null },
      conditions: [],
      actions: [
        { type: 'create_task', params: { title: 'Связаться с вузом', priority: 'Средний', due_days: 1 } },
        { type: 'send_telegram', params: { message: '🆕 Вы назначены ответственным за вуз {{name}}' } },
      ],
      enabled: true, entity: 'universities',
    },
  ];
  for (const r of rules) {
    const existing = await prisma.automationRule.findFirst({ where: { name: r.name }, select: { id: true } });
    if (existing) continue;
    await prisma.automationRule.create({
      data: {
        name: r.name, description: r.description, enabled: r.enabled, entity: r.entity,
        triggerType: r.triggerType,
        triggerConfig: r.triggerConfig as never,
        conditions: r.conditions as never,
        actions: r.actions as never,
      },
    });
  }
  console.log(`✓ automation rules: ${rules.length}`);
}

// ============================================================
// 2. Профили
// ============================================================

async function seedProfiles() {
  const profiles = [
    { id: '00000000-0000-0000-0000-000000000001', email: 'admin@rt.ru', fullName: 'Администратор Системы', role: 'admin', avatarColor: 'purple' },
    { id: '00000000-0000-0000-0000-000000000002', email: 'manager@rt.ru', fullName: 'Анна Кузнецова', role: 'manager', avatarColor: 'blue' },
    { id: '00000000-0000-0000-0000-000000000003', email: 'nam@rt.ru', fullName: 'Максим Орлов', role: 'nam', avatarColor: 'green' },
    { id: '00000000-0000-0000-0000-000000000004', email: 'olga.mironova@rt.ru', fullName: 'Ольга Миронова', role: 'nam', avatarColor: 'orange' },
    { id: '00000000-0000-0000-0000-000000000005', email: 'dmitry.sokolov@rt.ru', fullName: 'Дмитрий Соколов', role: 'nam', avatarColor: 'blue' },
    { id: '00000000-0000-0000-0000-000000000006', email: 'ekaterina.volkova@rt.ru', fullName: 'Екатерина Волкова', role: 'nam', avatarColor: 'purple' },
  ];

  const actualProfiles: { id: string; email: string }[] = [];

  for (const p of profiles) {
    const created = await prisma.profile.upsert({
      where: { email: p.email },
      update: {},
      create: p,
      select: { id: true, email: true },
    });
    actualProfiles.push(created);
  }
  console.log(`✓ profiles: ${profiles.length}`);

  for (const p of actualProfiles) {
    await prisma.userPreferences.upsert({
      where: { userId: p.id },
      update: {},
      create: { userId: p.id },
    });
  }
}

// ============================================================
// 3. Демо-данные
// ============================================================

async function seedUniversities() {
  const existingCount = await prisma.university.count();
  if (existingCount > 0) {
    console.log(`✓ universities: уже есть ${existingCount}, пропускаем`);
    return await prisma.university.findMany();
  }
  const managers = await prisma.manager.findMany();
  const directions = await prisma.itDirection.findMany();
  const products = await prisma.itProduct.findMany();
  const vendors = await prisma.vendor.findMany();

  const created = [];
  for (let i = 0; i < UNIVERSITIES.length; i++) {
    const name = UNIVERSITIES[i];
    const city = CITIES[i % CITIES.length];
    const direction = directions[i % directions.length];
    const product = products[i % products.length];
    const vendor = vendors[i % vendors.length];

    let status: string;
    if (i < 5) status = 'Новый';
    else if (i < 12) status = 'Переговоры';
    else if (i < 17) status = 'Обучение';
    else if (i < 22) status = 'Внедрение';
    else if (i < 28) status = 'Партнёр';
    else status = 'Отказ';

    const manager = managers[i % managers.length];
    const licenseSigned = ['Партнёр', 'Внедрение'].includes(status);
    const licenseExpiresAt = licenseSigned ? daysAhead(randInt(60, 720)) : null;
    const contractValue = licenseSigned ? randInt(300_000, 3_000_000) : randInt(0, 500_000);

    const uni = await prisma.university.create({
      data: {
        name, city,
        direction: direction.name,
        product: product.name,
        vendorId: vendor.id, directionId: direction.id, productId: product.id,
        managerId: manager.id, manager: manager.fullName,
        status,
        handoverStatus: pick(HANDOVER),
        contactName: randomPerson(),
        contactEmail: randomEmail(name),
        contactPhone: randomPhone(),
        telegram: `@${name.toLowerCase().replace(/\s+/g, '_')}`,
        whatsapp: rng() > 0.5 ? randomPhone() : null,
        maxMessenger: rng() > 0.5 ? randomPhone() : null,
        licenseSigned, licenseExpiresAt,
        contractNumber: licenseSigned ? `Д-2026-${String(i + 1).padStart(3, '0')}` : null,
        contractValue,
        source: pick(['Вручную', 'Импорт', 'LMS', 'Сайт']),
        notes: rng() > 0.7 ? `Пилотная группа ${randInt(20, 80)} студентов` : null,
        createdAt: daysAgo(randInt(30, 400)),
        updatedAt: daysAgo(randInt(0, 20)),
      },
    });
    created.push(uni);
  }
  console.log(`✓ universities: ${created.length}`);
  return created;
}

async function seedUniversityContacts(universities: Awaited<ReturnType<typeof seedUniversities>>) {
  const existingCount = await prisma.universityContact.count();
  if (existingCount > 0) {
    console.log(`✓ contacts: уже есть ${existingCount}, пропускаем`);
    return;
  }
  let created = 0;
  for (let i = 0; i < universities.length && created < 20; i++) {
    const uni = universities[i];
    const count = i < 3 ? 2 : 1;
    for (let c = 0; c < count && created < 20; c++) {
      const fullName = randomPerson();
      await prisma.universityContact.create({
        data: {
          universityId: uni.id, fullName,
          role: pick(CONTACT_ROLES),
          email: randomEmail(fullName), phone: randomPhone(),
          isPrimary: c === 0,
        },
      });
      created++;
    }
  }
  console.log(`✓ contacts: ${created}`);
}

async function seedInteractions(universities: Awaited<ReturnType<typeof seedUniversities>>) {
  const existingCount = await prisma.interaction.count();
  if (existingCount > 0) {
    console.log(`✓ interactions: уже есть ${existingCount}, пропускаем`);
    return;
  }
  const managers = await prisma.manager.findMany();
  const details = [
    'Обсудили запуск программы', 'Согласовали список преподавателей',
    'Запросили учебную программу', 'Провели демо продукта',
    'Уточнили сроки подписания', 'Организовали встречу с проректором',
    'Передали документы на подпись', 'Обсудили формат занятий',
    'Согласовали старт занятий', 'Провели обучение',
  ];
  let created = 0;
  for (let i = 0; i < 220; i++) {
    const uni = pick(universities);
    const daysBack = randInt(0, 180);
    const isFuture = rng() > 0.85;
    const status = isFuture ? 'Запланировано' : pick(['Завершено', 'Завершено', 'Завершено', 'В работе', 'Отменено']);
    await prisma.interaction.create({
      data: {
        universityId: uni.id,
        type: pick(INTERACTION_TYPES),
        title: pick(['Звонок по расписанию', 'Встреча в вузе', 'Онлайн-встреча', 'Письмо с документами']),
        details: pick(details),
        interactionDate: isFuture ? daysAhead(randInt(1, 30)) : daysAgo(daysBack),
        status,
        manager: uni.manager || pick(managers).fullName,
        startTime: `${String(randInt(9, 18)).padStart(2, '0')}:00`,
        endTime: `${String(randInt(10, 19)).padStart(2, '0')}:00`,
        color: pick(['sky', 'emerald', 'amber', 'violet', 'rose', 'teal']),
      },
    });
    created++;
  }
  console.log(`✓ interactions: ${created}`);
}

async function seedTasks(universities: Awaited<ReturnType<typeof seedUniversities>>) {
  const existingCount = await prisma.task.count();
  if (existingCount > 0) {
    console.log(`✓ tasks: уже есть ${existingCount}, пропускаем`);
    return;
  }
  const titles = [
    'Позвонить в вуз', 'Отправить программу', 'Согласовать даты',
    'Подготовить презентацию', 'Проверить статус подписания',
    'Загрузить документы', 'Уточнить контактное лицо', 'Проверить оплату',
  ];
  let created = 0;
  for (let i = 0; i < 100; i++) {
    const uni = pick(universities);
    let dueDate: Date;
    let status: string;
    if (i < 20) {
      dueDate = daysAgo(randInt(1, 30));
      status = rng() > 0.4 ? 'К выполнению' : 'В работе';
    } else if (i < 40) {
      dueDate = i < 30 ? daysAgo(0) : daysAhead(1);
      status = pick(['К выполнению', 'В работе', 'Готово']) as string;
    } else if (i < 80) {
      dueDate = daysAhead(randInt(2, 7));
      status = pick(['К выполнению', 'В работе']);
    } else {
      dueDate = daysAhead(randInt(8, 60));
      status = pick(['К выполнению', 'В работе', 'Готово', 'Отменено']);
    }
    await prisma.task.create({
      data: {
        universityId: uni.id,
        title: pick(titles),
        description: rng() > 0.5 ? 'Связаться и уточнить статус' : null,
        status, priority: pick(TASK_PRIORITIES), dueDate,
        assignee: uni.manager,
        reminderAt: rng() > 0.7 ? dueDate : null,
      },
    });
    created++;
  }
  console.log(`✓ tasks: ${created}`);
}

async function seedContracts(universities: Awaited<ReturnType<typeof seedUniversities>>) {
  const existingCount = await prisma.contract.count();
  if (existingCount > 0) {
    console.log(`✓ contracts: уже есть ${existingCount}, пропускаем`);
    return;
  }
  const distribution = [
    { status: 'Черновик', count: 3 },
    { status: 'На проверке', count: 3 },
    { status: 'Согласован', count: 3 },
    { status: 'Подписан', count: 2 },
    { status: 'Отклонён', count: 1 },
  ];
  const templates: Record<string, string[]> = {
    standard: ['Менеджер', 'Юрист', 'Финансы', 'Директор'],
    short: ['Менеджер', 'Директор'],
    legal: ['Юрист', 'Директор'],
  };
  let created = 0;
  let uniIdx = 0;
  for (const { status, count } of distribution) {
    for (let i = 0; i < count; i++) {
      const uni = universities[uniIdx % universities.length];
      uniIdx++;
      const contract = await prisma.contract.create({
        data: {
          universityId: uni.id,
          title: `Договор на обучение ${2026 + (i % 2)}`,
          contractNumber: `Д-${2026}-${String(100 + created).padStart(4, '0')}`,
          amount: randInt(300_000, 2_500_000),
          currency: 'RUB', status,
          signedAt: status === 'Подписан' ? daysAgo(randInt(10, 90)) : null,
          expiresAt: daysAhead(randInt(90, 720)),
          notes: rng() > 0.7 ? 'Стандартные условия' : null,
          createdAt: daysAgo(randInt(30, 180)),
        },
      });
      const roles = templates[pick(['standard', 'short', 'legal'])];
      for (let s = 0; s < roles.length; s++) {
        let stepStatus: string;
        if (status === 'Согласован' || status === 'Подписан') stepStatus = 'Одобрено';
        else if (status === 'Отклонён') stepStatus = s === 0 ? 'Отклонено' : 'Ожидает';
        else if (status === 'На проверке') stepStatus = s < 1 ? 'Одобрено' : 'Ожидает';
        else stepStatus = 'Ожидает';
        await prisma.contractApproval.create({
          data: {
            contractId: contract.id,
            stepOrder: s + 1,
            role: roles[s],
            status: stepStatus,
            approverName: stepStatus === 'Ожидает' ? null : 'Руководитель',
            decidedAt: stepStatus === 'Ожидает' ? null : daysAgo(randInt(1, 30)),
            comment: stepStatus === 'Отклонено' ? 'Требуется уточнение' : null,
          },
        });
      }
      created++;
    }
  }
  console.log(`✓ contracts: ${created}`);
}

async function seedDocuments(universities: Awaited<ReturnType<typeof seedUniversities>>) {
  const existingCount = await prisma.document.count();
  if (existingCount > 0) {
    console.log(`✓ documents: уже есть ${existingCount}, пропускаем`);
    return;
  }
  const docs = [
    { name: 'Договор.pdf', category: 'Договор', mime: 'application/pdf', size: 245_000 },
    { name: 'Лицензия.pdf', category: 'Лицензия', mime: 'application/pdf', size: 180_000 },
    { name: 'Программа.docx', category: 'Программа', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 95_000 },
    { name: 'Методичка.xlsx', category: 'Материалы', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 320_000 },
    { name: 'Презентация.pdf', category: 'Презентация', mime: 'application/pdf', size: 1_200_000 },
  ];
  for (let i = 0; i < docs.length; i++) {
    const uni = universities[i % universities.length];
    const d = docs[i];
    const uuid = `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`;
    await prisma.document.create({
      data: {
        universityId: uni.id, name: d.name,
        description: `${d.category} для ${uni.name}`,
        category: d.category,
        storagePath: `${uni.id}/${uuid}-${d.name.replace(/\s+/g, '_')}`,
        mimeType: d.mime,
        sizeBytes: BigInt(d.size),
        uploadedBy: uni.manager,
        createdAt: daysAgo(randInt(1, 120)),
      },
    });
  }
  console.log(`✓ documents: ${docs.length}`);
}

async function seedAbTests() {
  const existing = await prisma.abTest.findUnique({ where: { key: 'dashboard_widget_order' } });
  if (existing) {
    console.log('✓ ab tests: already exists');
    return;
  }
  await prisma.abTest.create({
    data: {
      key: 'dashboard_widget_order',
      description: 'Тест порядка виджетов',
      variants: [{ id: 'control', weight: 50 }, { id: 'variant_a', weight: 50 }],
      enabled: false,
    },
  });
  console.log('✓ ab tests: 1');
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('🌱 Seeding database…\n');

  await seedVendors();
  await seedDirections();
  await seedProducts();
  await seedManagers();
  await seedWorkflowStatuses();
  await seedDefaultWorkflow();
  await seedTags();
  await seedCustomFields();
  await seedKbCategories();
  await seedKbArticles();
  await seedOnboardingSteps();
  await seedFeatureFlags();
  await seedIntegrations();
  await seedAutomationRules();
  await seedAbTests();

  await seedProfiles();
  await linkManagersToProfiles();

  console.log('');

  const universities = await seedUniversities();
  if (universities.length > 0) {
    await seedUniversityContacts(universities);
    await seedInteractions(universities);
    await seedTasks(universities);
    await seedContracts(universities);
    await seedDocuments(universities);

    const defaultWorkflow = await prisma.workflow.findFirst({
      where: { isDefault: true },
      include: { steps: { orderBy: { stepOrder: 'asc' }, take: 1 } },
    });
    if (defaultWorkflow && defaultWorkflow.steps[0]) {
      const firstStep = defaultWorkflow.steps[0];
      let linksCreated = 0;
      for (const uni of universities) {
        const exists = await prisma.workflowUniversity.findUnique({
          where: { workflowId_universityId: { workflowId: defaultWorkflow.id, universityId: uni.id } },
        });
        if (exists) continue;
        await prisma.workflowUniversity.create({
          data: { workflowId: defaultWorkflow.id, universityId: uni.id, currentStepId: firstStep.id, status: 'В работе' },
        });
        linksCreated++;
      }
      console.log(`✓ workflow links: ${linksCreated}`);
    }
  }

  console.log('\n✅ Seed complete\n');
  console.log('Демо-учётки:');
  console.log('  admin@rt.ru   — Администратор');
  console.log('  manager@rt.ru — Руководитель');
  console.log('  nam@rt.ru     — Пользователь (НАМ)');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });