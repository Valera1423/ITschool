import { Router } from 'express';
import { MentionsService } from '../services/mentions.service.js';
import { ok, noContent } from '../utils/response.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) return ok(res, []);
    const onlyUnread = req.query.onlyUnread === 'true';
    const items = await MentionsService.listForUser(userId, onlyUnread);
    return ok(res, items);
  } catch (e) { next(e); }
});

router.post('/mark-read', async (req, res, next) => {
  try {
    const userId = req.auth?.profileId;
    if (!userId) return noContent(res);
    await MentionsService.markRead(userId, req.body?.ids);
    return noContent(res);
  } catch (e) { next(e); }
});

export default router;