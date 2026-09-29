import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/app.js';
import { createTestUser, createTestUniversity } from '../helpers/factory.js';

const app = createTestApp();

describe('Tasks API', () => {
  it('POST /tasks — создаёт задачу с ISO-датой', async () => {
    const user = await createTestUser('manager');
    const uni = await createTestUniversity();

    const res = await request(app)
      .post('/api/v1/tasks')
      .set('X-Test-User-Id', user.id)
      .send({
        universityId: uni.id,
        title: 'Позвонить в вуз',
        status: 'К выполнению',
        priority: 'Средний',
        dueDate: '2026-10-01',
        assignee: 'Анна Кузнецова',
      })
      .expect(201);

    expect(res.body.data.title).toBe('Позвонить в вуз');
    expect(res.body.data.due_date).toBeDefined();
  });

  it('POST /tasks — 400 для неправильной даты', async () => {
    const user = await createTestUser('manager');

    const res = await request(app)
      .post('/api/v1/tasks')
      .set('X-Test-User-Id', user.id)
      .send({
        title: 'x',
        dueDate: 'not-a-date',
        assignee: 'A',
      })
      .expect(400);

    expect(res.body.ok).toBe(false);
  });

  it('PATCH /tasks/:id — завершение задачи', async () => {
    const user = await createTestUser('manager');
    const task = await request(app)
      .post('/api/v1/tasks')
      .set('X-Test-User-Id', user.id)
      .send({ title: 'Тест', dueDate: '2026-10-01', assignee: 'A' })
      .then((r) => r.body.data);

    const res = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set('X-Test-User-Id', user.id)
      .send({ status: 'Готово' })
      .expect(200);

    expect(res.body.data.status).toBe('Готово');
  });
});