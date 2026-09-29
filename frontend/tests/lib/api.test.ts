import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '@/lib/api';

vi.mock('@/lib/oidc', () => ({
  userManager: {
    getUser: vi.fn().mockResolvedValue({
      access_token: 'test-token',
      expired: false,
    }),
  },
}));

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('добавляет Authorization', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { hello: 'world' } }),
    });

    await client.get('/test');

    const callArgs = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = callArgs[1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('распаковывает { ok, data }', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: { value: 42 } }),
    });

    const result = await client.get<{ value: number }>('/test');
    expect(result.value).toBe(42);
  });

  it('бросает ApiRequestError при 4xx', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 'CRM-400-001', message: 'bad' }),
    });

    await expect(client.get('/test')).rejects.toMatchObject({
      code: 'CRM-400-001',
      status: 400,
    });
  });

  it('204 → undefined', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 204,
    });

    const result = await client.delete('/test');
    expect(result).toBeUndefined();
  });
});