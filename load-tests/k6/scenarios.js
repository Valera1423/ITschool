/* eslint-disable */
// load-tests/k6/scenarios.js
//
// Нагрузочные сценарии по ТЗ п.5 нефункц.:
//   - ≤1 сек отклик при обычных операциях
//   - 50 параллельных пользователей
//   - 10 параллельных отчётов
//
// Запуск:
//   k6 run load-tests/k6/scenarios.js
//   k6 run -e BASE_URL=https://crm.rt.ru -e TOKEN=<jwt> load-tests/k6/scenarios.js
//   K6_PROFILE=reports k6 run load-tests/k6/scenarios.js
//
// Установка k6:
//   https://k6.io/docs/get-started/installation/

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const TOKEN = __ENV.TOKEN || '';
const PROFILE = __ENV.K6_PROFILE || 'all';

const apiErrors = new Rate('api_errors');
const slowRequests = new Trend('slow_requests_ms', true);

// ============================================================
// Общие thresholds (ТЗ: ≤1 сек p95, 50 VU, 10 отчётов)
// ============================================================
const commonThresholds = {
  // p95 для обычных запросов ≤ 1000 мс — ТЗ
  'http_req_duration{type:list}': ['p(95)<1000', 'p(99)<2000'],
  // p95 для отчётов ≤ 5000 мс (PDF сложнее)
  'http_req_duration{type:report}': ['p(95)<5000', 'p(99)<10000'],
  // Никаких 5xx
  'http_req_failed': ['rate<0.01'],
  api_errors: ['rate<0.01'],
};

// ============================================================
// Сценарии
// ============================================================
const ALL_SCENARIOS = {
  // 1. Smoke — проверка что вообще работает
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '1m',
    tags: { scenario: 'smoke' },
    exec: 'browseUser',
  },

  // 2. Average load — 50 VU в течение 5 минут (ТЗ)
  average_load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 50 },
      { duration: '4m', target: 50 },
      { duration: '30s', target: 0 },
    ],
    tags: { scenario: 'average' },
    exec: 'browseUser',
  },

  // 3. 10 параллельных отчётов (ТЗ)
  concurrent_reports: {
    executor: 'constant-vus',
    vus: 10,
    duration: '2m',
    tags: { scenario: 'reports' },
    exec: 'generateReports',
  },

  // 4. Spike — резкая нагрузка
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 100 },
      { duration: '30s', target: 100 },
      { duration: '10s', target: 0 },
    ],
    tags: { scenario: 'spike' },
    exec: 'browseUser',
  },
};

export const options = {
  scenarios:
    PROFILE === 'reports'
      ? { concurrent_reports: ALL_SCENARIOS.concurrent_reports }
      : PROFILE === 'all' || PROFILE === 'smoke'
        ? { smoke: ALL_SCENARIOS.smoke }
        : { [PROFILE]: ALL_SCENARIOS[PROFILE] },
  thresholds: commonThresholds,
};

// ============================================================
// Helpers
// ============================================================
function headers(extra = {}) {
  const h = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
  if (TOKEN) h['Authorization'] = `Bearer ${TOKEN}`;
  return h;
}

function timed(name, tags, fn) {
  const start = Date.now();
  const res = fn();
  const dur = Date.now() - start;
  slowRequests.add(dur, { name, ...tags });
  return res;
}

// ============================================================
// Сценарий 1: обычный пользователь (листает страницы, создаёт сущности)
// ============================================================
export function browseUser() {
  group('dashboard', () => {
    const r = timed(
      'dashboard',
      { type: 'list' },
      () => http.get(`${BASE_URL}/api/v1/reports/dashboard-summary`, { headers: headers() }),
    );
    check(r, {
      'dashboard 200': (r) => r.status === 200,
      'dashboard < 1s': (r) => r.timings.duration < 1000,
    });
    apiErrors.add(r.status >= 500);
  });

  sleep(1);

  group('universities list', () => {
    const r = timed(
      'universities',
      { type: 'list' },
      () => http.get(`${BASE_URL}/api/v1/universities?pageSize=25`, { headers: headers() }),
    );
    check(r, {
      'universities 200': (r) => r.status === 200,
      'universities < 1s': (r) => r.timings.duration < 1000,
    });
    apiErrors.add(r.status >= 500);

    // Открываем первый вуз
    if (r.status === 200) {
      try {
        const data = JSON.parse(r.body).data;
        if (Array.isArray(data) && data[0]) {
          const uid = data[0].id;
          const detail = timed(
            'university detail',
            { type: 'list' },
            () => http.get(`${BASE_URL}/api/v1/universities/${uid}`, { headers: headers() }),
          );
          check(detail, {
            'detail 200': (r) => r.status === 200,
            'detail < 1s': (r) => r.timings.duration < 1000,
          });
        }
      } catch {
        /* ignore */
      }
    }
  });

  sleep(1);

  group('tasks list', () => {
    const r = timed(
      'tasks',
      { type: 'list' },
      () => http.get(`${BASE_URL}/api/v1/tasks?pageSize=50`, { headers: headers() }),
    );
    check(r, {
      'tasks 200': (r) => r.status === 200,
      'tasks < 1s': (r) => r.timings.duration < 1000,
    });
  });

  sleep(1);

  group('search', () => {
    const r = timed(
      'search',
      { type: 'list' },
      () => http.get(`${BASE_URL}/api/v1/search?q=МГУ&limit=10`, { headers: headers() }),
    );
    check(r, { 'search 200': (r) => r.status === 200 });
  });

  sleep(2);
}

// ============================================================
// Сценарий 2: 10 параллельных отчётов
// ============================================================
export function generateReports() {
  const types = [
    () => http.get(`${BASE_URL}/api/v1/reports/interactions?from=2025-01-01&to=2025-12-31&format=json`, { headers: headers(), tags: { type: 'report' } }),
    () => http.get(`${BASE_URL}/api/v1/reports/universities?from=2025-01-01&to=2025-12-31`, { headers: headers(), tags: { type: 'report' } }),
    () => http.get(`${BASE_URL}/api/v1/analytics/abc-xyz`, { headers: headers(), tags: { type: 'report' } }),
    () => http.get(`${BASE_URL}/api/v1/analytics/rfm`, { headers: headers(), tags: { type: 'report' } }),
    () => http.get(`${BASE_URL}/api/v1/analytics/ltv`, { headers: headers(), tags: { type: 'report' } }),
    () => http.post(`${BASE_URL}/api/v1/presentation/generate`, JSON.stringify({ from: '2025-01-01', to: '2025-12-31' }), { headers: headers(), tags: { type: 'report' } }),
  ];

  const idx = (__VU + __ITER) % types.length;
  const res = types[idx]();

  check(res, {
    'report ok': (r) => r.status === 200 || r.status === 202,
    'report < 10s': (r) => r.timings.duration < 10000,
  });
  apiErrors.add(res.status >= 500);

  sleep(3);
}

// ============================================================
// Отчёты
// ============================================================
export function handleSummary(data) {
  return {
    'load-tests/k6/report.html': htmlReport(data),
    'load-tests/k6/summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}