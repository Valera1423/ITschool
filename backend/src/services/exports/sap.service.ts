import { prisma } from '../../db/prisma.js';
import { logger } from '../../config/logger.js';

interface SapConfig {
  endpoint?: string;
  apiKey?: string;
  entityPath?: string;
}

export class SapService {
  static async exportUniversity(
    universityId: string,
    userId: string,
  ): Promise<{ ok: boolean; externalId?: string; error?: string }> {
    const integration = await prisma.integration.findFirst({
      where: {
        type: 'custom_api',
        status: 'Активна',
        deletedAt: null,
        name: { contains: 'SAP' },
      },
    });

    if (!integration) return { ok: false, error: 'Интеграция SAP не настроена' };

    const config = integration.config as SapConfig;
    if (!config.endpoint) return { ok: false, error: 'Endpoint SAP не задан' };

    const uni = await prisma.university.findUnique({ where: { id: universityId } });
    if (!uni) return { ok: false, error: 'Вуз не найден' };

    const payload = {
      BusinessPartner: uni.id,
      BusinessPartnerFullName: uni.name,
      BusinessPartnerCategory: '2',
      City: uni.city,
      EmailAddress: uni.contactEmail ?? '',
      PhoneNumber: uni.contactPhone ?? '',
    };

    const log = await prisma.externalExportLog.create({
      data: {
        system: 'sap',
        entity: 'universities',
        entityId: universityId,
        status: 'pending',
        payload: payload as never,
        createdBy: userId,
      },
    });

    try {
      const url = `${config.endpoint.replace(/\/$/, '')}${
        config.entityPath ?? '/API_BUSINESS_PARTNER/A_BusinessPartner'
      }`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Accept: 'application/json',
            ...(config.apiKey ? { APIKey: config.apiKey } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const response = await res.json().catch(() => ({}));

      if (!res.ok) {
        await prisma.externalExportLog
          .update({
            where: { id: log.id },
            data: {
              status: 'failed',
              error: `HTTP ${res.status}`,
              response: response as never,
              completedAt: new Date(),
            },
          })
          .catch(() => {});
        return { ok: false, error: `SAP вернула HTTP ${res.status}` };
      }

      const externalId = (response as { BusinessPartner?: string }).BusinessPartner;

      await prisma.externalExportLog
        .update({
          where: { id: log.id },
          data: {
            status: 'success',
            externalId,
            response: response as never,
            completedAt: new Date(),
          },
        })
        .catch(() => {});

      logger.info({ universityId, externalId }, 'Вуз выгружен в SAP');
      return { ok: true, externalId };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown';
      await prisma.externalExportLog
        .update({
          where: { id: log.id },
          data: { status: 'failed', error: message, completedAt: new Date() },
        })
        .catch(() => {});
      logger.error({ err: e, universityId }, 'Ошибка экспорта в SAP');
      return { ok: false, error: message };
    }
  }
}