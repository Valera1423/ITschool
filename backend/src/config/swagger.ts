import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env.js';

/**
 * OpenAPI 3.0 спецификация.
 * Все routes/*.ts содержат JSDoc-комментарии с @openapi,
 * здесь задаётся общая конфигурация и схемы.
 */
export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'ИТ Школа Ростелеком · CRM API',
      version: '1.0.0',
      description: `
REST API для CRM системы контроля и обработки статистических данных
по обучению студентов ВУЗов и школ по ИТ-направлениям.

**Авторизация:** Bearer JWT из Keycloak (OIDC).

**Роли:**
- \`admin\` — Администратор платформы
- \`manager\` — Руководитель (может назначать ответственных)
- \`nam\` — Пользователь (НАМ, менеджер по вузам)

**Форматы экспорта:** XLS, XLSX, CSV, PDF, JSON.
      `.trim(),
      contact: {
        name: 'ИТ Школа Ростелеком',
        url: 'https://rt.ru',
        email: 'admin@rt.ru',
      },
      license: {
        name: 'Proprietary',
        url: 'https://rt.ru/license',
      },
    },
    servers: [
      {
        url: `${env.API_BASE_URL}/api/v1`,
        description: env.NODE_ENV === 'production' ? 'Production' : 'Development',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Токен из Keycloak OIDC',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['ok', 'code', 'message'],
          properties: {
            ok: { type: 'boolean', example: false },
            code: {
              type: 'string',
              example: 'CRM-400-001',
              description: 'Машиночитаемый код ошибки',
            },
            message: { type: 'string', example: 'Ошибка валидации' },
            details: { type: 'object', nullable: true },
            requestId: { type: 'string', format: 'uuid' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            pageSize: { type: 'integer', example: 25 },
            total: { type: 'integer', example: 137 },
            totalPages: { type: 'integer', example: 6 },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: true },
            data: { type: 'object' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: true },
            data: { type: 'array', items: { type: 'object' } },
            pagination: { $ref: '#/components/schemas/Pagination' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Аутентификация и профиль пользователя' },
      { name: 'Users', description: 'Управление пользователями (админ)' },
      { name: 'Universities', description: 'Вузы — карточки, контакты, теги' },
      { name: 'Interactions', description: 'Взаимодействия — звонки, встречи, письма' },
      { name: 'Tasks', description: 'Задачи и напоминания' },
      { name: 'Workflows', description: 'Workflow и переходы между статусами' },
      { name: 'Contracts', description: 'Договоры и согласования' },
      { name: 'Segments', description: 'Умные сегменты' },
      { name: 'Catalogs', description: 'Справочники: вендоры, направления, продукты, ответственные, статусы' },
      { name: 'Analytics', description: 'Аналитика: ABC/XYZ, RFM, когорты, LTV' },
      { name: 'Reports', description: 'Отчёты за период' },
      { name: 'Knowledge', description: 'База знаний' },
      { name: 'Dashboards', description: 'Пользовательские дашборды' },
      { name: 'Audit', description: 'Аудит и безопасность' },
      { name: 'Integrations', description: 'Внешние интеграции: LMS, Laravel CMS и др.' },
      { name: 'Storage', description: 'Файловое хранилище (MinIO)' },
    ],
  },
  apis: [
    './src/routes/*.ts',
  ],
});