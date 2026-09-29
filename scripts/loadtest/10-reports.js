// scripts/loadtest/10-reports.js
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const TOKEN = __ENV.TOKEN || '';
const TEST_USER_ID = __ENV.TEST_USER_ID || '';

const reportDuration = new Trend('report_duration', true);
const reportErrors = new Rate('report_errors');

export const options = {
  scenarios: {
    reports: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
    },
  },
  thresholds: {
    'report_duration{is_export:false}': ['p(95)<30000'],
    'report_duration{is_export:true}': ['p(95)<60000'],
    'report_errors': ['rate<0.02'],
    'http_req_failed': ['rate<0.02'],
  },
};

const headers = {
  Accept: 'application/json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  ...(TEST_USER_ID ? { 'X-Test-User-Id': TEST_USER_ID } : {}),
};

// JSON-отчёты (быстрые) + экспорт файлов (тяжёлые).
// EXPORT_ENABLED=true — добавить в прогон PDF/XLSX (требует Спринт 2).
const INCLUDE_EXPORTS = (__ENV.EXPORT_ENABLED ?? 'false') === 'true';

const jsonEndpoints = [
  { url: '/reports/dashboard-summary', name: 'dashboard', maxMs: 5000 },
  { url: '/reports/interactions?from=2026-01-01&to=2026-12-31', name: 'interactions', maxMs: 30000 },
  { url: '/analytics/abc-xyz?from=2026-01-01&to=2026-12-31', name: 'abc-xyz', maxMs: 30000 },
  { url: '/analytics/rfm', name: 'rfm', maxMs: 30000 },
  { url: '/analytics/cohorts?monthsBack=12', name: 'cohorts', maxMs: 30000 },
  { url: '/analytics/ltv', name: 'ltv', maxMs: 30000 },
  { url: '/analytics/metrics?from=2026-01-01&to=2026-12-31', name: 'metrics', maxMs: 30000 },
  { url: '/analytics/period-comparison?from=2026-01-01&to=2026-06-30&prevFrom=2025-07-01&prevTo=2025-12-31', name: 'comparison', maxMs: 30000 },
];

const exportEndpoints = [
  { url: '/reports/interactions.xlsx?from=2026-01-01&to=2026-12-31', name: 'xlsx', maxMs: 60000 },
  { url: '/reports/interactions.xls?from=2026-01-01&to=2026-12-31', name: 'xls', maxMs: 60000 },
  { url: '/reports/interactions.pdf?from=2026-01-01&to=2026-12-31', name: 'pdf', maxMs: 90000 },
];

const endpoints = INCLUDE_EXPORTS
  ? [...jsonEndpoints, ...exportEndpoints]
  : jsonEndpoints;

export default function () {
  const ep = endpoints[__ITER % endpoints.length];

  // timeout — параметр самого k6, он общий на запрос
  const res = http.get(`${BASE_URL}${ep.url}`, {
    headers,
    tags: {
      type: 'report',
      endpoint: ep.name,
      is_export: INCLUDE_EXPORTS && ep.name !== 'dashboard' &&
        !jsonEndpoints.some((j) => j.name === ep.name)
          ? 'true'
          : 'false',
    },
    timeout: `${ep.maxMs ?? 60000}ms`,
  });

  const ok = check(res, { [`${ep.name} 200`]: (r) => r.status === 200 });
  reportDuration.add(res.timings.duration);
  reportErrors.add(!ok);
}