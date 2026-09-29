// scripts/loadtest/mixed-load.js
//
// СМЕШАННЫЙ профиль: 50 VU на обычных операциях + 10 VU на отчётах
// + 5 VU на экспорте файлов (XLSX/XLS/PDF) — всё ОДНОВРЕМЕННО.
//
// Это проверка связки НФТ-6 (50 параллельных пользователей) и
// НФТ-7 (10 параллельных отчётов) в одном прогоне.
//
// Запуск:
//   k6 run scripts/loadtest/mixed-load.js
//
// На прод-стенде:
//   source scripts/loadtest/prod.env
//   k6 run scripts/loadtest/mixed-load.js

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const TOKEN = __ENV.TOKEN || '';
const TEST_USER_ID = __ENV.TEST_USER_ID || '';
const TEST_UNIVERSITY_ID = __ENV.TEST_UNIVERSITY_ID || '';

const errors = new Rate('errors');
const apiDuration = new Trend('api_duration');
const reportDuration = new Trend('report_duration');
const exportDuration = new Trend('export_duration');

export const options = {
  scenarios: {
    // ── 1. 50 параллельных «обычных» пользователей (5 мин).
    //    Ходят по страницам, смотрят вузы, открывают карточки.
    users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '4m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'browseUser',
      tags: { profile: 'users' },
    },

    // ── 2. 10 VU генерируют JSON-отчёты (2 мин, старт одновременно).
    reports: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
      startTime: '30s', // чуть позже, чтобы «разгон» совпал с нагрузкой
      exec: 'generateReports',
      tags: { profile: 'reports' },
    },

    // ── 3. 5 VU выгружают файлы (XLSX / XLS / PDF) — тяжёлые эндпоинты.
    exports: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
      startTime: '45s',
      exec: 'exportFiles',
      tags: { profile: 'exports' },
    },
  },

  thresholds: {
    // Обычные запросы — p95 < 1 сек (НФТ-1)
    'http_req_duration{profile:users}': ['p(95)<1000', 'p(99)<2000'],
    // JSON-отчёты — до 5 сек p95 (НФТ-7, сложные расчёты)
    'http_req_duration{profile:reports}': ['p(95)<5000'],
    // Экспорт файлов — до 30 сек p95 (PDF/XLSX, паппет, генерация)
    'http_req_duration{profile:exports}': ['p(95)<30000'],
    // Общий порог ошибок — 1%
    'http_req_failed': ['rate<0.01'],
    errors: ['rate<0.01'],
  },

  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],

  // Экономия памяти на клиенте: тела ответов не храним
  discardResponseBodies: false, // для отчётов нужно хоть иногда читать — оставляем
};

const headers = {
  Accept: 'application/json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  ...(TEST_USER_ID ? { 'X-Test-User-Id': TEST_USER_ID } : {}),
};

// ============================================================
// СЦЕНАРИЙ 1: обычный пользователь
// ============================================================
export function browseUser() {
  group('dashboard', () => {
    const r = http.get(`${BASE_URL}/reports/dashboard-summary`, {
      headers,
      tags: { type: 'api', endpoint: 'dashboard' },
    });
    check(r, { 'dashboard 200': (x) => x.status === 200 }) || errors.add(1);
    apiDuration.add(r.timings.duration);
  });

  sleep(0.5);

  group('universities list', () => {
    const r = http.get(`${BASE_URL}/universities?pageSize=25`, {
      headers,
      tags: { type: 'api', endpoint: 'universities' },
    });
    check(r, {
      'universities 200': (x) => x.status === 200,
      'has data': (x) => typeof x.body === 'string' && x.body.length > 0,
    }) || errors.add(1);
    apiDuration.add(r.timings.duration);
  });

  sleep(0.5);

  group('tasks list', () => {
    const r = http.get(`${BASE_URL}/tasks?pageSize=50`, {
      headers,
      tags: { type: 'api', endpoint: 'tasks' },
    });
    check(r, { 'tasks 200': (x) => x.status === 200 }) || errors.add(1);
    apiDuration.add(r.timings.duration);
  });

  sleep(0.5);

  group('interactions list', () => {
    const r = http.get(`${BASE_URL}/interactions?pageSize=50`, {
      headers,
      tags: { type: 'api', endpoint: 'interactions' },
    });
    check(r, { 'interactions 200': (x) => x.status === 200 }) || errors.add(1);
    apiDuration.add(r.timings.duration);
  });

  sleep(1);
}

// ============================================================
// СЦЕНАРИЙ 2: JSON-отчёты (без файлов)
// ============================================================
export function generateReports() {
  const endpoints = [
    {
      name: 'dashboard',
      url: '/reports/dashboard-summary',
    },
    {
      name: 'interactions-json',
      url: '/reports/interactions?from=2026-01-01&to=2026-12-31',
    },
    {
      name: 'analytics-abc-xyz',
      url: '/analytics/abc-xyz?from=2026-01-01&to=2026-12-31',
    },
    { name: 'analytics-rfm', url: '/analytics/rfm' },
    { name: 'analytics-cohorts', url: '/analytics/cohorts?monthsBack=12' },
    { name: 'analytics-ltv', url: '/analytics/ltv' },
    {
      name: 'analytics-metrics',
      url: '/analytics/metrics?from=2026-01-01&to=2026-12-31',
    },
  ];

  const ep = endpoints[__ITER % endpoints.length];

  const r = http.get(`${BASE_URL}${ep.url}`, {
    headers,
    tags: { type: 'report', profile: 'reports', endpoint: ep.name },
    timeout: '60s',
  });

  const ok = check(r, { [`${ep.name} 200`]: (x) => x.status === 200 });
  reportDuration.add(r.timings.duration);
  errors.add(!ok);

  sleep(2);
}

// ============================================================
// СЦЕНАРИЙ 3: экспорт файлов (XLSX, XLS, PDF)
// ============================================================
export function exportFiles() {
  const endpoints = [
    {
      name: 'xlsx',
      url: `/reports/interactions.xlsx?from=2026-01-01&to=2026-12-31${
        TEST_UNIVERSITY_ID ? `&universityId=${TEST_UNIVERSITY_ID}` : ''
      }`,
      maxMs: 60_000,
    },
    {
      name: 'xls',
      url: `/reports/interactions.xls?from=2026-01-01&to=2026-12-31${
        TEST_UNIVERSITY_ID ? `&universityId=${TEST_UNIVERSITY_ID}` : ''
      }`,
      maxMs: 60_000,
    },
    {
      name: 'pdf',
      url: `/reports/interactions.pdf?from=2026-01-01&to=2026-12-31${
        TEST_UNIVERSITY_ID ? `&universityId=${TEST_UNIVERSITY_ID}` : ''
      }`,
      maxMs: 90_000,
    },
  ];

  const ep = endpoints[__ITER % endpoints.length];

  const r = http.get(`${BASE_URL}${ep.url}`, {
    headers,
    tags: { type: 'export', profile: 'exports', endpoint: ep.name },
    timeout: `${ep.maxMs}ms`,
  });

  const ok = check(r, {
    [`${ep.name} 200`]: (x) => x.status === 200,
    [`${ep.name} not empty`]: (x) =>
      typeof x.body === 'string'
        ? x.body.length > 1000
        : x.body && (x.body.byteLength ?? 0) > 1000,
  });
  exportDuration.add(r.timings.duration);
  errors.add(!ok);

  sleep(3);
}