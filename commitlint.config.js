export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // новая фича
        'fix',      // багфикс
        'docs',     // документация
        'style',    // форматирование
        'refactor', // рефакторинг
        'perf',     // производительность
        'test',     // тесты
        'chore',    // рутина
        'ci',       // CI
        'build',    // сборка
        'revert',   // откат
      ],
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case']],
    'header-max-length': [2, 'always', 100],
  },
};