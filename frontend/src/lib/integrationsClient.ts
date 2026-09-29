// frontend/src/lib/integrationsClient.ts
import { api } from './api';
import type { Integration, IntegrationEndpoint, IntegrationFieldMapping, IntegrationSyncLog } from '@/types';

/**
 * Типизированный клиент интеграций.
 * Тонкая обёртка над REST API.
 */

export interface SyncResultRow {
  endpointId: string;
  endpointName: string;
  status: 'success' | 'partial' | 'failed';
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  durationMs: number;
  error?: string;
  errors: { row: number; message: string }[];
}

export class IntegrationsClient {
  listIntegrations() {
    return api.get<Integration[]>('/integrations');
  }

  getIntegration(id: string) {
    return api.get<Integration>(`/integrations/${id}`);
  }

  createIntegration(data: Partial<Integration>) {
    return api.post<Integration>('/integrations', data);
  }

  updateIntegration(id: string, data: Partial<Integration>) {
    return api.patch<Integration>(`/integrations/${id}`, data);
  }

  deleteIntegration(id: string) {
    return api.delete(`/integrations/${id}`);
  }

  testConnection(id: string) {
    return api.post<{
      ok: boolean;
      latencyMs: number;
      status: number;
      sample?: unknown;
      error?: string;
    }>(`/integrations/${id}/test`);
  }

  syncNow(id: string) {
    return api.post<SyncResultRow[]>(`/integrations/${id}/sync`);
  }

  listLogs(id: string, limit = 100) {
    return api.get<IntegrationSyncLog[]>(`/integrations/${id}/logs?limit=${limit}`);
  }

  listAllLogs(limit = 200) {
    return api.get<IntegrationSyncLog[]>(`/integrations/logs/all?limit=${limit}`);
  }

  // Endpoints
  createEndpoint(integrationId: string, data: Partial<IntegrationEndpoint>) {
    return api.post<IntegrationEndpoint>(`/integrations/${integrationId}/endpoints`, data);
  }

  updateEndpoint(endpointId: string, data: Partial<IntegrationEndpoint>) {
    return api.patch<IntegrationEndpoint>(`/integrations/endpoints/${endpointId}`, data);
  }

  deleteEndpoint(endpointId: string) {
    return api.delete(`/integrations/endpoints/${endpointId}`);
  }

  // Mappings
  createMapping(endpointId: string, data: Partial<IntegrationFieldMapping>) {
    return api.post<IntegrationFieldMapping>(
      `/integrations/endpoints/${endpointId}/mappings`,
      data,
    );
  }

  updateMapping(mappingId: string, data: Partial<IntegrationFieldMapping>) {
    return api.patch<IntegrationFieldMapping>(`/integrations/mappings/${mappingId}`, data);
  }

  deleteMapping(mappingId: string) {
    return api.delete(`/integrations/mappings/${mappingId}`);
  }

  // ==========================================================
  // PREVIEW — первые N записей из внешнего API
  // ==========================================================
  previewEndpoint(
    id: string,
    endpointId?: string,
    limit = 5,
  ) {
    const params = new URLSearchParams();
    if (endpointId) params.set('endpointId', endpointId);
    params.set('limit', String(limit));
    return api.get<{
      ok: boolean;
      url: string;
      httpStatus: number;
      latencyMs: number;
      fetched: number;
      fields: string[];
      sample: unknown[];
      error?: string;
    }>(`/integrations/${id}/preview?${params.toString()}`);
  }

  /**
   * Обновление config (endpoint, api_key, header_name, webhook_secret)
   * отдельным методом — чтобы не затирать другие поля интеграции.
   */
  updateIntegrationConfig(id: string, config: Record<string, unknown>) {
    return api.patch<Integration>(`/integrations/${id}`, { config });
  }
}

export const integrationsClient = new IntegrationsClient();