import { prisma } from '../../db/prisma.js';
import { logger } from '../../config/logger.js';

interface SbisConfig {
  endpoint?: string;
  apiKey?: string;
  serviceId?: string;
}

export class SbisService {
  private static async getConfig(): Promise<SbisConfig | null> {
    const integration = await prisma.integration.findFirst({
      where: {
        type: 'custom_api',
        status: 'Активна',
        deletedAt: null,
        name: { contains: 'СБИС' },
      },
    });
    if (!integration) return null;
    return integration.config as SbisConfig;
  }

  static async sendContract(contractId: string, userId: string) {
    const config = await this.getConfig();
    if (!config?.endpoint || !config.apiKey) {
      return { ok: false, error: 'СБИС не настроен' };
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { university: true },
    });
    if (!contract) return { ok: false, error: 'Договор не найден' };

    const payload = {
      method: 'СБИС.ЗаписатьДокумент',
      params: {
        Документ: {
          Тип: 'Договор',
          Номер: contract.contractNumber,
          Дата: contract.createdAt.toISOString().slice(0, 10),
          Сумма: Number(contract.amount),
          Контрагент: contract.university.name,
        },
      },
    };

    try {
      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SBISAccessToken': config.apiKey,
        },
        body: JSON.stringify(payload),
      });

      const response = await res.json().catch(() => ({}));

      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` };
      }

      const externalId = String(
        (response as { result?: { Документ?: { ИД?: string } } }).result?.Документ?.ИД ?? '',
      );

      const doc = await prisma.edoDocument.create({
        data: {
          contractId,
          provider: 'sbis',
          externalId,
          status: 'sent',
          rawData: response as never,
        },
      });

      logger.info({ contractId, externalId, userId }, 'Договор отправлен в СБИС');
      return { ok: true, externalId, docId: doc.id };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown';
      logger.error({ err: e, contractId }, 'Ошибка отправки в СБИС');
      return { ok: false, error: message };
    }
  }

  static async handleWebhook(body: unknown, _headers: Record<string, string>) {
    const event = body as {
      ИД?: string;
      Событие?: string;
      Комментарий?: string;
    };
    if (!event.ИД) return { ok: false, error: 'no ИД' };

    const doc = await prisma.edoDocument.findFirst({
      where: { provider: 'sbis', externalId: event.ИД },
    });
    if (!doc) return { ok: false, error: 'unknown doc' };

    const statusMap: Record<string, string> = {
      Доставлен: 'delivered',
      Подписан: 'signed',
      Отказ: 'rejected',
    };

    const newStatus = statusMap[event.Событие ?? ''] ?? doc.status;

    await prisma.edoDocument.update({
      where: { id: doc.id },
      data: {
        status: newStatus,
        signedAt: newStatus === 'signed' ? new Date() : doc.signedAt,
        rejectedAt: newStatus === 'rejected' ? new Date() : doc.rejectedAt,
        rejectionComment: event.Комментарий ?? doc.rejectionComment,
        rawData: event as never,
      },
    });

    if (newStatus === 'signed') {
      await prisma.contract.update({
        where: { id: doc.contractId },
        data: { status: 'Подписан', signedAt: new Date() },
      });
    }

    return { ok: true };
  }
}