import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { ok } from '../utils/response.js';

const router = Router();

/**
 * GET /reminders/due
 * Возвращает события, для которых пора показать напоминание.
 * Дедупликация — через ReminderLog.
 */
router.get('/due', async (req, res, next) => {
  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 60_000); // окно 1 минута

    const interactions = await prisma.interaction.findMany({
      where: {
        deletedAt: null,
        status: 'Запланировано',
        reminderMinutes: { not: null },
        startTime: { not: null },
        interactionDate: {
          gte: new Date(now.toISOString().slice(0, 10)),
          lte: new Date(windowEnd.toISOString().slice(0, 10)),
        },
      },
      select: {
        id: true,
        title: true,
        interactionDate: true,
        startTime: true,
        reminderMinutes: true,
      },
    });

    const due: Array<{
      id: string;
      title: string;
      start_time: string;
      minutes_before: number;
    }> = [];

    for (const ev of interactions) {
      if (!ev.startTime || !ev.reminderMinutes) continue;

      const start = new Date(
        `${ev.interactionDate.toISOString().slice(0, 10)}T${ev.startTime}`,
      );
      const remindAt = new Date(start.getTime() - ev.reminderMinutes * 60_000);

      if (remindAt >= now && remindAt <= windowEnd) {
        // Проверяем, не отправляли ли уже
        const already = await prisma.reminderLog.findUnique({
          where: {
            entityType_entityId_minutesBefore: {
              entityType: 'interaction',
              entityId: ev.id,
              minutesBefore: ev.reminderMinutes,
            },
          },
        });
        if (already) continue;

        // Записываем в лог
        await prisma.reminderLog.create({
          data: {
            entityType: 'interaction',
            entityId: ev.id,
            userId: req.auth?.profileId ?? null,
            minutesBefore: ev.reminderMinutes,
          },
        });

        due.push({
          id: ev.id,
          title: ev.title,
          start_time: ev.startTime.slice(0, 5),
          minutes_before: ev.reminderMinutes,
        });
      }
    }

    return ok(res, due);
  } catch (e) { next(e); }
});

export default router;