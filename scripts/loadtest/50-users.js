// scripts/loadtest/50-users.js
//
// Нагрузочный тест: 50 параллельных пользователей, 5 минут.
// По ТЗ: система должна выдерживать 50 параллельных пользователей,
// p95 < 1 секунды.
//
// Запуск:
//   k6 run scripts/loadtest/50-users.js
//
// С авторизацией (если backend защищён):
//   BASE_URL=https://crm.example.ru TOKEN=<jwt> k6 run ...
//
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const TOKEN = __ENV.TOKEN || '';

const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');

export const options = {
  scenarios: {
    // Основной сценарий: 50 VU на 5 минут
    sustained: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      gracefulStop: '30s',
    },
    // Разгон: 0 → 50 за 30 секунд, чтобы увидеть деградацию
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '4m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      startTime: '5m',
    },
  },
  thresholds: {
    // p95 времени ответа < 1 с (ТЗ НФТ-1)
    'http_req_duration{type:api}': ['p(95)<1000'],
    // Меньше 1% ошибок
    'http_req_failed': ['rate<0.01'],
    'errors': ['rate<0.01'],
  },
  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const headers = {
  Accept: 'application/json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  // Bypass auth на dev-стенде. На проде — TOKEN и без этого заголовка.
  ...(__ENV.TEST_USER_ID ? { 'X-Test-User-Id': __ENV.TEST_USER_ID } : {}),
};

export default function () {
  group('dashboard', () => {
    const r = http.get(`${BASE_URL}/reports/dashboard-summary`, {
      headers,
      tags: { type: 'api', endpoint: 'dashboard' },
    });
    check(r, {
      'dashboard 200': (x) => x.status === 200,
    }) || errorRate.add(1);
    apiDuration.add(r.timings.duration);
  });

  group('universities-list', () => {
    const r = http.get(`${BASE_URL}/universities?pageSize=25`, {
      headers,
      tags: { type: 'api', endpoint: 'universities' },
    });
    check(r, {
      'universities 200': (x) => x.status === 200,
      'has data': (x) => x.body && x.body.length > 0,
    }) || errorRate.add(1);
    apiDuration.add(r.timings.duration);
  });

  group('tasks-list', () => {
    const r = http.get(`${BASE_URL}/tasks?pageSize=50`, {
      headers,
      tags: { type: 'api', endpoint: 'tasks' },
    });
    check(r, { 'tasks 200': (x) => x.status === 200 }) || errorRate.add(1);
    apiDuration.add(r.timings.duration);
  });

  group('interactions-list', () => {
    const r = http.get(`${BASE_URL}/interactions?pageSize=50`, {
      headers,
      tags: { type: 'api', endpoint: 'interactions' },
    });
    check(r, { 'interactions 200': (x) => x.status === 200 }) || errorRate.add(1);
    apiDuration.add(r.timings.duration);
  });

  group('reports', () => {
    const r = http.get(`${BASE_URL}/reports/interactions?from=2026-01-01&to=2026-12-31`, {
      headers,
      tags: { type: 'api', endpoint: 'reports' },
    });
    check(r, { 'reports 200': (x) => x.status === 200 }) || errorRate.add(1);
    apiDuration.add(r.timings.duration);
  });

  group('analytics', () => {
    const r = http.get(`${BASE_URL}/analytics/rfm`, {
      headers,
      tags: { type: 'api', endpoint: 'analytics' },
    });
    check(r, { 'analytics 200': (x) => x.status === 200 }) || errorRate.add(1);
    apiDuration.add(r.timings.duration);
  });

  sleep(Math.random() * 2 + 1); // 1-3 сек между итерациями
}