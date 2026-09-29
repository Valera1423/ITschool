// backend/src/services/ws.service.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../db/prisma.js';
import {
  wsClientsTotal,
  wsClientsAuthed,
  wsBroadcastTotal,
  wsBroadcastDroppedTotal,
} from '../config/metrics.js';

interface Client {
  ws: WebSocket;
  userId: string | null;
  email: string | null;
  role: 'admin' | 'manager' | 'nam' | null;
  /** Сущности, на которые подписан: universities, tasks, ... */
  subscriptions: Set<string>;
  /** ID вузов, к которым есть доступ (для nam) */
  scopeUniversityIds: Set<string>;
  /** Флаг, чтобы не декрементить метрики при повторном cleanup */
  cleaned: boolean;
}

const JWKS_URL = `${env.KEYCLOAK_URL}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/certs`;
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

export interface WsEvent {
  type: string;
  entity?: string;
  entityId?: string;
  actor?: string;
  /** Доп. данные события */
  payload?: Record<string, unknown>;
  /** Если указан — событие уйдёт только этому пользователю */
  targetUserId?: string | null;
  /** Если указан — событие уйдёт только пользователям, у кого в scope есть этот вуз */
  scopeUniversityId?: string;
}

export class WsService {
  private static wss: WebSocketServer | null = null;
  private static clients = new Set<Client>();

  static attach(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

    this.wss.on('connection', async (ws, req) => {
      const url = new URL(req.url ?? '', 'http://localhost');
      const token = url.searchParams.get('token');

      let userId: string | null = null;
      let email: string | null = null;
      let role: 'admin' | 'manager' | 'nam' | null = null;
      const scopeUniversityIds = new Set<string>();

      if (token) {
        try {
          const { payload } = await jwtVerify(token, jwks, {
            issuer: env.JWT_ISSUER,
          });
          const sub = String(payload.sub ?? '') || null;

          // Ищем профиль по keycloakSub / id / email
          const profile = sub
            ? await prisma.profile.findFirst({
                where: { OR: [{ keycloakSub: sub }, { id: sub }] },
                select: { id: true, email: true, role: true, blocked: true },
              })
            : null;

          if (profile && !profile.blocked) {
            userId = profile.id;
            email = profile.email;
            role = profile.role as typeof role;

            // Предзагрузка scope: id вузов, доступных пользователю
            if (role === 'nam') {
              const userScopes = await prisma.userScope.findMany({
                where: { userId: profile.id, entity: 'universities' },
                select: { filter: true },
              });
              const explicit = userScopes[0]?.filter as Record<string, unknown> | undefined;

              const where: Record<string, unknown> = { deletedAt: null };
              if (explicit && Object.keys(explicit).length > 0) {
                Object.assign(where, explicit);
              } else {
                // Автоправило: managerRef.profileId ИЛИ manager = fullName
                const p = await prisma.profile.findUnique({
                  where: { id: profile.id },
                  select: { fullName: true },
                });
                const or: Record<string, unknown>[] = [
                  { managerRef: { profileId: profile.id } },
                ];
                if (p?.fullName) or.push({ manager: p.fullName });
                where.OR = or;
              }

              const ids = await prisma.university.findMany({
                where,
                select: { id: true },
              });
              ids.forEach((u) => scopeUniversityIds.add(u.id));
            }
          }
        } catch (e) {
          logger.warn({ err: e }, 'WS: JWT verification failed');
        }
      }

      const client: Client = {
        ws,
        userId,
        email,
        role,
        subscriptions: new Set(['*']), // по умолчанию — все
        scopeUniversityIds,
        cleaned: false,
      };
      this.clients.add(client);

      // Метрики: обновляем gauges после добавления клиента.
      // `set` вместо `inc` — потому что Gauge, и это снимает
      // любые риски рассинхронизации при race между connect/close.
      wsClientsTotal.set(this.clients.size);
      if (client.userId) {
        wsClientsAuthed.inc();
      }

      ws.send(JSON.stringify({
        type: 'connected',
        at: Date.now(),
        userId,
        role,
        scope: scopeUniversityIds.size,
      }));

      // Обработка сообщений клиента
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as {
            type?: string;
            entities?: string[];
          };
          if (msg.type === 'subscribe' && Array.isArray(msg.entities)) {
            client.subscriptions = new Set(msg.entities);
          } else if (msg.type === 'subscribe_all') {
            client.subscriptions = new Set(['*']);
          } else if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', at: Date.now() }));
          }
        } catch {
          // ignore
        }
      });

      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', at: Date.now() }));
        }
      }, 30_000);

      const cleanup = () => {
        // Защита от двойного вызова: и 'close', и 'error' могут сработать
        // на одном и том же сокете. Флаг `cleaned` гарантирует, что
        // метрики и Set будут тронуты ровно один раз.
        if (client.cleaned) return;
        client.cleaned = true;

        clearInterval(pingInterval);
        const removed = this.clients.delete(client);

        if (removed) {
          wsClientsTotal.set(this.clients.size);
          if (client.userId) {
            wsClientsAuthed.dec();
          }
        }
      };
      ws.on('close', cleanup);
      ws.on('error', cleanup);
    });

    logger.info('✓ WebSocket сервер запущен на /ws');
  }

  /**
   * Broadcast события.
   *
   * Правила видимости:
   * 1. targetUserId — только этому пользователю
   * 2. scopeUniversityId — только тем, у кого этот вуз в scope
   * 3. entity в subscriptions клиента (или '*')
   * 4. admin/manager видят всё (кроме targetUserId-фильтра)
   */
  static broadcast(event: WsEvent): void {
    if (!this.wss) return;

    const msg = JSON.stringify({ ...event, at: Date.now() });
    let sent = 0;
    let targeted = 0;

    for (const client of this.clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;

      // targetUserId — приоритетный фильтр
      if (event.targetUserId !== undefined) {
        if (event.targetUserId && client.userId !== event.targetUserId) continue;
      }

      // scopeUniversityId — ограничение для nam
      if (event.scopeUniversityId && client.role === 'nam') {
        if (!client.scopeUniversityIds.has(event.scopeUniversityId)) continue;
      }

      // entity-подписка
      if (
        event.entity &&
        !client.subscriptions.has('*') &&
        !client.subscriptions.has(event.entity)
      ) {
        continue;
      }

      targeted++;

      try {
        client.ws.send(msg);
        sent++;
      } catch (e) {
        logger.warn({ err: e }, 'WS send failed');
        wsBroadcastDroppedTotal.inc({ reason: 'send-failed' });
      }
    }

    // Общая метрика по всем broadcast-ам
    wsBroadcastTotal.inc({ type: event.type });

    // Если был targetUserId, но ни один сокет этого пользователя
    // не подошёл (например, он офлайн или на другом устройстве) —
    // фиксируем. Для обычного broadcast (targetUserId === undefined)
    // это не считаем, чтобы не шуметь на каждый event.
    if (event.targetUserId && targeted === 0) {
      wsBroadcastDroppedTotal.inc({ reason: 'no-target' });
    }

    if (sent > 0) {
      logger.debug({ type: event.type, entity: event.entity, sent }, 'WS broadcast');
    }
  }

  static stats(): {
    total: number;
    authed: number;
    byRole: Record<string, number>;
  } {
    const byRole: Record<string, number> = {};
    let authed = 0;
    for (const c of this.clients) {
      if (c.userId) authed++;
      if (c.role) byRole[c.role] = (byRole[c.role] ?? 0) + 1;
    }
    return { total: this.clients.size, authed, byRole };
  }

  static async close(): Promise<void> {
    if (!this.wss) return;
    await new Promise<void>((resolve) => this.wss!.close(() => resolve()));
    this.wss = null;
    this.clients.clear();

    // Полный сброс gauges — при graceful shutdown они должны
    // вернуться к нулю, чтобы не «висеть» после рестарта.
    wsClientsTotal.set(0);
    wsClientsAuthed.set(0);
  }
}