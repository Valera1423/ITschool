import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';

/**
 * Подписанный OAuth state.
 *
 * Формат: base64url(payload).base64url(hmac)
 * payload = { userId, nonce, ts }
 *
 * Секрет — OAUTH_STATE_SECRET, fallback на KEYCLOAK_CLIENT_SECRET.
 * TTL — 10 минут (защита от replay).
 */

const SECRET =
  process.env.OAUTH_STATE_SECRET ??
  process.env.KEYCLOAK_CLIENT_SECRET ??
  '';

if (!SECRET) {
  // eslint-disable-next-line no-console
  console.warn(
    '[oauth-state] OAUTH_STATE_SECRET и KEYCLOAK_CLIENT_SECRET не заданы — state будет невалиден',
  );
}

const TTL_MS = 10 * 60 * 1000;

export interface OAuthStatePayload {
  userId: string;
  nonce: string;
  ts: number;
}

export function signState(userId: string): string {
  if (!SECRET) throw new Error('OAuth state secret не задан');
  const payload: OAuthStatePayload = {
    userId,
    nonce: randomUUID(),
    ts: Date.now(),
  };
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, 'utf-8').toString('base64url');
  const sig = createHmac('sha256', SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

export function verifyState(state: string): OAuthStatePayload | null {
  if (!SECRET) return null;

  const parts = state.split('.');
  if (parts.length !== 2) return null;

  const [b64, sig] = parts;
  const expected = createHmac('sha256', SECRET).update(b64).digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(b64, 'base64url').toString('utf-8'),
    ) as OAuthStatePayload;
  } catch {
    return null;
  }

  if (typeof payload.userId !== 'string' || !payload.userId) return null;
  if (typeof payload.ts !== 'number') return null;
  if (Date.now() - payload.ts > TTL_MS) return null;

  return payload;
}