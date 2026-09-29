// backend/src/services/enterprise/types.ts
/**
 * Универсальный интерфейс Enterprise-коннекторов.
 *
 * Реализации:
 *   - 1CConnector    — выгрузка в 1С:Управление предприятием
 *   - SapConnector   — SAP ERP (OData / IDoc)
 *   - DiadocConnector — Контур.Диадок (ЭДО)
 *   - SbisConnector  — СБИС ЭДО
 *
 * Sandbox-режим: в dev / на демо-стенде коннекторы работают
 * в sandbox: возвращают фейковый успех, пишут в ExternalExportLog.
 * Это позволяет показать архитектуру без реальных интеграций.
 *
 * В prod — sandbox: false в integration.config.
 */

export interface ConnectorContext {
  /** Конфиг из Integration.config (endpoint, api_key, sandbox и др.). */
  config: Record<string, unknown>;
  /** ID интеграции — для аудита и ExternalExportLog. */
  integrationId: string;
  /** Пользователь, инициировавший выгрузку. */
  actor: { userId: string | null; email: string };
}

export interface ExportResult {
  ok: boolean;
  externalId?: string;
  message?: string;
  error?: string;
  /** Полный ответ внешней системы — для ExternalExportLog.response. */
  response?: unknown;
}

export interface SendDocumentResult {
  ok: boolean;
  externalId?: string;
  status?: string;
  error?: string;
  response?: unknown;
}

export interface EnterpriseConnector {
  /** Уникальный код системы: '1c' | 'sap' | 'diadoc' | 'sbis'. */
  readonly system: string;

  /** Проверка соединения. Для sandbox всегда ok. */
  test(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;

  /** Выгрузка сущности в систему. entity — 'contracts' | 'universities' | … */
  exportEntity(input: {
    entity: string;
    entityId: string;
    payload: Record<string, unknown>;
  }): Promise<ExportResult>;

  /** Отправить документ в ЭДО (только для diadoc / sbis). */
  sendDocument?(input: {
    documentId: string;
    filePath: string;
    title: string;
    counterpartyInn?: string;
  }): Promise<SendDocumentResult>;

  /** Проверить статус документа в ЭДО. */
  checkDocumentStatus?(externalId: string): Promise<SendDocumentResult>;
}