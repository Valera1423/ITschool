import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { ok } from '../utils/response.js';
import { AppError } from '../errors/codes.js';

const router = Router();

router.post('/universities', async (req, res, next) => {
  try {
    const { ids } = z.object({
      ids: z.array(z.string().uuid()).min(2).max(10),
    }).parse(req.body);

    const unis = await prisma.university.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: {
        directionRef: true,
        productRef: true,
        managerRef: true,
        _count: { select: { interactions: true, tasks: true, contracts: true } },
        contracts: {
          where: { deletedAt: null, status: { in: ['Согласован', 'Подписан'] } },
          select: { amount: true },
        },
        interactions: {
          where: { deletedAt: null },
          orderBy: { interactionDate: 'desc' },
          take: 1,
          select: { interactionDate: true },
        },
      },
    });

    if (unis.length < 2) throw new AppError('NOT_FOUND', 404);

    const result = unis.map((u) => ({
      id: u.id,
      name: u.name,
      city: u.city,
      direction: u.directionRef?.name ?? u.direction,
      product: u.productRef?.name ?? u.product,
      status: u.status,
      manager: u.managerRef?.fullName ?? u.manager,
      contractValue: Number(u.contractValue),
      contractsTotal: u.contracts.reduce((s, c) => s + Number(c.amount), 0),
      contractsCount: u.contracts.length,
      interactionsCount: u._count.interactions,
      openTasksCount: u._count.tasks,
      lastTouchAt: u.interactions[0]?.interactionDate ?? null,
      licenseSigned: u.licenseSigned,
      licenseExpiresAt: u.licenseExpiresAt,
      handoverStatus: u.handoverStatus,
    }));

    return ok(res, result);
  } catch (e) { next(e); }
});

export default router;