// frontend/src/components/integrations/IntegrationSettingsModal.tsx
import { useState } from 'react';
import {
  Plus, Trash2, ChevronDown, ChevronRight,
  Power, PowerOff, Save, Loader2, Workflow, Lock,
} from 'lucide-react';
import type { Integration, IntegrationEndpoint } from '@/types';
import type { IntegrationsClient } from '@/lib/integrationsClient';
import {
  SimpleModal,
  Button,
  inputClass,
  selectClass,
  EmptyState,
  StatusBadge,
} from '@/components/ui';
import { FieldMappingEditor } from './FieldMappingEditor';
import { IntegrationRulesEditor } from './IntegrationRulesEditor';

interface Props {
  integration: Integration;
  client: IntegrationsClient;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onNotice: (msg: string) => void;
}

export function IntegrationSettingsModal({
  integration,
  client,
  onClose,
  onSaved,
  onNotice,
}: Props) {
  const [endpoints, setEndpoints] = useState<IntegrationEndpoint[]>(
    integration.endpoints ?? [],
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  // ── Config (endpoint / api_key / header_name / webhook_secret)
  const initialConfig = (integration.config ?? {}) as Record<string, unknown>;
  const [endpoint, setEndpoint] = useState(
    String(initialConfig.endpoint ?? ''),
  );
  const [apiKey, setApiKey] = useState(String(initialConfig.api_key ?? ''));
  const [headerName, setHeaderName] = useState(
    String(initialConfig.header_name ?? 'Authorization'),
  );
  const [webhookSecret, setWebhookSecret] = useState(
    String(initialConfig.webhook_secret ?? ''),
  );
  const [configSaving, setConfigSaving] = useState(false);

  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      await client.updateIntegrationConfig(integration.id, {
        ...initialConfig,
        endpoint: endpoint.trim(),
        api_key: apiKey,
        header_name: headerName || 'Authorization',
        webhook_secret: webhookSecret,
      });
      onNotice('Настройки сохранены.');
      await onSaved();
    } catch (e) {
      onNotice(`Ошибка: ${(e as Error).message}`);
    } finally {
      setConfigSaving(false);
    }
  };

  const toggleEndpoint = async (ep: IntegrationEndpoint) => {
    try {
      await client.updateEndpoint(ep.id, { enabled: !ep.enabled });
      setEndpoints((list) =>
        list.map((e) => (e.id === ep.id ? { ...e, enabled: !e.enabled } : e)),
      );
      onNotice(ep.enabled ? 'Endpoint отключён' : 'Endpoint включён');
    } catch (e) {
      onNotice(`Ошибка: ${(e as Error).message}`);
    }
  };

  const addEndpoint = async () => {
    const name = window.prompt('Название endpoint (например, «Студенты»):');
    if (!name) return;
    const path = window.prompt('Путь (например, /students):');
    if (!path) return;
    const entity = window.prompt('Сущность в БД (латиница, без пробелов):');
    if (!entity) return;

    try {
      const ep = await client.createEndpoint(integration.id, {
        name,
        path,
        entity,
        method: 'GET',
        enabled: true,
        sort_order: 100,
      });
      setEndpoints((list) => [...list, { ...ep, mappings: [] }]);
      onNotice('Endpoint добавлен');
    } catch (e) {
      onNotice(`Ошибка: ${(e as Error).message}`);
    }
  };

  const deleteEndpoint = async (id: string) => {
    if (!window.confirm('Удалить endpoint и все его маппинги?')) return;
    try {
      await client.deleteEndpoint(id);
      setEndpoints((list) => list.filter((e) => e.id !== id));
      onNotice('Удалено');
    } catch (e) {
      onNotice(`Ошибка: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <SimpleModal
        title={`Настройки: ${integration.name}`}
        onClose={onClose}
        wide
      >
        <div className="space-y-6">
          {/* ── Основные настройки */}
          <section className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Основные настройки
              </p>
              {integration.type === 'custom_api' && (
                <button
                  onClick={() => setRulesOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700"
                >
                  <Workflow size={12} /> Правила автоматизации
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Базовый URL API
                </label>
                <input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://lms.rt.ru/api/v1"
                  className={`${inputClass} font-mono text-xs`}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  API-ключ
                </label>
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_live_…"
                  className={`${inputClass} font-mono text-xs`}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Имя заголовка для ключа
                </label>
                <select
                  value={headerName}
                  onChange={(e) => setHeaderName(e.target.value)}
                  className={`${selectClass} text-xs`}
                >
                  <option value="Authorization">Authorization (Bearer)</option>
                  <option value="X-API-Key">X-API-Key</option>
                  <option value="X-Auth-Token">X-Auth-Token</option>
                </select>
              </div>

              {integration.type === 'custom_api' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Lock size={11} /> Webhook secret (HMAC для Laravel)
                  </label>
                  <input
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="уникальная строка ≥ 32 символов"
                    className={`${inputClass} font-mono text-xs`}
                    autoComplete="off"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Laravel подписывает webhook заголовком
                    <code className="mx-1 px-1 bg-slate-100 dark:bg-slate-800 rounded">
                      X-Laravel-Signature: sha256=…
                    </code>
                    этим секретом.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => void saveConfig()}
                disabled={configSaving}
              >
                {configSaving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                Сохранить
              </Button>
            </div>
          </section>

          {/* ── Endpoints */}
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Endpoints внешнего API и маппинг полей
              </p>
              <Button size="sm" onClick={() => void addEndpoint()}>
                <Plus size={13} /> Добавить endpoint
              </Button>
            </div>

            {endpoints.length === 0 ? (
              <EmptyState text="Endpoints не настроены" />
            ) : (
              <div className="space-y-2">
                {endpoints.map((ep) => {
                  const isOpen = expanded === ep.id;
                  return (
                    <div
                      key={ep.id}
                      className="rounded-xl border border-slate-100 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-3 p-3">
                        <button
                          onClick={() => setExpanded(isOpen ? null : ep.id)}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          {isOpen ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {ep.name}
                            <span className="ml-2 text-xs font-normal text-slate-400 font-mono">
                              {ep.method} {ep.path}
                            </span>
                          </p>
                          <p className="text-xs text-slate-400">
                            entity: <code>{ep.entity}</code> · маппингов:{' '}
                            {ep.mappings?.length ?? 0}
                          </p>
                        </div>

                        <StatusBadge
                          status={ep.enabled ? 'Активна' : 'Отключена'}
                        />

                        <button
                          onClick={() => void toggleEndpoint(ep)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          {ep.enabled ? (
                            <PowerOff size={13} />
                          ) : (
                            <Power size={13} />
                          )}
                        </button>

                        <button
                          onClick={() => void deleteEndpoint(ep.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {isOpen && (
                        <FieldMappingEditor
                          integration={integration}
                          endpoint={ep}
                          client={client}
                          onNotice={onNotice}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </div>
      </SimpleModal>

      {rulesOpen && (
        <IntegrationRulesEditor
          integrationId={integration.id}
          integrationName={integration.name}
          onClose={() => setRulesOpen(false)}
          onNotice={onNotice}
        />
      )}
    </>
  );
}