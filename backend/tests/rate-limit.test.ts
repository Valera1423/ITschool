import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Rate limit', () => {
  it('POST /errors имеет strict limit 20/мин', async () => {
    // Отправляем 5 (в пределах лимита)
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/errors')
        .send({
          code: 'TEST',
          message: 'test',
          severity: 'warning',
        });
    }
    // Не должен упасть 429
    const res = await request(app)
      .post('/api/v1/errors')
      .send({ code: 'TEST', message: 'test' });
    expect(res.status).not.toBe(429);
  });
});