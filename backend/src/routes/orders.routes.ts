// backend/src/routes/orders.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { PiiService } from '../services/pii.service.js';
import { requireRole, requireMfa } from '../middleware/auth.js';
import {
  ok,
  okPaginated,
  parsePagination,
  buildPagination,
} from '../utils/response.js';
import { strictRateLimit } from '../middleware/rateLimit.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const [items, total] = await prisma.$transaction([
      prisma.order.findMany({
        skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          course: true,
          stream: true,
          learner: {
            select: {
              id: true,
              lastName: true,
              firstName: true,
              middleName: true,
            },
          },
        },
      }),
      prisma.order.count(),
    ]);
    return okPaginated(res, items, buildPagination(page, pageSize, total));
  } catch (e) { next(e); }
});

router.get('/stats', async (_req, res, next) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [totalOrders, newOrders, paidOrders, totalRevenue] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: since } } }),
      prisma.order.count({ where: { paidAt: { not: null } } }),
      prisma.order.aggregate({
        where: { paidAt: { not: null } },
        _sum: { amount: true },
      }),
    ]);

    const conversion = totalOrders > 0
      ? Math.round((paidOrders / totalOrders) * 100)
      : 0;

    return ok(res, {
      totalOrders,
      newOrdersLast30d: newOrders,
      paidOrders,
      conversionPct: conversion,
      totalRevenue: Number(totalRevenue._sum.amount ?? 0),
    });
  } catch (e) { next(e); }
});

const importBody = z.object({
  rows: z.array(z.object({
    externalId: z.string().min(1),
    courseName: z.string().min(1),
    lastName: z.string().min(1),
    firstName: z.string().min(1),
    middleName: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    streamNumber: z.coerce.number().int().min(1),
  })).min(1).max(5000),
});

router.post(
  '/import',
  requireRole('admin', 'manager'),
  requireMfa,
  strictRateLimit,
  async (req, res, next) => {
    try {
      const data = importBody.parse(req.body);
      let inserted = 0, skipped = 0, failed = 0;
      const errors: { rowIndex: number; message: string }[] = [];

      for (let i = 0; i < data.rows.length; i++) {
        const r = data.rows[i];
        try {
          const exists = await prisma.order.findUnique({
            where: { externalId: r.externalId },
            select: { id: true },
          });
          if (exists) { skipped++; continue; }

          const course = await prisma.course.upsert({
            where: { name: r.courseName },
            update: {},
            create: { name: r.courseName },
          });

          const stream = await prisma.courseStream.upsert({
            where: {
              courseId_number: { courseId: course.id, number: r.streamNumber },
            },
            update: {},
            create: { courseId: course.id, number: r.streamNumber },
          });

          const emailHash = PiiService.hashEmail(r.email);
          const phoneHash = PiiService.hashPhone(r.phone);

          let learner = emailHash
            ? await prisma.learner.findUnique({
                where: { emailHash },
                select: { id: true },
              })
            : null;
          if (!learner && phoneHash) {
            learner = await prisma.learner.findUnique({
              where: { phoneHash },
              select: { id: true },
            });
          }

          if (!learner) {
            const created = await prisma.learner.create({
              data: {
                lastName: r.lastName.trim(),
                firstName: r.firstName.trim(),
                middleName: r.middleName ?? null,
                phone: PiiService.encrypt(r.phone),
                email: PiiService.encrypt(r.email),
                phoneHash,
                emailHash,
              },
              select: { id: true },
            });
            learner = created;
          }

          await prisma.order.create({
            data: {
              externalId: r.externalId,
              courseId: course.id,
              streamId: stream.id,
              learnerId: learner.id,
            },
          });
          inserted++;
        } catch (e) {
          failed++;
          errors.push({
            rowIndex: i,
            message: e instanceof Error ? e.message : 'unknown',
          });
        }
      }

      return ok(res, { inserted, skipped, failed, errors });
    } catch (e) { next(e); }
  },
);

export default router;