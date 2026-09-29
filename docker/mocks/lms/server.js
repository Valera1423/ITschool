// docker/mocks/lms/server.js
/* eslint-disable no-console */
/**
 * Mock-LMS + mock-Laravel API.
 *
 * Отдаёт данные по контракту, согласованному с командами:
 *   GET /api/v1/students
 *   GET /api/v1/enrollments
 *   GET /api/v1/courses
 *   GET /api/v1/attendance
 *   GET /api/v1/leads      (Laravel)
 *   GET /api/v1/feedback   (Laravel)
 *   GET /api/v1/articles   (Laravel)
 *
 * Все данные — детерминированные (seeded LCG), чтобы e2e были стабильны.
 * Запуск: node server.js  (порт из PORT, по умолчанию 4100)
 */
const express = require('express');
const http = require('node:http');

const PORT = Number(process.env.PORT || 4100);
const API_KEY = process.env.MOCK_API_KEY || 'mock-api-key-123';

// ============================================================
// Детерминированный PRNG (LCG, как в seed.ts)
// ============================================================
function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}
const rng = makeRng(20260916);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const randInt = (a, b) => Math.floor(rng() * (b - a + 1)) + a;

// ============================================================
// Данные
// ============================================================
const UNIVERSITIES = [
  'МГУ им. М.В. Ломоносова', 'МФТИ', 'ИТМО', 'ВШЭ', 'МГТУ им. Баумана',
  'СПбГУ', 'НГУ', 'УрФУ', 'КФУ', 'ННГУ им. Лобачевского',
  'ЮУрГУ', 'СамГУ', 'ОмГУ', 'ЮФУ', 'БашГУ',
  'СФУ', 'ВГУ', 'ПГНИУ', 'ВолгГТУ', 'КубГУ',
  'СГУ им. Чернышевского', 'ТюмГУ', 'УдГУ', 'АлтГУ', 'УлГУ',
  'ИГУ', 'ТОГУ', 'ЯрГУ', 'ДВФУ', 'ТГУ',
];

const CITIES = [
  'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
  'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
  'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград',
  'Краснодар', 'Саратов', 'Тюмень', 'Ижевск', 'Барнаул',
  'Ульяновск', 'Иркутск', 'Хабаровск', 'Ярославль', 'Владивосток',
  'Томск', 'Оренбург', 'Рязань', 'Тула', 'Сочи',
];

const DIRECTION_CODES = ['DEV', 'OPS', 'QA', 'DATA', 'SEC'];
const DIRECTION_NAMES = [
  'Разработка', 'DevOps', 'QA', 'Аналитика данных', 'Информационная безопасность',
];

const PRODUCTS = [
  'Ростелеком DataLab',
  'ИТ-платформа Практикум',
  'Ростелеком Security Lab',
];

const MANAGERS = [
  'Анна Кузнецова',
  'Максим Орлов',
  'Ольга Миронова',
  'Дмитрий Соколов',
  'Екатерина Волкова',
];

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function buildUniversity(i) {
  const name = UNIVERSITIES[i];
  return {
    external_id: `ext-uni-${String(i + 1).padStart(3, '0')}`,
    name,
    city: CITIES[i % CITIES.length],
    direction_code: DIRECTION_CODES[i % DIRECTION_CODES.length],
    direction_name: DIRECTION_NAMES[i % DIRECTION_NAMES.length],
    product: PRODUCTS[i % PRODUCTS.length],
    manager: MANAGERS[i % MANAGERS.length],
    contact_name: `Контакт ${i + 1}`,
    contact_email: `contact${i + 1}@${name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8)}.ru`,
    contact_phone: `+7 9${randInt(10, 99)} ${randInt(100, 999)}-${String(randInt(0, 99)).padStart(2, '0')}-${String(randInt(0, 99)).padStart(2, '0')}`,
    license_signed: i % 3 === 0,
    license_expires_at: i % 3 === 0 ? isoDaysAgo(-randInt(60, 720)) : null,
    status: pick(['Новый', 'Переговоры', 'Обучение', 'Внедрение', 'Партнёр', 'Отказ']),
    created_at: isoDaysAgo(randInt(30, 400)),
  };
}

const UNIVERSITIES_DATA = UNIVERSITIES.map((_, i) => buildUniversity(i));

// ---- Students / Enrollments / Courses / Attendance ----
const STUDENTS = Array.from({ length: 300 }, (_, i) => {
  const uni = UNIVERSITIES_DATA[i % UNIVERSITIES_DATA.length];
  return {
    id: `stu-${i + 1}`,
    university_external_id: uni.external_id,
    university_name: uni.name,
    full_name: `Студент ${i + 1}`,
    email: `student${i + 1}@example.ru`,
    direction_code: uni.direction_code,
    enrolled_at: isoDaysAgo(randInt(1, 365)),
    status: pick(['active', 'completed', 'dropped']),
  };
});

const COURSES = [
  { id: 'c-dev-101', name: 'Разработка на Python', direction_code: 'DEV' },
  { id: 'c-dev-102', name: 'Frontend на React', direction_code: 'DEV' },
  { id: 'c-ops-201', name: 'Docker и Kubernetes', direction_code: 'OPS' },
  { id: 'c-qa-301', name: 'Автотесты на Playwright', direction_code: 'QA' },
  { id: 'c-data-401', name: 'Data Engineering', direction_code: 'DATA' },
  { id: 'c-sec-501', name: 'Прикладная ИБ', direction_code: 'SEC' },
];

const ENROLLMENTS = Array.from({ length: 500 }, (_, i) => {
  const stu = STUDENTS[i % STUDENTS.length];
  const course = COURSES[i % COURSES.length];
  return {
    id: `enr-${i + 1}`,
    student_id: stu.id,
    course_id: course.id,
    university_external_id: stu.university_external_id,
    enrolled_at: isoDaysAgo(randInt(1, 300)),
    progress: randInt(0, 100),
    completed: rng() > 0.6,
  };
});

const ATTENDANCE = Array.from({ length: 800 }, (_, i) => {
  const enr = ENROLLMENTS[i % ENROLLMENTS.length];
  return {
    id: `att-${i + 1}`,
    enrollment_id: enr.id,
    date: isoDaysAgo(randInt(0, 90)),
    present: rng() > 0.2,
  };
});

// ---- Laravel: leads / feedback / articles ----
const LEADS = Array.from({ length: 120 }, (_, i) => {
  const uni = UNIVERSITIES_DATA[i % UNIVERSITIES_DATA.length];
  return {
    id: `lead-${i + 1}`,
    university_external_id: uni.external_id,
    university_name: uni.name,
    source: pick(['site', 'webinar', 'email', 'phone']),
    contact_name: `Лид ${i + 1}`,
    contact_email: `lead${i + 1}@example.ru`,
    status: pick(['new', 'processed', 'converted', 'rejected']),
    created_at: isoDaysAgo(randInt(1, 180)),
  };
});

const FEEDBACK = Array.from({ length: 60 }, (_, i) => {
  const uni = UNIVERSITIES_DATA[i % UNIVERSITIES_DATA.length];
  return {
    id: `fb-${i + 1}`,
    university_external_id: uni.external_id,
    rating: randInt(1, 5),
    message: `Отзыв №${i + 1} от ${uni.name}`,
    created_at: isoDaysAgo(randInt(1, 90)),
  };
});

const ARTICLES = Array.from({ length: 30 }, (_, i) => ({
  id: `art-${i + 1}`,
  title: `Публикация №${i + 1}`,
  slug: `article-${i + 1}`,
  excerpt: 'Краткое описание публикации',
  published_at: isoDaysAgo(randInt(1, 365)),
}));

// ============================================================
// Сервер
// ============================================================
const app = express();
app.use(express.json({ limit: '2mb' }));

// Лог
app.use((req, _res, next) => {
  console.log(`[mock-lms] ${req.method} ${req.path}`);
  next();
});

// Auth (кроме /health)
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const key = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (API_KEY && key !== API_KEY) {
    return res.status(401).json({ error: 'invalid api key' });
  }
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'mock-lms' }));

// LMS
app.get('/api/v1/universities', (_req, res) => res.json({ data: UNIVERSITIES_DATA }));
app.get('/api/v1/students', (_req, res) => res.json({ data: STUDENTS }));
app.get('/api/v1/courses', (_req, res) => res.json({ data: COURSES }));
app.get('/api/v1/enrollments', (_req, res) => res.json({ data: ENROLLMENTS }));
app.get('/api/v1/attendance', (_req, res) => res.json({ data: ATTENDANCE }));

// Laravel CMS
app.get('/api/v1/leads', (_req, res) => res.json({ data: LEADS }));
app.get('/api/v1/feedback', (_req, res) => res.json({ data: FEEDBACK }));
app.get('/api/v1/articles', (_req, res) => res.json({ data: ARTICLES }));

// Pagination «как у Laravel» (для теста маппинга)
app.get('/api/v1/leads/paginated', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(100, Number(req.query.per_page) || 25);
  const start = (page - 1) * perPage;
  res.json({
    data: LEADS.slice(start, start + perPage),
    current_page: page,
    last_page: Math.ceil(LEADS.length / perPage),
    per_page: perPage,
    total: LEADS.length,
  });
});

// 404
app.use((_req, res) => res.status(404).json({ error: 'not found' }));

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`[mock-lms] слушает на http://0.0.0.0:${PORT}`);
  console.log(`[mock-lms] API_KEY = ${API_KEY}`);
  console.log(`[mock-lms] endpoints: /api/v1/universities, /students, /courses, /enrollments, /attendance, /leads, /feedback, /articles`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));