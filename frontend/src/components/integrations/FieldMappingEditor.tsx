// frontend/src/components/integrations/FieldMappingEditor.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, Loader2, RefreshCw, Eye, AlertCircle,
  CheckCircle2, Database, Wand2,
} from 'lucide-react';
import type {
  Integration,
  IntegrationEndpoint,
  IntegrationFieldMapping,
} from '@/types';
import type { IntegrationsClient } from '@/lib/integrationsClient';
import { Button, inputClass, selectClass, EmptyState } from '@/components/ui';

/**
 * Редактор маппинга полей внешнего API → поля CRM.
 *
 * Self-contained: добавляет, изменяет и удаляет маппинги через
 * IntegrationsClient. Не требует согласования с родителем —
 * все действия применяются сразу.
 *
 * Preview: GET /integrations/:id/preview — возвращает первые
 * N записей и плоский список полей для выпадающих списков.
 */

const TARGET_FIELDS = [
  { value: 'name', label: 'Название вуза' },
  { value: 'city', label: 'Город' },
  { value: 'direction', label: 'ИТ-направление' },
  { value: 'product', label: 'ИТ-продукт' },
  { value: 'vendorName', label: 'Вендор (по имени)' },
  { value: 'status', label: 'Статус' },
  { value: 'handoverStatus', label: 'Статус передачи' },
  { value: 'manager', label: 'Ответственный (ФИО)' },
  { value: 'contactName', label: 'Контактное лицо' },
  { value: 'contactEmail', label: 'Email' },
  { value: 'contactPhone', label: 'Телефон' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'maxMessenger', label: 'MAX' },
  { value: 'notes', label: 'Комментарий' },
  { value: 'contractNumber', label: 'Номер договора' },
  { value: 'licenseSigned', label: 'Лицензия подписана (bool)' },
  { value: 'licenseExpiresAt', label: 'Срок лицензии (date)' },
];

const TRANSFORMS = [
  { value: 'string', label: 'Как есть' },
  { value: 'number', label: 'Число' },
  { value: 'date', label: 'Дата' },
  { value: 'boolean', label: 'Да/Нет' },
  { value: 'lower', label: 'Нижний регистр' },
  { value: 'upper', label: 'ВЕРХНИЙ регистр' },
  { value: 'trim', label: 'Обрезать пробелы' },
  { value: 'json', label: 'JSON' },
];

interface PreviewData {
  ok: boolean;
  url: string;
  latencyMs: number;
  fetched: number;
  fields: string[];
  sample: unknown[];
  error?: string;
}

interface Props {
  integration: Integration;
  endpoint: IntegrationEndpoint;
  client: IntegrationsClient;
  onNotice: (msg: string) => void;
}

export function FieldMappingEditor({
  integration,
  endpoint,
  client,
  onNotice,
}: Props) {
  const [mappings, setMappings] = useState<IntegrationFieldMapping[]>(
    endpoint.mappings ?? [],
  );
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // При смене endpoint сбрасываем маппинги
  useEffect(() => {
    setMappings(endpoint.mappings ?? []);
    setPreview(null);
  }, [endpoint.id, endpoint.mappings]);

  // ============================================================
  // PREVIEW
  // ============================================================
  const loadPreview = async () => {
    setPreviewBusy(true);
    try {
      const result = await client.previewEndpoint(integration.id, endpoint.id, 3);
      setPreview(result);
      if (!result.ok) {
        onNotice(`Превью: ${result.error ?? 'ошибка'}`);
      }
    } catch (e) {
      onNotice(`Превью: ${(e as Error).message}`);
    } finally {
      setPreviewBusy(false);
    }
  };

  const availableFields = useMemo(
    () => preview?.fields ?? [],
    [preview],
  );

  // ============================================================
  // SAVE HELPERS
  // ============================================================
  const withSaving = async (id: string, fn: () => Promise<void>) => {
    setSavingIds((s) => new Set(s).add(id));
    try {
      await fn();
    } finally {
      setSavingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  // ============================================================
  // ADD
  // ============================================================
  const add = async () => {
    const tempId = `new-${Date.now()}`;
    const optimistic: IntegrationFieldMapping = {
      id: tempId,
      endpoint_id: endpoint.id,
      source_field: '',
      target_field: '',
      transform: 'string',
      transform_arg: null,
      required: false,
      default_value: null,
      created_at: new Date().toISOString(),
    };
    setMappings((list) => [...list, optimistic]);

    // Сразу создаём на сервере с дефолтными значениями; после
    // создания заменим tempId на реальный UUID.
    await withSaving(tempId, async () => {
      try {
        const created = await client.createMapping(endpoint.id, {
          source_field: '—',
          target_field: 'name',
          transform: 'string',
          required: false,
          default_value: null,
          transform_arg: null,
        });
        setMappings((list) =>
          list.map((m) => (m.id === tempId ? created : m)),
        );
      } catch (e) {
        setMappings((list) => list.filter((m) => m.id !== tempId));
        onNotice(`Ошибка создания: ${(e as Error).message}`);
      }
    });
  };

  // ============================================================
  // UPDATE (debounced)
  // ============================================================
  const debounceRef = useRef<Map<string, number>>(new Map());

  const update = (
    id: string,
    patch: Partial<IntegrationFieldMapping>,
  ) => {
    // Оптимистично меняем локально
    setMappings((list) =>
      list.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );

    // Пропускаем временные id (ещё не сохранены)
    if (id.startsWith('new-')) return;

    // Debounce 500ms на один id
    const existing = debounceRef.current.get(id);
    if (existing) window.clearTimeout(existing);

    const timer = window.setTimeout(async () => {
      debounceRef.current.delete(id);
      await withSaving(id, async () => {
        try {
          await client.updateMapping(id, patch);
        } catch (e) {
          onNotice(`Ошибка сохранения: ${(e as Error).message}`);
        }
      });
    }, 500);

    debounceRef.current.set(id, timer);
  };

  // ============================================================
  // REMOVE
  // ============================================================
  const remove = async (id: string) => {
    if (!window.confirm('Удалить маппинг?')) return;

    const backup = mappings;
    setMappings((list) => list.filter((m) => m.id !== id));

    if (id.startsWith('new-')) return;

    await withSaving(id, async () => {
      try {
        await client.deleteMapping(id);
      } catch (e) {
        setMappings(backup);
        onNotice(`Ошибка удаления: ${(e as Error).message}`);
      }
    });
  };

  // ============================================================
  // AUTO-MAP по совпадению имён
  // ============================================================
  const autoMap = async () => {
    if (availableFields.length === 0) {
      onNotice('Сначала загрузите превью.');
      return;
    }
    if (!window.confirm('Автоматически сопоставить похожие поля?')) return;

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
    const matches: { source: string; target: string }[] = [];

    availableFields.forEach((f) => {
      const fn = normalize(f.split('.').pop() ?? f);
      const t = TARGET_FIELDS.find(
        (tf) => normalize(tf.value) === fn || normalize(tf.label) === fn,
      );
      if (t) matches.push({ source: f, target: t.value });
    });

    for (const m of matches) {
      const exists = mappings.find((x) => x.source_field === m.source);
      if (exists) continue;
      await withSaving(`auto-${m.source}`, async () => {
        try {
          const created = await client.createMapping(endpoint.id, {
            source_field: m.source,
            target_field: m.target,
            transform: 'string',
            required: false,
            default_value: null,
            transform_arg: null,
          });
          setMappings((list) => [...list, created]);
        } catch {
          /* ignore one bad mapping */
        }
      });
    }

    onNotice(`Авто-сопоставлено: ${matches.length} полей.`);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="border-t border-slate-100 dark:border-slate-800 p-3 bg-slate-50/40 dark:bg-slate-800/30 space-y-3">
      {/* Панель действий */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Маппинг полей ({mappings.length})
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadPreview()}
            disabled={previewBusy}
          >
            {previewBusy ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Database size={12} />
            )}
            Превью
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void autoMap()}
            disabled={!preview || availableFields.length === 0}
          >
            <Wand2 size={12} /> Авто
          </Button>
          <Button size="sm" onClick={() => void add()}>
            <Plus size={12} /> Добавить
          </Button>
        </div>
      </div>

      {/* Превью */}
      {preview && (
        <div
          className={`rounded-xl p-3 text-xs flex items-start gap-2 ${
            preview.ok
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/40 text-rose-700 dark:text-rose-300'
          }`}
        >
          {preview.ok ? (
            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium">
              {preview.ok
                ? `OK · ${preview.fetched} записей · ${preview.latencyMs} мс · полей: ${preview.fields.length}`
                : `Ошибка: ${preview.error}`}
            </p>
            {preview.ok && (
              <p className="mt-1 font-mono text-[10px] break-all opacity-80">
                {preview.url}
              </p>
            )}
          </div>
          {preview.ok && preview.sample.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="inline-flex items-center gap-1 text-[10px] hover:underline"
            >
              <Eye size={11} /> {showRaw ? 'Скрыть' : 'Показать'}
            </button>
          )}
        </div>
      )}

      {showRaw && preview && preview.sample[0] && (
        <pre className="max-h-40 overflow-auto rounded-lg bg-slate-900 text-slate-100 p-3 text-[10px] leading-tight">
          {JSON.stringify(preview.sample[0], null, 2)}
        </pre>
      )}

      {/* Строки маппинга */}
      {mappings.length === 0 ? (
        <EmptyState
          text="Маппингов нет"
          hint="Нажмите «Превью», затем «Добавить» или «Авто»"
        />
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-[10px] text-slate-400 uppercase px-1">
            <span className="col-span-3">Поле из API</span>
            <span className="col-span-3">Поле в CRM</span>
            <span className="col-span-2">Тип</span>
            <span className="col-span-2">По умолч.</span>
            <span className="col-span-1">Req</span>
            <span className="col-span-1" />
          </div>

          {mappings.map((m) => {
            const isSaving = savingIds.has(m.id);
            const isNew = m.id.startsWith('new-');

            return (
              <div
                key={m.id}
                className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg ${
                  isNew
                    ? 'bg-amber-50/60 dark:bg-amber-900/20'
                    : 'bg-white dark:bg-slate-900'
                }`}
              >
                {/* Source */}
                <div className="col-span-3">
                  {availableFields.length > 0 ? (
                    <select
                      value={m.source_field}
                      onChange={(e) =>
                        update(m.id, { source_field: e.target.value })
                      }
                      disabled={isSaving}
                      className={`${selectClass} text-xs py-1.5`}
                    >
                      <option value="">— выберите —</option>
                      {availableFields.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                      {m.source_field &&
                        !availableFields.includes(m.source_field) && (
                          <option value={m.source_field}>
                            {m.source_field}
                          </option>
                        )}
                    </select>
                  ) : (
                    <input
                      value={m.source_field}
                      onChange={(e) =>
                        update(m.id, { source_field: e.target.value })
                      }
                      placeholder="university.name"
                      className={`${inputClass} text-xs py-1.5 font-mono`}
                    />
                  )}
                </div>

                {/* Target */}
                <div className="col-span-3">
                  <select
                    value={m.target_field}
                    onChange={(e) =>
                      update(m.id, { target_field: e.target.value })
                    }
                    disabled={isSaving}
                    className={`${selectClass} text-xs py-1.5`}
                  >
                    <option value="">— выберите —</option>
                    {TARGET_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Transform */}
                <div className="col-span-2">
                  <select
                    value={m.transform}
                    onChange={(e) =>
                      update(m.id, { transform: e.target.value })
                    }
                    disabled={isSaving}
                    className={`${selectClass} text-xs py-1.5`}
                  >
                    {TRANSFORMS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Default */}
                <div className="col-span-2">
                  <input
                    value={m.default_value ?? ''}
                    onChange={(e) =>
                      update(m.id, {
                        default_value: e.target.value || null,
                      })
                    }
                    placeholder="—"
                    disabled={isSaving}
                    className={`${inputClass} text-xs py-1.5`}
                  />
                </div>

                {/* Required */}
                <div className="col-span-1 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={m.required}
                    onChange={(e) =>
                      update(m.id, { required: e.target.checked })
                    }
                    disabled={isSaving}
                    className="w-4 h-4 rounded border-slate-300 text-sky-600"
                  />
                </div>

                {/* Delete */}
                <div className="col-span-1 flex items-center justify-end">
                  {isSaving ? (
                    <Loader2 size={13} className="animate-spin text-sky-500" />
                  ) : (
                    <button
                      onClick={() => void remove(m.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                      aria-label="Удалить"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-slate-400">
        <RefreshCw size={10} className="inline mr-1" />
        Изменения сохраняются автоматически через 500 мс.
      </p>
    </div>
  );
}