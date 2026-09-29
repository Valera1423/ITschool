// frontend/src/pages/UniversitiesPage.tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  Building2,
  FileDown,
  FileSpreadsheet,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import type { SavedView, University } from '@/types';
import { UNIVERSITY_STATUSES, HANDOVER_STATUSES } from '@/constants';
import {
  StatusBadge,
  EmptyState,
  SimpleModal,
  Button,
  Avatar,
  Field,
  inputClass,
  selectClass,
  textareaClass,
  Toast,
} from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { downloadCSV } from '@/lib/utils';
import { useUndo, useHistory } from '@/components/UndoProvider';
import { useApi } from '@/hooks/useApi';
import { usePagination } from '@/hooks/usePagination';
import { useClipboardGrid } from '@/hooks/useClipboardGrid';
import {
  useCustomFields,
  useCustomFieldValues,
} from '@/hooks/useCustomFields';
import { useTags, useUniversityTags } from '@/hooks/useTags';
import { useSavedViews } from '@/hooks/useSavedViews';
import {
  useVendors,
  useDirections,
  useProducts,
  useManagers,
} from '@/hooks/queries/useCatalogs';
import {
  useAuth,
  useHasPermission,
  useCanDeleteUniversity,
  useCanAssignManager,
} from '@/contexts/AuthContext';
import { tagColor } from '@/lib/tags';
import { columnToValue } from '@/lib/customFields';
import { UNIVERSITIES_CSV_HEADERS, universitiesToRows } from '@/lib/dataIO';
import {
  exportUniversitiesXls,
  exportUniversitiesSpreadsheet,
} from '@/lib/excel';
import { exportUniversitiesPdf } from '@/lib/pdf';
import { MessengerLinks } from '@/components/MessengerLinks';
import { ExcelImportWizard } from '@/components/ExcelImportWizard';
import { BulkActionsBar } from '@/components/BulkActionsBar';
import { SaveViewModal } from '@/components/SaveViewModal';
import { UniversityDetailModal } from '@/components/UniversityDetailModal';
import { InlineEdit } from '@/components/InlineEdit';

const BULK_CHUNK_SIZE = 200;

type ApplyToAllAction =
  | 'update_status'
  | 'assign_manager'
  | 'add_tag'
  | 'remove_tag';

export function UniversitiesPage() {
  const api = useApi();
  const { user } = useAuth();
  const { notifyWithUndo } = useUndo();
  const history = useHistory();

  const [notice, setNotice] = useState('');

  const { data: vendors = [] } = useVendors();
  const { data: directions = [] } = useDirections();
  const { data: products = [] } = useProducts();
  const { data: managers = [] } = useManagers(true);

  const { fields: customFields } = useCustomFields('universities');
  const { tags: allTags } = useTags();
  const {
    views,
    create: createView,
    remove: removeView,
  } = useSavedViews(user?.profileId, 'universities');

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Все статусы');
  const [tagFilter, setTagFilter] = useState('');
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<University | null>(null);
  const [detail, setDetail] = useState<University | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [totalFiltered, setTotalFiltered] = useState<number | undefined>(
    undefined,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    items: universities,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    reload,
  } = usePagination<University>({
    path: '/universities',
    filters: {
      search: query || undefined,
      status: statusFilter !== 'Все статусы' ? statusFilter : undefined,
      tagId: tagFilter || undefined,
    },
    pageSize: 25,
  });

  const { map: uniTags, reload: reloadUniTags } = useUniversityTags(
    universities.map((u) => u.id),
  );
  const valuesByUni = useCustomFieldValues(universities.map((u) => u.id));

  const isAdmin = user?.role === 'admin';

  const canCreate = useHasPermission('universities.create');
  const canUpdate = useHasPermission('universities.update');
  const canDelete = useCanDeleteUniversity();
  const canImport = useHasPermission('universities.import');
  const canExport = useHasPermission('universities.export');
  const canAssign = useCanAssignManager();

  const refreshTotal = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '1' });
      if (query) params.set('search', query);
      if (statusFilter !== 'Все статусы') params.set('status', statusFilter);
      if (tagFilter) params.set('tagId', tagFilter);

      const res = await api.get<{
        pagination?: { total?: number };
        total?: number;
      }>(`/universities?${params.toString()}`);

      const total = res.pagination?.total ?? res.total;
      setTotalFiltered(typeof total === 'number' ? total : undefined);
    } catch {
      setTotalFiltered(undefined);
    }
  }, [api, query, statusFilter, tagFilter]);

  useEffect(() => {
    void refreshTotal();
  }, [refreshTotal]);

  const filtered = useMemo(() => {
    if (!tagFilter) return universities;
    return universities.filter((u) => (uniTags[u.id] ?? []).includes(tagFilter));
  }, [universities, tagFilter, uniTags]);

  const selected = universities.filter((u) => selectedIds.includes(u.id));

  // ============================================================
  // CRUD
  // ============================================================

  const deleteUniversity = async (u: University) => {
    try {
      await api.delete(`/universities/${u.id}`);
      notifyWithUndo(`Вуз «${u.name}» удалён`, async () => {
        await api.post(`/universities/${u.id}/restore`);
        await reload();
      });
      await reload();
      await refreshTotal();
    } catch (e) {
      setNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  const saveUniversity = async (data: Record<string, string>, id?: string) => {
    const managerId = data.manager_id || null;
    const managerObj = managers.find((m) => m.id === managerId);

    const payload = {
      name: data.name,
      city: data.city,
      direction: data.direction,
      product: data.product,
      vendorId: data.vendor_id || null,
      directionId: data.direction_id || null,
      productId: data.product_id || null,
      managerId,
      manager:
        managerObj?.full_name ??
        editing?.manager ??
        user?.name ??
        'Не назначен',
      contractNumber: data.contract_number || null,
      licenseSigned: data.license_signed === 'on',
      licenseExpiresAt: data.license_expires_at || null,
      status: data.status,
      handoverStatus: data.handover_status,
      contactName: data.contact_name || null,
      contactEmail: data.contact_email || null,
      contactPhone: data.contact_phone || null,
      telegram: data.telegram || null,
      whatsapp: data.whatsapp || null,
      maxMessenger: data.max_messenger || null,
      notes: data.notes || null,
    };

    try {
      if (id) {
        const old = universities.find((u) => u.id === id);
        await api.patch(`/universities/${id}`, payload);

        if (old) {
          const undoPayload = {
            name: old.name,
            city: old.city,
            direction: old.direction,
            product: old.product,
            vendorId: old.vendor_id ?? null,
            directionId: old.direction_id ?? null,
            productId: old.product_id ?? null,
            managerId: old.manager_id ?? null,
            manager: old.manager,
            contractNumber: old.contract_number ?? null,
            licenseSigned: old.license_signed,
            licenseExpiresAt: old.license_expires_at ?? null,
            status: old.status,
            handoverStatus: old.handover_status,
            contactName: old.contact_name ?? null,
            contactEmail: old.contact_email ?? null,
            contactPhone: old.contact_phone ?? null,
            telegram: old.telegram ?? null,
            whatsapp: old.whatsapp ?? null,
            maxMessenger: old.max_messenger ?? null,
            notes: old.notes ?? null,
          };

          history.push({
            label: `Вуз «${payload.name}» обновлён`,
            do: async () => {
              await api.patch(`/universities/${id}`, payload);
              await reload();
              await refreshTotal();
            },
            undo: async () => {
              await api.patch(`/universities/${id}`, undoPayload);
              await reload();
              await refreshTotal();
            },
          });
        }
      } else {
        const res = await api.post<{ id: string }>('/universities', payload);
        const newId = res?.id;

        history.push({
          label: `Вуз «${payload.name}» добавлен`,
          do: async () => {
            await api.post('/universities', payload);
            await reload();
            await refreshTotal();
          },
          undo: async () => {
            if (newId) {
              await api.delete(`/universities/${newId}`);
              await reload();
              await refreshTotal();
            }
          },
        });
      }
      setModalOpen(false);
      setEditing(null);
      await reload();
      await refreshTotal();
    } catch (e) {
      setNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data: Record<string, string> = {};
    new FormData(e.currentTarget).forEach((v, k) => {
      data[k] = String(v);
    });
    void saveUniversity(data, editing?.id);
  };

  // ============================================================
  // BULK
  // ============================================================

  const toggleSelect = (id: string) => {
    setSelectedIds((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map((u) => u.id));
  };

  const runBulkChunked = async (
    ids: string[],
    action: string,
    extra: Record<string, unknown> = {},
  ) => {
    for (let i = 0; i < ids.length; i += BULK_CHUNK_SIZE) {
      const chunk = ids.slice(i, i + BULK_CHUNK_SIZE);
      await api.post('/universities/bulk', {
        ids: chunk,
        action,
        ...extra,
      });
    }
  };

  const runRestoreChunked = async (ids: string[]) => {
    for (const id of ids) {
      await api.post(`/universities/${id}/restore`);
    }
  };

  // ============================================================
  // CLIPBOARD GRID
  // ============================================================

  const grid = useClipboardGrid<University>({
    selectedIds,
    allRows: universities,
    columns: [
      { key: 'name', label: 'Название' },
      { key: 'city', label: 'Город' },
      { key: 'direction', label: 'Направление' },
      { key: 'product', label: 'Продукт' },
      { key: 'status', label: 'Статус' },
      { key: 'manager', label: 'Менеджер' },
      { key: 'contact_email', label: 'Email' },
      { key: 'contact_phone', label: 'Телефон' },
      { key: 'notes', label: 'Заметки' },
    ],
    onPaste: async (rows) => {
      try {
        await api.post('/universities/import', {
          rows: rows.map((r) => ({
            name: String(r.name ?? '').trim(),
            city: String(r.city ?? 'Москва'),
            direction: String(r.direction ?? 'Разработка'),
            product: String(r.product ?? 'Ростелеком DataLab'),
            status: String(r.status ?? 'Новый'),
            manager: String(r.manager ?? 'Анна Кузнецова'),
            contact_email: (r.contact_email as string) || null,
            contact_phone: (r.contact_phone as string) || null,
            notes: (r.notes as string) || null,
            source: 'Вставка из буфера',
          })),
        });
        setNotice(`Вставлено: ${rows.length} строк`);
        await reload();
        await refreshTotal();
      } catch (e) {
        setNotice(
          `Ошибка вставки: ${e instanceof Error ? e.message : 'неизвестная'}`,
        );
      }
    },
  });

  const bulkChangeStatus = async (status: string) => {
    const ids = [...selectedIds];
    const oldStatuses = selected.map((u) => ({ id: u.id, status: u.status }));

    await runBulkChunked(ids, 'update_status', { status });
    setSelectedIds([]);
    await reload();
    await refreshTotal();

    history.push({
      label: `Статус изменён для ${ids.length} вузов → ${status}`,
      do: async () => {
        await runBulkChunked(ids, 'update_status', { status });
        await reload();
        await refreshTotal();
      },
      undo: async () => {
        for (const { id, status: old } of oldStatuses) {
          await api.patch(`/universities/${id}`, { status: old });
        }
        await reload();
        await refreshTotal();
      },
    });
  };

  const bulkTransfer = async (managerId: string, comment?: string) => {
    const ids = [...selectedIds];
    const oldManagers = selected.map((u) => ({
      id: u.id,
      managerId: u.manager_id,
      manager: u.manager,
    }));
    const newManager = managers.find((m) => m.id === managerId);

    await runBulkChunked(ids, 'assign_manager', {
      managerId,
      comment: comment ?? null,
      manager: newManager?.full_name ?? null,
    });
    setSelectedIds([]);
    await reload();
    await refreshTotal();

    history.push({
      label: `Передано менеджеру (${ids.length} вузов)`,
      do: async () => {
        await runBulkChunked(ids, 'assign_manager', {
          managerId,
          comment: comment ?? null,
          manager: newManager?.full_name ?? null,
        });
        await reload();
        await refreshTotal();
      },
      undo: async () => {
        for (const m of oldManagers) {
          await api.patch(`/universities/${m.id}`, {
            managerId: m.managerId,
            manager: m.manager,
          });
        }
        await reload();
        await refreshTotal();
      },
    });
  };

  const bulkAddTag = async (tagId: string) => {
    const ids = [...selectedIds];
    await runBulkChunked(ids, 'add_tag', { tagId });
    await reloadUniTags();
    await reload();
    await refreshTotal();

    history.push({
      label: `Тег добавлен к ${ids.length} вузам`,
      do: async () => {
        await runBulkChunked(ids, 'add_tag', { tagId });
        await reloadUniTags();
        await reload();
        await refreshTotal();
      },
      undo: async () => {
        await runBulkChunked(ids, 'remove_tag', { tagId });
        await reloadUniTags();
        await reload();
        await refreshTotal();
      },
    });
  };

  const bulkRemoveTag = async (tagId: string) => {
    const ids = [...selectedIds];
    await runBulkChunked(ids, 'remove_tag', { tagId });
    await reloadUniTags();
    await reload();
    await refreshTotal();

    history.push({
      label: `Тег снят с ${ids.length} вузов`,
      do: async () => {
        await runBulkChunked(ids, 'remove_tag', { tagId });
        await reloadUniTags();
        await reload();
        await refreshTotal();
      },
      undo: async () => {
        await runBulkChunked(ids, 'add_tag', { tagId });
        await reloadUniTags();
        await reload();
        await refreshTotal();
      },
    });
  };

  const bulkDelete = async () => {
    const ids = [...selectedIds];
    await runBulkChunked(ids, 'soft_delete');
    setSelectedIds([]);
    await reload();
    await refreshTotal();

    history.push({
      label: `Удалено вузов: ${ids.length}`,
      do: async () => {
        await runBulkChunked(ids, 'soft_delete');
        await reload();
        await refreshTotal();
      },
      undo: async () => {
        await runRestoreChunked(ids);
        await reload();
        await refreshTotal();
      },
    });
  };

  const bulkExport = () => {
    downloadCSV('universities-selected.csv', [
      [...UNIVERSITIES_CSV_HEADERS],
      ...universitiesToRows(selected),
    ]);
  };

  // ============================================================
  // BULK BY FILTER
  // ============================================================

  const onApplyToAllFiltered = async (
    action: ApplyToAllAction,
    value: string,
  ) => {
    const filters = {
      search: query || undefined,
      status: statusFilter !== 'Все статусы' ? statusFilter : undefined,
      tagId: tagFilter || undefined,
    };

    const extra: Record<string, unknown> = {};
    if (action === 'update_status') extra.status = value;
    else if (action === 'assign_manager') {
      extra.managerId = value;
      const m = managers.find((x) => x.id === value);
      extra.manager = m?.full_name ?? null;
    } else if (action === 'add_tag' || action === 'remove_tag')
      extra.tagId = value;

    await api.post('/universities/bulk', {
      filters,
      action,
      ...extra,
    });

    setSelectedIds([]);
    await reload();
    await reloadUniTags();
    await refreshTotal();
  };

  // ============================================================
  // SAVED VIEWS
  // ============================================================

  const applyView = (view: SavedView) => {
    const f = view.filters as {
      query?: string;
      status?: string;
      tagId?: string;
    };
    setQuery(f.query ?? '');
    setStatusFilter(f.status ?? 'Все статусы');
    setTagFilter(f.tagId ?? '');
  };

  const saveCurrentView = async (data: {
    name: string;
    color: string;
    shared: boolean;
    pinned: boolean;
  }) => {
    await createView({
      name: data.name,
      entity: 'universities',
      filters: { query, status: statusFilter, tagId: tagFilter },
      color: data.color,
      shared: data.shared,
      pinned: data.pinned,
    });
    setSaveViewOpen(false);
  };

  // ============================================================
  // ИМПОРТ CSV
  // ============================================================

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const { parseUniversitiesCSV } = await import('@/lib/dataIO');
      const { rows, errors } = parseUniversitiesCSV(text);
      if (errors.length) {
        setNotice(errors[0]);
        return;
      }
      if (!window.confirm(`Импортировать ${rows.length} вузов?`)) return;
      await api.post('/universities/import', { rows });
      await reload();
      await refreshTotal();
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'Не удалось прочитать файл.',
      );
    }
  };

  return (
    <div className="space-y-6">
      {notice && <Toast message={notice} onClose={() => setNotice('')} />}

      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Каталог партнёров</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Вузы
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Управляйте контактами, лицензиями и статусами взаимодействия.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSaveViewOpen(true)}>
            <Save size={15} /> Сохранить вид
          </Button>
          {canImport && (
            <>
              <Button variant="secondary" onClick={() => setWizardOpen(true)}>
                <FileSpreadsheet size={15} /> Excel
              </Button>
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={15} /> CSV
              </Button>
            </>
          )}
          {canExport && (
            <>
              <Button
                variant="secondary"
                onClick={() => void exportUniversitiesPdf(filtered)}
              >
                <FileDown size={15} /> PDF
              </Button>
              <Button
                variant="secondary"
                onClick={() => exportUniversitiesXls(filtered)}
              >
                <FileSpreadsheet size={15} /> XLS
              </Button>
              <Button
                variant="secondary"
                onClick={() => exportUniversitiesSpreadsheet(filtered, 'xlsx')}
              >
                <FileSpreadsheet size={15} /> Excel
              </Button>
            </>
          )}
          {canCreate && (
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus size={18} /> Добавить
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => void handleFileSelected(e)}
          />
        </div>
      </section>

      {isAdmin && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-900/40 text-violet-700 dark:text-violet-300 text-xs">
          <ShieldCheck size={15} /> Вы вошли как администратор — доступны
          импорт и экспорт.
        </div>
      )}

      {views.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {views.map((v) => {
            const c = tagColor(v.color ?? 'sky');
            const active =
              query === (v.filters as { query?: string }).query &&
              statusFilter ===
                ((v.filters as { status?: string }).status ?? 'Все статусы') &&
              tagFilter === ((v.filters as { tagId?: string }).tagId ?? '');
            return (
              <button
                key={v.id}
                onClick={() => applyView(v)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (window.confirm(`Удалить вид «${v.name}»?`)) {
                    void removeView(v.id);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? `${c.bg} ${c.text} ring-1 ${c.ring}`
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
                title="Правый клик — удалить"
              >
                {v.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск"
            className={`${inputClass} pl-10`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={`${selectClass} sm:w-44`}
        >
          <option>Все статусы</option>
          {UNIVERSITY_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className={`${selectClass} sm:w-44`}
        >
          <option value="">Все теги</option>
          {allTags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {selectedIds.length > 0 && (
        <p className="text-xs text-slate-400">
          Ctrl+C — скопировать выделенные как таблицу · Ctrl+V — вставить из
          Excel
        </p>
      )}

      {selected.length > 0 && (
        <BulkActionsBar
          selected={selected}
          allTags={allTags}
          managers={managers.map((m) => ({ id: m.id, name: m.full_name }))}
          onClear={() => setSelectedIds([])}
          onChangeStatus={bulkChangeStatus}
          onTransfer={bulkTransfer}
          onAddTag={bulkAddTag}
          onRemoveTag={bulkRemoveTag}
          onDelete={bulkDelete}
          onExport={bulkExport}
          canEdit={canUpdate}
          totalFiltered={totalFiltered}
          onApplyToAllFiltered={onApplyToAllFiltered}
        />
      )}

      {universities.length === 0 && !loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <EmptyState
            text="Ещё нет вузов"
            hint="Добавьте первый вуз"
            actionLabel={canCreate ? 'Добавить' : undefined}
            onAction={
              canCreate
                ? () => {
                    setEditing(null);
                    setModalOpen(true);
                  }
                : undefined
            }
            icon={Building2}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div
            ref={grid.ref}
            className="table-scroll outline-none"
            tabIndex={0}
            onCopy={grid.handleCopy}
            onPaste={grid.handlePaste}
          >
            <div style={{ minWidth: 1100 }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.length > 0 &&
                          selectedIds.length === filtered.length
                        }
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-sky-600"
                      />
                    </th>
                    <th className="text-left font-medium px-3 py-3">Название</th>
                    <th className="text-left font-medium px-3 py-3">Теги</th>
                    <th className="text-left font-medium px-3 py-3">
                      Направление
                    </th>
                    {customFields
                      .filter((f) => f.show_in_table)
                      .map((f) => (
                        <th
                          key={f.id}
                          className="text-left font-medium px-3 py-3"
                        >
                          {f.label}
                        </th>
                      ))}
                    <th className="text-left font-medium px-3 py-3">Статус</th>
                    <th className="text-left font-medium px-3 py-3">Передача</th>
                    <th className="text-left font-medium px-3 py-3">Связь</th>
                    <th className="text-left font-medium px-3 py-3">Менеджер</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const tagIds = uniTags[u.id] ?? [];
                    const uniTagObjects = allTags.filter((t) =>
                      tagIds.includes(t.id),
                    );
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                      >
                        <td
                          className="px-3 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(u.id)}
                            onChange={() => toggleSelect(u.id)}
                            className="w-4 h-4 rounded border-slate-300 text-sky-600"
                          />
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={() => setDetail(u)}
                              className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/40 flex items-center justify-center text-sky-600 dark:text-sky-300 flex-shrink-0"
                              aria-label="Открыть"
                            >
                              <Building2 size={15} />
                            </button>
                            <div className="min-w-0 flex-1">
                              <InlineEdit
                                value={u.name}
                                canEdit={canUpdate}
                                className="font-medium text-slate-700 dark:text-slate-200"
                                onSave={async (next) => {
                                  await api.patch(`/universities/${u.id}`, {
                                    name: next,
                                  });
                                  setNotice('Название сохранено.');
                                  await reload();
                                }}
                              />
                              <div className="text-xs text-slate-400">
                                {u.city} · {u.contact_name ?? '—'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td
                          className="px-3 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {uniTagObjects.slice(0, 2).map((t) => {
                              const c = tagColor(t.color);
                              return (
                                <span
                                  key={t.id}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text}`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${c.dot}`}
                                  />
                                  {t.name}
                                </span>
                              );
                            })}
                            {uniTagObjects.length > 2 && (
                              <span className="text-[10px] text-slate-400">
                                +{uniTagObjects.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-slate-600 dark:text-slate-300">
                          {u.direction}
                        </td>
                        {customFields
                          .filter((f) => f.show_in_table)
                          .map((f) => {
                            const v = columnToValue(
                              f,
                              valuesByUni[u.id]?.[f.id],
                            );
                            return (
                              <td
                                key={f.id}
                                className="px-3 py-3.5 text-slate-600 dark:text-slate-300 text-xs"
                              >
                                {v === null ||
                                v === undefined ||
                                v === '' ||
                                (Array.isArray(v) && v.length === 0)
                                  ? '—'
                                  : String(
                                      Array.isArray(v) ? v.join(', ') : v,
                                    )}
                              </td>
                            );
                          })}
                        <td className="px-3 py-3.5">
                          <StatusBadge status={u.status} />
                        </td>
                        <td className="px-3 py-3.5 text-xs text-slate-500">
                          {u.handover_status}
                        </td>
                        <td
                          className="px-3 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessengerLinks university={u} compact />
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-2">
                            <Avatar name={u.manager} size="sm" />
                            <span className="text-slate-600 dark:text-slate-300 text-xs">
                              {u.manager}
                            </span>
                          </div>
                        </td>
                        <td
                          className="px-3 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1">
                            {canUpdate && (
                              <button
                                onClick={() => {
                                  setEditing(u);
                                  setModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600"
                                aria-label="Редактировать"
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => void deleteUniversity(u)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                                aria-label="Удалить"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && !loading && (
                <EmptyState text="Ничего не найдено" />
              )}
            </div>
          </div>

          {hasMore && (
            <div className="p-4 text-center border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="secondary"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? 'Загрузка…' : 'Показать ещё'}
              </Button>
            </div>
          )}
        </div>
      )}

      {modalOpen && (
        <SimpleModal
          title={editing ? 'Редактировать вуз' : 'Добавить вуз'}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          wide
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Название вуза" wide>
                <input
                  name="name"
                  required
                  defaultValue={editing?.name ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Город">
                <input
                  name="city"
                  required
                  defaultValue={editing?.city ?? 'Москва'}
                  className={inputClass}
                />
              </Field>
              <Field label="Вендор">
                <select
                  name="vendor_id"
                  defaultValue={editing?.vendor_id ?? ''}
                  className={selectClass}
                >
                  <option value="">Не указан</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ИТ-направление (каталог)">
                <select
                  name="direction_id"
                  defaultValue={editing?.direction_id ?? ''}
                  className={selectClass}
                >
                  <option value="">Не указано</option>
                  {directions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ИТ-продукт (каталог)">
                <select
                  name="product_id"
                  defaultValue={editing?.product_id ?? ''}
                  className={selectClass}
                >
                  <option value="">Не указан</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Статус">
                <select
                  name="status"
                  defaultValue={editing?.status ?? 'Новый'}
                  className={selectClass}
                >
                  {UNIVERSITY_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Статус передачи ПО">
                <select
                  name="handover_status"
                  defaultValue={editing?.handover_status ?? 'Не передан'}
                  className={selectClass}
                >
                  {HANDOVER_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Ответственный">
                <select
                  name="manager_id"
                  defaultValue={editing?.manager_id ?? ''}
                  className={selectClass}
                  disabled={!canAssign}
                >
                  <option value="">— не назначен —</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Номер договора">
                <input
                  name="contract_number"
                  defaultValue={editing?.contract_number ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Срок лицензии">
                <input
                  name="license_expires_at"
                  type="date"
                  defaultValue={
                    editing?.license_expires_at
                      ? String(editing.license_expires_at).slice(0, 10)
                      : ''
                  }
                  className={inputClass}
                />
              </Field>
              <label className="flex items-center gap-2 sm:col-span-2 cursor-pointer">
                <input
                  name="license_signed"
                  type="checkbox"
                  defaultChecked={editing?.license_signed ?? false}
                  className="w-4 h-4 rounded border-slate-300 text-sky-600"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Лицензия подписана
                </span>
              </label>
              <Field label="Контактное лицо">
                <input
                  name="contact_name"
                  defaultValue={editing?.contact_name ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Телефон">
                <input
                  name="contact_phone"
                  defaultValue={editing?.contact_phone ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Email" wide>
                <input
                  name="contact_email"
                  type="email"
                  defaultValue={editing?.contact_email ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Telegram">
                <input
                  name="telegram"
                  defaultValue={editing?.telegram ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="WhatsApp">
                <input
                  name="whatsapp"
                  defaultValue={editing?.whatsapp ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="MAX">
                <input
                  name="max_messenger"
                  defaultValue={editing?.max_messenger ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Комментарий" wide>
                <textarea
                  name="notes"
                  defaultValue={editing?.notes ?? ''}
                  className={textareaClass}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setModalOpen(false);
                  setEditing(null);
                }}
              >
                Отмена
              </Button>
              <Button type="submit">{editing ? 'Сохранить' : 'Добавить'}</Button>
            </div>
          </form>
        </SimpleModal>
      )}

      {wizardOpen && (
        <ExcelImportWizard
          onClose={() => setWizardOpen(false)}
          onDone={reload}
          onNotice={setNotice}
        />
      )}

      {saveViewOpen && (
        <SaveViewModal
          onClose={() => setSaveViewOpen(false)}
          onSave={saveCurrentView}
        />
      )}

      {detail && (
        <UniversityDetailModal
          university={detail}
          customFields={customFields}
          customValues={valuesByUni[detail.id] ?? {}}
          tagIds={uniTags[detail.id] ?? []}
          allTags={allTags}
          onClose={() => setDetail(null)}
          onRefresh={async () => {
            await reload();
            await reloadUniTags();
          }}
          onNotice={setNotice}
        />
      )}
    </div>
  );
}