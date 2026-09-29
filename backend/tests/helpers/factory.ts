import { prisma } from '../../src/db/prisma.js';
import { randomUUID } from 'node:crypto';

export async function createTestUser(role: 'admin' | 'manager' | 'nam' = 'admin', overrides: Partial<{
  email: string;
  fullName: string;
}> = {}) {
  const id = randomUUID();
  return prisma.profile.create({
    data: {
      id,
      email: overrides.email ?? `test-${role}-${id.slice(0, 6)}@rt.ru`,
      fullName: overrides.fullName ?? `Test ${role}`,
      role,
      keycloakSub: id,
      blocked: false,
    },
  });
}

export async function createTestUniversity(overrides: Partial<{
  name: string;
  status: string;
  city: string;
  manager: string;
}> = {}) {
  return prisma.university.create({
    data: {
      name: overrides.name ?? `Вуз ${randomUUID().slice(0, 6)}`,
      status: overrides.status ?? 'Новый',
      city: overrides.city ?? 'Москва',
      manager: overrides.manager ?? 'Анна Кузнецова',
    },
  });
}

export async function createTestManager(fullName = 'Анна Кузнецова') {
  return prisma.manager.upsert({
    where: { fullName },
    update: {},
    create: { fullName, active: true },
  });
}