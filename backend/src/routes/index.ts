// backend/src/routes/index.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { loadFeatureFlags } from '../middleware/feature-flags.js';
import { userActivity } from '../middleware/user-activity.js';
import { cacheResponse } from '../middleware/cache.js';
import { globalRateLimit } from '../middleware/rateLimit.js';

// ============================================================
// Публичные (без authenticate)
// ============================================================
import authRoutes from './auth.routes.js';
import errorsRoutes from './errors.routes.js';
import webhooksRoutes from './webhooks.routes.js';
import edoWebhooksRoutes from './edo-webhooks.routes.js';
import publicReportsPublicRoutes from './public-reports-public.routes.js';
import googleRoutes from './google.routes.js';
import aiRoutes from './ai.routes.js';
import dashboardsRoutes from './dashboards.routes.js';
import learnersRoutes from './learners.routes.js';
import ordersRoutes from './orders.routes.js';

// ============================================================
// Под auth
// ============================================================
import usersRoutes from './users.routes.js';
import userScopesRoutes from './user-scopes.routes.js';
import universitiesRoutes from './universities.routes.js';
import interactionsRoutes from './interactions.routes.js';
import tasksRoutes from './tasks.routes.js';
import commentsRoutes from './comments.routes.js';
import workflowsRoutes from './workflows.routes.js';
import workflowStepsRoutes from './workflow-steps.routes.js';
import contractsRoutes from './contracts.routes.js';
import segmentsRoutes from './segments.routes.js';
import catalogsRoutes from './catalogs.routes.js';
import callsRoutes from './calls.routes.js';
import settingsRoutes from './settings.routes.js';
import notificationsRoutes from './notifications.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import userPreferencesRoutes from './user-preferences.routes.js';
import remindersRoutes from './reminders.routes.js';
import pushRoutes from './push.routes.js';
import securityRoutes from './security.routes.js';
import analyticsRoutes from './analytics.routes.js';
import reportsRoutes from './reports.routes.js';
import knowledgeRoutes from './knowledge.routes.js';
import dashboardsRoutes from './dashboards.routes.js';
import auditRoutes from './audit.routes.js';
import integrationsRoutes from './integrations.routes.js';
import storageRoutes from './storage.routes.js';
import customFieldsRoutes from './custom-fields.routes.js';
import savedViewsRoutes from './saved-views.routes.js';
import tagsRoutes from './tags.routes.js';
import inboxRoutes from './inbox.routes.js';
import automationRoutes from './automation.routes.js';
import versionsRoutes from './versions.routes.js';
import mentionsRoutes from './mentions.routes.js';
import smartHintsRoutes from './smart-hints.routes.js';
import excelSyncRoutes from './excel-sync.routes.js';
import jobsRoutes from './jobs.routes.js';
import smsRoutes from './sms.routes.js';
import publicReportsRoutes from './public-reports.routes.js';
import presentationRoutes from './presentation.routes.js';
import compareRoutes from './compare.routes.js';
import ganttRoutes from './gantt.routes.js';
import searchRoutes from './search.routes.js';
import edoRoutes from './edo.routes.js';
import featureFlagsRoutes from './feature-flags.routes.js';
import abRoutes from './ab.routes.js';
import exportsRoutes from './exports.routes.js';
import customRolesRoutes from './custom-roles.routes.js';
import healthRoutes from './health.routes.js';
import systemRoutes from './system.routes.js';
import aiRoutes from './ai.routes.js';
import enterpriseRoutes from './enterprise.routes.js';


const router = Router();

// ============================================================
// Публичные (без authenticate)
// ============================================================
router.use('/auth', authRoutes);
router.use('/errors', errorsRoutes);
router.use('/webhooks', webhooksRoutes);

// Google монтируется ДО authenticate (внутри /callback — публичный)
router.use('/google', googleRoutes);

router.use('/edo/webhooks', edoWebhooksRoutes);
router.use('/public-reports', publicReportsPublicRoutes);

// ============================================================
// Всё ниже — под auth
// ============================================================
router.use(authenticate);
router.use(loadFeatureFlags);
router.use(userActivity);

// ============================================================
// Rate-limit ПОСЛЕ authenticate — теперь лимит по пользователю,
// а не по IP (req.auth уже заполнен).
//
// ВАЖНО: этот middleware должен вызываться только для приватных
// роутов. Публичные (/auth, /webhooks, /google, /edo/webhooks,
// /public-reports) выше — их ограничивают свои точечные лимиты.
// ============================================================
router.use(globalRateLimit);

// ============================================================
// Мониторинг (под auth, без спецролей)
//
// `/ws-stats` — снимок состояния WebSocket-сервиса. Доступен любому
// авторизованному пользователю. Если нужно закрыть только для admin —
// оберни `requireRole('admin')` на уровне health.routes.ts.
// ============================================================
router.use(healthRoutes);

// ============================================================
// Кеширование GET-ответов (Redis, per-user)
// ============================================================
router.use('/catalogs', cacheResponse({ ttl: 300 }), catalogsRoutes);
router.use('/tags', cacheResponse({ ttl: 300 }), tagsRoutes);

// ============================================================
// Остальные роуты — без кеша
// ============================================================
router.use('/users', usersRoutes);
router.use('/user-scopes', userScopesRoutes);
router.use('/custom-roles', customRolesRoutes);
router.use('/universities', universitiesRoutes);
router.use('/interactions', interactionsRoutes);
router.use('/tasks', tasksRoutes);
router.use('/comments', commentsRoutes);
router.use('/workflows', workflowsRoutes);
router.use('/workflow-steps', workflowStepsRoutes);
router.use('/contracts', contractsRoutes);
router.use('/segments', segmentsRoutes);
router.use('/calls', callsRoutes);
router.use('/settings', settingsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/user-preferences', userPreferencesRoutes);
router.use('/reminders', remindersRoutes);
router.use('/push', pushRoutes);
router.use('/security', securityRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/reports', reportsRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/dashboards', dashboardsRoutes);
router.use('/audit', auditRoutes);
router.use('/integrations', integrationsRoutes);
router.use('/storage', storageRoutes);
router.use('/custom-fields', customFieldsRoutes);
router.use('/saved-views', savedViewsRoutes);
router.use('/inbox', inboxRoutes);
router.use('/automation', automationRoutes);
router.use('/versions', versionsRoutes);
router.use('/mentions', mentionsRoutes);
router.use('/smart-hints', smartHintsRoutes);
router.use('/excel-sync', excelSyncRoutes);
router.use('/jobs', jobsRoutes);
router.use('/sms', smsRoutes);
router.use('/public-reports', publicReportsRoutes);
router.use('/presentation', presentationRoutes);
router.use('/compare', compareRoutes);
router.use('/gantt', ganttRoutes);
router.use('/search', searchRoutes);
router.use('/edo', edoRoutes);
router.use('/feature-flags', featureFlagsRoutes);
router.use('/ab', abRoutes);
router.use('/exports', exportsRoutes);
router.use('/ai', aiRoutes);
router.use('/system', systemRoutes);
router.use('/dashboards', dashboardsRoutes); 
router.use('/ai', aiRoutes);
router.use('/enterprise', enterpriseRoutes);
router.use('/learners', learnersRoutes);
router.use('/orders', ordersRoutes);

export default router;