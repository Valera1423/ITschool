// backend/src/routes/google.routes.ts
import { Router } from 'express';
import { GoogleService } from '../services/google.service.js';
import { ok, noContent } from '../utils/response.js';
import { AppError } from '../errors/codes.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { strictRateLimit } from '../middleware/rateLimit.js';
import { signState, verifyState } from '../services/oauth-state.service.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const router = Router();

/**
 * GET /google/authorize
 * Редирект на Google OAuth consent с ПОДПИСАННЫМ state.
 * Обёрнут локальным authenticate — /callback публичный, но /authorize
 * требует авторизации (нужен userId для state).
 */
router.get('/authorize', authenticate, (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) throw new AppError('UNAUTHORIZED', 401);

    const state = signState(userId);
    const url = GoogleService.getAuthUrl(state);
    return res.redirect(url);
  } catch (e) { next(e); }
});

/**
 * GET /google/callback?code=...&state=...
 *
 * Google редиректит сюда. Здесь НЕТ authenticate — Google не пришлёт JWT.
 * Пользователь извлекается ТОЛЬКО из подписанного state.
 *
 * ЕДИНСТВЕННЫЙ обработчик callback'а. Раньше был ещё google-public.routes.ts,
 * который принимал state как сырой userId — это OAuth CSRF. Удалён.
 */
router.get('/callback', async (req, res, next) => {
  const frontendUrl = env.APP_URL ?? 'http://localhost:5173';

  try {
    const code = String(req.query.code ?? '');
    const stateRaw = String(req.query.state ?? '');

    if (!code || !stateRaw) {
      return res.redirect(`${frontendUrl}/settings?google=error&reason=missing_params`);
    }

    // КРИТИЧНО: проверяем HMAC-подпись state
    const state = verifyState(stateRaw);
    if (!state) {
      logger.warn(
        { hasState: !!stateRaw, len: stateRaw.length },
        'Google OAuth callback: невалидный или просроченный state',
      );
      return res.redirect(`${frontendUrl}/settings?google=error&reason=invalid_state`);
    }

    const result = await GoogleService.exchangeCode(code, state.userId, '');

    const params = new URLSearchParams({
      google: 'connected',
      email: result.email ?? '',
    });
    return res.redirect(`${frontendUrl}/settings?${params.toString()}`);
  } catch (e) {
    logger.error({ err: e }, 'Google OAuth callback failed');
    return res.redirect(`${frontendUrl}/settings?google=error`);
  }
});

/**
 * GET /google/connection
 */
router.get('/connection', authenticate, async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) return ok(res, null);
    const info = await GoogleService.getConnection(userId);
    return ok(res, info);
  } catch (e) { next(e); }
});

/**
 * DELETE /google/connection
 */
router.delete('/connection', authenticate, async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) return noContent(res);
    await GoogleService.disconnect(userId);
    return noContent(res);
  } catch (e) { next(e); }
});

/**
 * POST /google/sync
 */
router.post('/sync', authenticate, strictRateLimit, async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) throw new AppError('UNAUTHORIZED', 401);
    const result = await GoogleService.syncAll(userId);
    return ok(res, result);
  } catch (e) { next(e); }
});

/**
 * POST /google/push/:interactionId
 */
router.post(
  '/push/:interactionId',
  authenticate,
  requireRole('admin', 'manager', 'nam'),
  async (req, res, next) => {
    try {
      const userId = req.auth?.profileId;
      if (!userId) throw new AppError('UNAUTHORIZED', 401);
      const result = await GoogleService.pushEvent({
        userId,
        interactionId: req.params.interactionId,
      });
      return ok(res, result);
    } catch (e) { next(e); }
  },
);

export default router;