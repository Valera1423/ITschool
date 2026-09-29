import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/app.js';
import { createTestUser, createTestUniversity, createTestManager } from '../helpers/factory.js';

const app = createTestApp();

describe('Universities API', () => {
  it('GET /universities — возвращает список', async () => {
    const user = await createTestUser('admin');
    await createTestUniversity({ name: 'МФТИ' });
    await createTestUniversity({ name: 'МГУ' });

    const res = await request(app)
      .get('/api/v1/universities')
      .set('X-Test-User-Id', user.id)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    // Проверяем snake_case сериализацию
    expect(res.body.data[0]).toHaveProperty('created_at');
    expect(res.body.data[0]).toHaveProperty('contract_value');
  });

  it('POST /universities — создаёт вуз', async () => {
    const user = await createTestUser('admin');

    const res = await request(app)
      .post('/api/v1/universities')
      .set('X-Test-User-Id', user.id)
      .send({
        name: 'СПбГУ',
        city: 'Санкт-Петербург',
        status: 'Новый',
      })
      .expect(201);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.name).toBe('СПбГУ');
    expect(res.body.data.city).toBe('Санкт-Петербург');
  });

  it('POST /universities — 400 без name', async () => {
    const user = await createTestUser('admin');

    const res = await request(app)
      .post('/api/v1/universities')
      .set('X-Test-User-Id', user.id)
      .send({ city: 'Москва' })
      .expect(400);

    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe('CRM-400-001');
  });

  it('PATCH /universities/:id — обновляет', async () => {
    const user = await createTestUser('manager');
    const uni = await createTestUniversity({ name: 'НГУ', status: 'Новый' });

    const res = await request(app)
      .patch(`/api/v1/universities/${uni.id}`)
      .set('X-Test-User-Id', user.id)
      .send({ status: 'Переговоры' })
      .expect(200);

    expect(res.body.data.status).toBe('Переговоры');
  });

  it('DELETE /universities/:id — soft delete', async () => {
    const user = await createTestUser('admin');
    const uni = await createTestUniversity({ name: 'УрФУ' });

    await request(app)
      .delete(`/api/v1/universities/${uni.id}`)
      .set('X-Test-User-Id', user.id)
      .expect(204);

    // После удаления не находится
    const res = await request(app)
      .get(`/api/v1/universities/${uni.id}`)
      .set('X-Test-User-Id', user.id)
      .expect(404);

    expect(res.body.code).toBe('CRM-404-002');
  });

  it('bulk assign_manager — роль nam получает 403', async () => {
    const user = await createTestUser('nam');
    const uni = await createTestUniversity();
    const manager = await createTestManager('Иван Петров');

    const res = await request(app)
      .post('/api/v1/universities/bulk')
      .set('X-Test-User-Id', user.id)
      .send({
        ids: [uni.id],
        action: 'assign_manager',
        managerId: manager.id,
      })
      .expect(403);

    expect(res.body.code).toBe('CRM-403-003');
  });

  it('audit log пишется при создании', async () => {
    const user = await createTestUser('admin');

    await request(app)
      .post('/api/v1/universities')
      .set('X-Test-User-Id', user.id)
      .send({ name: 'Audit Test' })
      .expect(201);

    // Проверяем, что audit записан
    const { prisma } = await import('../../src/db/prisma.js');
    const logs = await prisma.auditLog.findMany({
      where: { entity: 'universities', action: 'insert' },
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].userEmail).toBe(user.email);
  });

  it('401 без X-Test-User-Id', async () => {
    await request(app)
      .get('/api/v1/universities')
      .expect(401);
  });

  it('pagination: pageSize учитывается', async () => {
    const user = await createTestUser('admin');
    for (let i = 0; i < 5; i++) {
      await createTestUniversity({ name: `Вуз ${i}` });
    }

    const res = await request(app)
      .get('/api/v1/universities?page=1&pageSize=2')
      .set('X-Test-User-Id', user.id)
      .expect(200);

    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.total).toBe(5);
    expect(res.body.pagination.totalPages).toBe(3);
  });
});