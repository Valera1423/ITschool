import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/app.js';
import { createTestUser } from '../helpers/factory.js';

const app = createTestApp();

describe('Idempotency', () => {
  it('второй POST с тем же Idempotency-Key возвращает тот же ответ', async () => {
    const user = await createTestUser('admin');
    const key = 'test-idem-' + Date.now();

    const res1 = await request(app)
      .post('/api/v1/universities')
      .set('X-Test-User-Id', user.id)
      .set('Idempotency-Key', key)
      .send({ name: 'Idem Vuz' })
      .expect(201);

    const res2 = await request(app)
      .post('/api/v1/universities')
      .set('X-Test-User-Id', user.id)
      .set('Idempotency-Key', key)
      .send({ name: 'Idem Vuz' })
      .expect(201);

    expect(res1.body.data.id).toBe(res2.body.data.id);
  });
});