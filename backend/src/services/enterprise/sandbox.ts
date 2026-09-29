// backend/src/services/enterprise/sandbox.ts
import { randomUUID } from 'node:crypto';
import { logger } from '../../config/logger.js';
import type {
  ConnectorContext,
  EnterpriseConnector,
  ExportResult,
  SendDocumentResult,
} from './types.js';

/**
 * Sandbox-коннектор. Возвращает успех без реальных запросов.
 *
 * Используется:
 *   - в dev, чтобы UI не падал без реального 1С;
 *   - на демо-стенде для показа архитектуры;
 *   - в тестах.
 *
 * Всё логирует, генерирует externalId. Никаких внешних вызовов.
 */
export class SandboxConnector implements EnterpriseConnector {
  readonly system: string;
  private ctx: ConnectorContext;

  constructor(system: string, ctx: ConnectorContext) {
    this.system = system;
    this.ctx = ctx;
  }

  async test(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const started = Date.now();
    // Имитируем задержку сети — 40–80 мс
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 40));
    logger.info(
      { system: this.system, integrationId: this.ctx.integrationId },
      '[sandbox] test ok',
    );
    return { ok: true, latencyMs: Date.now() - started };
  }

  async exportEntity(input: {
    entity: string;
    entityId: string;
    payload: Record<string, unknown>;
  }): Promise<ExportResult> {
    const externalId = `${this.system.toUpperCase()}-SANDBOX-${randomUUID().slice(0, 8)}`;
    logger.info(
      {
        system: this.system,
        entity: input.entity,
        entityId: input.entityId,
        externalId,
      },
      '[sandbox] export',
    );
    return {
      ok: true,
      externalId,
      message: `Sandbox: ${input.entity} выгружен без реального запроса`,
      response: { sandbox: true, payload: input.payload },
    };
  }

  async sendDocument(input: {
    documentId: string;
    filePath: string;
    title: string;
  }): Promise<SendDocumentResult> {
    const externalId = `${this.system.toUpperCase()}-DOC-${randomUUID().slice(0, 8)}`;
    logger.info(
      { system: this.system, documentId: input.documentId, externalId },
      '[sandbox] sendDocument',
    );
    return {
      ok: true,
      externalId,
      status: 'sent',
      response: { sandbox: true, title: input.title },
    };
  }

  async checkDocumentStatus(externalId: string): Promise<SendDocumentResult> {
    return {
      ok: true,
      externalId,
      status: 'delivered',
      response: { sandbox: true },
    };
  }
}