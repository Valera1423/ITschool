import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Health', () => {
  it('GET /health/live возвращает 200', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /health/ready возвращает checks', async () => {
    const res = await request(app).get('/health/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('checks');
    expect(res.body.checks).toHaveProperty('database');
    expect(res.body.checks).toHaveProperty('redis');
  });
});