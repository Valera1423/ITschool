import { useState } from 'react';
import { Plug, Plus, Loader2 } from 'lucide-react';
import type { Integration } from '@/types';
import {
  integrationsClient,
  type SyncResultRow,
} from '@/lib/integrationsClient';
import { EmptyState, Button } from '@/components/ui';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { IntegrationSettingsModal } from '@/components/integrations/IntegrationSettingsModal';
import { IntegrationLogsModal } from '@/components/integrations/IntegrationLogsModal';
import { SyncResultsModal } from '@/components/integrations/SyncResultsModal';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { asArray } from '@/lib/utils';

/**
 * Страница интеграций.
 * Каталог шаблонов + список подключённых + тесты + синхронизация.
 */
interface Props {
  onNotice: (msg: string) => void;
}

export function IntegrationsPage({ onNotice }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'admin';

  const [settingsFor, setSettingsFor] = useState<Integration | null>(null);
  const [logsFor, setLogsFor] = useState<Integration | null>(null);
  const [syncResults, setSyncResults] = useState<{
    integration: string;
    results: SyncResultRow[];
  } | null>(null);

  const { data: integrationsRaw = [], isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => integrationsClient.listIntegrations(),
  });
  const integrations = asArray<Integration>(integrationsRaw);

  const reload = async () => {
    await qc.invalidateQueries({ queryKey: ['integrations'] });
  };

  const createNew = async () => {
    const name = window.prompt(
      'Название интеграции (например, "LMS ИТ Школы"):',
    );
    if (!name) return;
    const endpoint = window.prompt(
      'Базовый URL API (например, https://lms.rt.ru/api/v1):',
    );
    if (!endpoint) return;
    const apiKey = window.prompt('API-ключ:') ?? '';
    const headerName =
      window.prompt(
        'Имя заголовка для ключа (X-API-Key / Authorization):',
        'Authorization',
      ) ?? 'Authorization';

    await integrationsClient.createIntegration({
      name,
      type: 'custom_api',
      config: {
        endpoint,
        api_key: apiKey,
        header_name: headerName,
        method: 'GET',
      },
      status: 'Отключена',
      auto_sync: false,
      sync_schedule: '0 */2 * * *',
    });
    onNotice('Интеграция создана.');
    await reload();
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Внешние системы</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Интеграции
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            LMS ИТ Школы, веб-сайт на Laravel, другие REST API
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => void createNew()}>
            <Plus size={18} />
            Новая интеграция
          </Button>
        )}
      </section>

      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="animate-spin mx-auto text-sky-500" size={28} />
        </div>
      ) : integrations.length === 0 ? (
        <EmptyState
          text="Интеграций нет"
          hint={
            isAdmin
              ? 'Добавьте первую интеграцию'
              : 'Администратор ещё не настроил интеграции'
          }
          actionLabel={isAdmin ? 'Добавить' : undefined}
          onAction={isAdmin ? () => void createNew() : undefined}
          icon={Plug}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((i) => (
            <IntegrationCard
              key={i.id}
              integration={i}
              client={integrationsClient}
              canEdit={isAdmin}
              onRefresh={reload}
              onSyncResult={(results) =>
                setSyncResults({ integration: i.name, results })
              }
              onOpenSettings={setSettingsFor}
              onOpenLogs={setLogsFor}
              onNotice={onNotice}
            />
          ))}
        </div>
      )}

      {settingsFor && (
        <IntegrationSettingsModal
          integration={settingsFor}
          client={integrationsClient}
          onClose={() => setSettingsFor(null)}
          onSaved={reload}
          onNotice={onNotice}
        />
      )}

      {logsFor && (
        <IntegrationLogsModal
          integrationId={logsFor.id}
          integrationName={logsFor.name}
          client={integrationsClient}
          onClose={() => setLogsFor(null)}
        />
      )}

      {syncResults && (
        <SyncResultsModal
          integrationName={syncResults.integration}
          results={syncResults.results}
          onClose={() => setSyncResults(null)}
        />
      )}
    </div>
  );
}