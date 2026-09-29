import { google } from 'googleapis';
import { prisma } from '../db/prisma.js';
import { logger } from '../config/logger.js';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:4000/api/v1/google/callback';

function createOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export class GoogleService {
  static getAuthUrl(state?: string): string {
    if (!CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID не задан');
    const oauth = createOAuth2Client();
    return oauth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
    });
  }

  static async exchangeCode(code: string, userId: string, _email: string) {
    const oauth = createOAuth2Client();
    const { tokens } = await oauth.getToken(code);
    oauth.setCredentials(tokens);

    let googleEmail: string | null = null;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth });
      const me = await oauth2.userinfo.get();
      googleEmail = me.data.email ?? null;
    } catch {
      /* ignore */
    }

    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

    // ВАЖНО: не перезаписываем refreshToken на null при повторной авторизации.
    // Google возвращает refresh_token только при первом consent.
    await prisma.googleOAuthToken.upsert({
      where: { userId },
      update: {
        accessToken: tokens.access_token ?? '',
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiresAt,
        scope: tokens.scope ?? null,
        email: googleEmail,
      },
      create: {
        userId,
        accessToken: tokens.access_token ?? '',
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        scope: tokens.scope ?? null,
        email: googleEmail,
      },
    });

    return { email: googleEmail, scope: tokens.scope };
  }

  static async getConnection(userId: string) {
    const token = await prisma.googleOAuthToken.findUnique({ where: { userId } });
    if (!token) return null;
    // Не отдаём токены наружу
    const { refreshToken: _r, accessToken: _a, syncToken: _s, ...safe } = token;
    void _r; void _a; void _s;
    return safe;
  }

  static async disconnect(userId: string) {
    await prisma.googleOAuthToken.deleteMany({ where: { userId } });
  }

  private static async getAuthorizedClient(userId: string) {
    const token = await prisma.googleOAuthToken.findUnique({ where: { userId } });
    if (!token) return null;

    const oauth = createOAuth2Client();
    oauth.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken ?? undefined,
      expiry_date: token.expiresAt?.getTime(),
    });

    oauth.on('tokens', async (tokens) => {
      try {
        await prisma.googleOAuthToken.update({
          where: { userId },
          data: {
            ...(tokens.access_token ? { accessToken: tokens.access_token } : {}),
            ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
            ...(tokens.expiry_date ? { expiresAt: new Date(tokens.expiry_date) } : {}),
          },
        });
      } catch (e) {
        logger.warn({ err: e }, 'Не удалось сохранить обновлённый Google token');
      }
    });

    return { oauth, token };
  }

  static async pushEvent(params: {
    userId: string;
    interactionId: string;
  }): Promise<{ ok: boolean; eventId?: string; error?: string }> {
    const auth = await this.getAuthorizedClient(params.userId);
    if (!auth) return { ok: false, error: 'Google не подключён' };

    const interaction = await prisma.interaction.findUnique({
      where: { id: params.interactionId },
      include: { university: { select: { name: true } } },
    });
    if (!interaction) return { ok: false, error: 'Interaction не найден' };

    const calendar = google.calendar({ version: 'v3', auth: auth.oauth });

    const dateStr = interaction.interactionDate.toISOString().slice(0, 10);
    const startTime = interaction.startTime ?? '09:00';
    const endTime = interaction.endTime ?? '10:00';
    const startIso = `${dateStr}T${startTime}:00`;
    const endIso = `${dateStr}T${endTime}:00`;

    const attendeesRaw = Array.isArray(interaction.attendees)
      ? (interaction.attendees as string[])
      : [];

    const event = {
      summary: interaction.title,
      description: interaction.details ?? undefined,
      location: interaction.location ?? undefined,
      start: interaction.allDay
        ? { date: dateStr }
        : { dateTime: startIso, timeZone: 'Europe/Moscow' },
      end: interaction.allDay
        ? { date: dateStr }
        : { dateTime: endIso, timeZone: 'Europe/Moscow' },
      attendees: attendeesRaw.filter((a) => a.includes('@')).map((email) => ({ email })),
      reminders: interaction.reminderMinutes
        ? {
            useDefault: false,
            overrides: [{ method: 'popup', minutes: interaction.reminderMinutes }],
          }
        : { useDefault: true },
    };

    try {
      const res = await calendar.events.insert({
        calendarId: auth.token.calendarId,
        requestBody: event,
      });
      return { ok: true, eventId: res.data.id ?? undefined };
    } catch (e) {
      logger.error({ err: e, interactionId: params.interactionId }, 'Google push failed');
      return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  static async syncAll(
    userId: string,
  ): Promise<{ ok: boolean; synced: number; error?: string }> {
    const auth = await this.getAuthorizedClient(userId);
    if (!auth) return { ok: false, synced: 0, error: 'Google не подключён' };

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const interactions = await prisma.interaction.findMany({
      where: { deletedAt: null, interactionDate: { gte: since } },
      select: { id: true },
    });

    let synced = 0;
    for (const it of interactions) {
      const r = await this.pushEvent({ userId, interactionId: it.id });
      if (r.ok) synced++;
    }

    return { ok: true, synced };
  }
}