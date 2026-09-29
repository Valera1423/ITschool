#!/usr/bin/env node
/**
 * Снимает скриншоты ключевых экранов CRM для вставки в KB-статьи.
 *
 * Запуск:
 *   node scripts/capture-kb-screenshots.mjs
 *
 * Требует:
 *   npm install --save-dev playwright
 *   npx playwright install chromium
 *
 * Требует работающий frontend + авторизованный пользователь.
 * URL и токен берутся из ENV:
 *   KB_BASE_URL=http://localhost:5173
 *   KB_TOKEN=<access_token из DevTools>
 *
 * Скриншоты кладутся в frontend/public/kb-screenshots/.
 * После — их можно использовать в seed.ts через ![](/kb-screenshots/xxx.png).
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'frontend/public/kb-screenshots');

const BASE_URL = process.env.KB_BASE_URL ?? 'http://localhost:5173';
const TOKEN = process.env.KB_TOKEN ?? '';

if (!TOKEN) {
  console.error('❌ Укажи KB_TOKEN=<access_token из DevTools → LocalStorage → oidc.user:* >');
  process.exit(1);
}

/**
 * Список экранов.
 * view — значение из ?view=..., которое понимает Router.tsx.
 */
const SHOTS = [
  { name: '01-dashboard',          view: 'dashboard',           desc: 'Дашборд менеджера' },
  { name: '02-universities-list',  view: 'universities',        desc: 'Список вузов' },
  { name: '03-university-detail',  view: 'universities',        desc: 'Карточка вуза (открывается кликом)' },
  { name: '04-interactions',       view: 'interactions',        desc: 'Журнал взаимодействий' },
  { name: '05-calendar',           view: 'calendar',            desc: 'Календарь' },
  { name: '06-tasks',              view: 'tasks',               desc: 'Задачи' },
  { name: '07-kanban',             view: 'kanban',              desc: 'Канбан' },
  { name: '08-workflows',          view: 'workflows',           desc: 'Workflow' },
  { name: '09-analytics',          view: 'analytics',           desc: 'Аналитика' },
  { name: '10-reports',            view: 'reports',             desc: 'Отчёты' },
  { name: '11-knowledge',          view: 'knowledge',           desc: 'База знаний' },
  { name: '12-settings',           view: 'settings',            desc: 'Настройки профиля' },
  { name: '13-security',           view: 'security',            desc: 'Безопасность' },
  { name: '14-catalogs',           view: 'catalogs',            desc: 'Каталоги' },
  { name: '15-custom-roles',       view: 'custom-roles',        desc: 'Кастомные роли' },
];

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  // Пробрасываем токен в localStorage
  await ctx.addInitScript((token) => {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('oidc.user:'));
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const u = JSON.parse(raw);
          u.access_token = token;
          u.expires_at = Math.floor(Date.now() / 1000) + 3600;
          u.expired = false;
          localStorage.setItem(key, JSON.stringify(u));
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, TOKEN);

  const page = await ctx.newPage();

  // Первый заход на корень — устанавливает OIDC-сессию (по переданному токену)
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  for (const shot of SHOTS) {
    console.log(`📸 ${shot.name} — ${shot.desc}`);
    await page.goto(`${BASE_URL}/?view=${shot.view}`, { waitUntil: 'networkidle' });

    // Ждём затухания анимаций и загрузки данных
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: join(OUT, `${shot.name}.png`),
      fullPage: false,
    });
  }

  await browser.close();
  console.log(`\n✅ Скриншоты готовы: ${OUT}`);
  console.log('\nИспользование в seed.ts:');
  console.log('  content: "... ![](/kb-screenshots/01-dashboard.png) ..."');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});