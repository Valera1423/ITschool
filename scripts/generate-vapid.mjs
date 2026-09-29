#!/usr/bin/env node
/**
 * Генерация VAPID-ключей для Web Push.
 *
 * Запуск: npm run vapid
 *   (см. scripts в корневом package.json)
 *
 * Что делать с выводом:
 *   1. Скопировать VITE_VAPID_PUBLIC_KEY в frontend/.env.local
 *   2. Скопировать VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY в .env (корень)
 *      — они попадут в docker-compose.prod.yml → backend → push
 *   3. VAPID_SUBJECT — контактный email администратора (mailto:)
 *
 * ⚠️  Приватный ключ никому не показывать и не коммитить!
 *
 * Зависимость web-push установлена в backend/workspace, а не в корне.
 * Резолвим её через createRequire, чтобы не дублировать пакет.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ------------------------------------------------------------------
// Резолвим web-push: сначала backend, потом frontend, потом корень
// ------------------------------------------------------------------
function loadWebPush() {
  const candidates = [
    join(ROOT, 'backend', 'package.json'),
    join(ROOT, 'frontend', 'package.json'),
    join(ROOT, 'package.json'),
  ];

  for (const pkgPath of candidates) {
    if (!existsSync(pkgPath)) continue;
    try {
      const require = createRequire(pkgPath);
      return require('web-push');
    } catch {
      // пробуем следующий
    }
  }

  // Fallback: возможно, установлен глобально / в NODE_PATH
  try {
    const require = createRequire(import.meta.url);
    return require('web-push');
  } catch {
    return null;
  }
}

const webpush = loadWebPush();

if (!webpush) {
  console.error('');
  console.error('❌ Пакет web-push не найден.');
  console.error('');
  console.error('Установи его в backend:');
  console.error('  npm install web-push --workspace=backend');
  console.error('');
  console.error('Или в корне:');
  console.error('  npm install --save-dev web-push');
  console.error('');
  process.exit(1);
}

// ------------------------------------------------------------------
// Генерация
// ------------------------------------------------------------------
let keys;
try {
  keys = webpush.generateVAPIDKeys();
} catch (e) {
  console.error('❌ Не удалось сгенерировать ключи:', e.message);
  process.exit(1);
}

if (!keys?.publicKey || !keys?.privateKey) {
  console.error('❌ web-push вернул пустые ключи. Проверь версию пакета.');
  process.exit(1);
}

// ------------------------------------------------------------------
// Вывод
// ------------------------------------------------------------------
console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('  VAPID-ключи сгенерированы');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('1) Добавь в frontend/.env.local:');
console.log('');
console.log(`   VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log('');
console.log('2) Добавь в корневой .env (для backend):');
console.log('');
console.log(`   VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`   VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`   VAPID_SUBJECT=mailto:admin@rt.ru`);
console.log('');
console.log('3) Для прода — скопируй те же значения в .env на сервере.');
console.log('');
console.log('⚠️  ПРИВАТНЫЙ КЛЮЧ НИКОМУ НЕ ПОКАЗЫВАЙ И НЕ КОММИТЬ!');
console.log('═══════════════════════════════════════════════════════');
console.log('');