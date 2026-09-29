import { Router } from 'express';
import { z } from 'zod';
import { PresentationService } from '../services/presentation.service.js';
import { requireRole } from '../middleware/auth.js';
import { strictRateLimit } from '../middleware/rateLimit.js';

const router = Router();

router.post('/generate', requireRole('admin', 'manager'), strictRateLimit, async (req, res, next) => {
  try {
    const { from, to } = z.object({
      from: z.string().date().optional(),
      to: z.string().date().optional(),
    }).parse(req.body);

    const buffer = await PresentationService.generate({ from, to });

    const filename = `crm-presentation-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (e) { next(e); }
});

export default router;