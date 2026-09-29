import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: false,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],

      // Считаем покрытие только по коду приложения.
      // Файлы вне src/ (тесты, конфиги) в отчёт не попадают.
      include: ['src/**/*.{ts,tsx}'],

      // ВАЖНО: исключения ниже снимают шум от файлов, которые не имеет
      // смысла покрывать юнит-тестами. Это:
      //  - типы и генераторы (нет исполняемого кода)
      //  - точки входа (main.tsx) и Storybook-истории
      //  - page-компоненты: их правильнее покрывать E2E (Playwright)
      //  - инфраструктурные обвязки: i18n, sentry, logger
      //  - deprecated supabase и обвязки над OIDC/Auth (работают
      //    только против реального Keycloak)
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/**/types/**',
        'src/generated/**',

        // Storybook
        'src/**/*.stories.tsx',

        // Страницы — E2E-территория
        'src/pages/**',

        // Инфраструктура без логики для юнит-тестов
        'src/lib/i18n.ts',
        'src/lib/sentry.ts',
        'src/lib/logger.ts',
        'src/lib/supabase.ts',
        'src/lib/oidc.ts',
        'src/lib/auth.ts',
      ],

      // Пороги. Ниже — глобальные; выше — для "чистых" подпапок,
      // где юнит-тесты даются легко и покрытие должно быть высоким.
      thresholds: {
        global: {
          lines: 20,
          functions: 20,
          branches: 15,
          statements: 20,
        },

        // Чистая логика без React — требуем строже.
        // По мере добавления тестов эти цифры стоит поднимать.
        'src/lib/**': {
          lines: 40,
          functions: 40,
          branches: 30,
          statements: 40,
        },

        // Хуки — средний уровень: часть из них зависит от React-контекста.
        'src/hooks/**': {
          lines: 30,
          functions: 30,
          branches: 20,
          statements: 30,
        },
      },
    },
  },
});