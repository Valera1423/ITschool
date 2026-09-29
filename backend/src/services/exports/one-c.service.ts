import { prisma } from '../../db/prisma.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../errors/codes.js';

interface OneCConfig {
  endpoint?: string;
  username?: string;
  password?: string;
  contractCollection?: string;
}

export class OneCService {
  static async exportContract(
    contractId: string,
    userId: string,
  ): Promise<{ ok: boolean; externalId?: string; error?: string }> {
    const integration = await prisma.integration.findFirst({
      where: {
        type: 'custom_api',
        status: 'Активна',
        deletedAt: null,
        name: { contains: '1С' },
      },
    });

    if (!integration) return { ok: false, error: 'Интеграция 1С не настроена' };

    const config = integration.config as OneCConfig;
    if (!config.endpoint) return { ok: false, error: 'Endpoint 1С не задан' };

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        university: { select: { name: true, contractNumber: true } },
      },
    });
    if (!contract) throw new AppError('CONTRACT_NOT_FOUND', 404);

    const payload = {
      Date:
        contract.signedAt?.toISOString().slice(0, 10) ??
        contract.createdAt.toISOString().slice(0, 10),
      Number: contract.contractNumber ?? '',
      Counterparty: contract.university.name,
      Amount: Number(contract.amount),
      Currency: contract.currency,
      Description: contract.title,
      ExternalID: contract.id,
    };

    const log = await prisma.externalExportLog.create({
      data: {
        system: '1c',
        entity: 'contracts',
        entityId: contractId,
        status: 'pending',
        payload: payload as never,
        createdBy: userId,
      },
    });

    try {
      const url = `${config.endpoint.replace(/\/$/, '')}/${config.contractCollection ?? 'Document_Договор'}`;
      const auth =
        config.username && config.password
          ? 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64')
          : undefined;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Accept: 'application/json',
            ...(auth ? { Authorization: auth } : {}),
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
        return { ok: false, error: `1С вернула HTTP ${res.status}` };
      }

      const externalId =
        (response as { Ref_Key?: string; Number?: string }).Ref_Key ??
        (response as { Number?: string }).Number ??
        undefined;

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

      logger.info({ contractId, externalId }, 'Договор выгружен в 1С');
      return { ok: true, externalId };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown';
      await prisma.externalExportLog
        .update({
          where: { id: log.id },
          data: { status: 'failed', error: message, completedAt: new Date() },
        })
        .catch(() => {});
      logger.error({ err: e, contractId }, 'Ошибка экспорта в 1С');
      return { ok: false, error: message };
    }
  }
}