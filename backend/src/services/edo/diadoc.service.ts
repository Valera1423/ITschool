import { prisma } from '../../db/prisma.js';
import { logger } from '../../config/logger.js';

interface DiadocConfig {
  endpoint?: string;
  apiKey?: string;
  boxId?: string;
}

export class DiadocService {
  private static async getConfig(): Promise<DiadocConfig | null> {
    const integration = await prisma.integration.findFirst({
      where: {
        type: 'custom_api',
        status: 'Активна',
        deletedAt: null,
        name: { contains: 'Диадок' },
      },
    });
    if (!integration) return null;
    return integration.config as DiadocConfig;
  }

  static async sendContract(contractId: string, userId: string) {
    const config = await this.getConfig();
    if (!config?.endpoint || !config.apiKey) {
      return { ok: false, error: 'Диадок не настроен' };
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        university: true,
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!contract) return { ok: false, error: 'Договор не найден' };

    const payload = {
      BoxId: config.boxId,
      FromBoxId: config.boxId,
      ToBoxId: null,
      Type: 'Contract',
      Document: {
        ContractNumber: contract.contractNumber,
        ContractDate: contract.createdAt.toISOString().slice(0, 10),
        Title: contract.title,
        Amount: Number(contract.amount),
        Counterparty: contract.university.name,
      },
    };

    try {
      const res = await fetch(`${config.endpoint.replace(/\/$/, '')}/V3/PostMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `DiadocAuth ddauth_api_client_id=${config.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const response = await res.json().catch(() => ({}));

      if (!res.ok) {
        logger.warn({ status: res.status, response, userId }, 'Диадок вернула ошибку');
        return { ok: false, error: `HTTP ${res.status}` };
      }

      const externalId = (response as { MessageId?: string }).MessageId ?? '';

      const doc = await prisma.edoDocument.create({
        data: {
          contractId,
          provider: 'diadoc',
          externalId,
          status: 'sent',
          boxId: config.boxId ?? null,
          rawData: response as never,
        },
      });

      logger.info({ contractId, externalId }, 'Договор отправлен в Диадок');
      return { ok: true, externalId, docId: doc.id };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown';
      logger.error({ err: e, contractId }, 'Ошибка отправки в Диадок');
      return { ok: false, error: message };
    }
  }

  static async handleWebhook(body: unknown, headers: Record<string, string>) {
    const secret = headers['x-diadoc-signature'];
    const expected = process.env.DIADOC_WEBHOOK_SECRET;
    if (expected && secret !== expected) {
      return { ok: false, error: 'invalid signature' };
    }

    const event = body as {
      MessageId?: string;
      EventType?: string;
      SigningTime?: string;
      RejectionComment?: string;
    };

    if (!event.MessageId) return { ok: false, error: 'no MessageId' };

    const doc = await prisma.edoDocument.findFirst({
      where: { provider: 'diadoc', externalId: event.MessageId },
    });
    if (!doc) return { ok: false, error: 'unknown message' };

    const statusMap: Record<string, string> = {
      MessageDelivered: 'delivered',
      Signed: 'signed',
      Rejected: 'rejected',
    };

    const newStatus = statusMap[event.EventType ?? ''] ?? doc.status;

    await prisma.edoDocument.update({
      where: { id: doc.id },
      data: {
        status: newStatus,
        signedAt:
          newStatus === 'signed' && event.SigningTime
            ? new Date(event.SigningTime)
            : doc.signedAt,
        rejectedAt: newStatus === 'rejected' ? new Date() : doc.rejectedAt,
        rejectionComment: event.RejectionComment ?? doc.rejectionComment,
        rawData: event as never,
      },
    });

    if (newStatus === 'signed' && doc.contractId) {
      await prisma.contract.update({
        where: { id: doc.contractId },
        data: { status: 'Подписан', signedAt: new Date() },
      });
    }

    return { ok: true, status: newStatus };
  }
}