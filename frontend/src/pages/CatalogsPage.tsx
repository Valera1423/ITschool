import { useEffect, useState, type FormEvent } from 'react';
import {
  Building2,
  Briefcase,
  Layers,
  Mail,
  Package,
  Pencil,
  Phone,
  Plus,
  Tag,
  Trash2,
  Upload,
  UserCircle,
} from 'lucide-react';
import type {
  Vendor,
  ItDirection,
  ItProduct,
  WorkflowStatusCatalog,
  Manager,
} from '@/types';
import {
  listVendors,
  upsertVendor,
  deleteVendor,
  listDirections,
  upsertDirection,
  deleteDirection,
  listProducts,
  upsertProduct,
  deleteProduct,
  listManagers,
  createManager,
  updateManager,
  deleteManager,
} from '@/lib/catalogs';
import {
  listStatusCatalog,
  upsertStatusCatalog,
  deleteStatusCatalog,
} from '@/lib/workflow';
import {
  EmptyState,
  SimpleModal,
  Button,
  Field,
  inputClass,
  selectClass,
  StatusBadge,
  Avatar,
} from '@/components/ui';
import { TAG_COLORS, tagColor } from '@/lib/tags';
import { CatalogImportModal } from '@/components/CatalogImportModal';

type Tab = 'vendors' | 'directions' | 'products' | 'managers' | 'statuses';

interface Props {
  onNotice: (msg: string) => void;
}

export function CatalogsPage({ onNotice }: Props) {
  const [tab, setTab] = useState<Tab>('vendors');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [directions, setDirections] = useState<ItDirection[]>([]);
  const [products, setProducts] = useState<ItProduct[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [statuses, setStatuses] = useState<WorkflowStatusCatalog[]>([]);

  const load = async () => {
    const [v, d, p, m, s] = await Promise.all([
      listVendors(),
      listDirections(),
      listProducts(),
      listManagers(),
      listStatusCatalog(),
    ]);
    setVendors(v);
    setDirections(d);
    setProducts(p);
    setManagers(m);
    setStatuses(s);
  };

  useEffect(() => {
    void load();
  }, []);

  const TABS: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: 'vendors', label: 'Вендоры', icon: Building2 },
    { key: 'directions', label: 'Направления', icon: Layers },
    { key: 'products', label: 'Продукты', icon: Package },
    { key: 'managers', label: 'Ответственные', icon: UserCircle },
    { key: 'statuses', label: 'Статусы workflow', icon: Tag },
  ];

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-slate-400 mb-1">Управление справочниками</p>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Каталоги
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Вендоры, ИТ-направления, ИТ-продукты, ответственные и статусы workflow
        </p>
      </section>

      <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'vendors' && (
        <VendorsTab data={vendors} onReload={load} onNotice={onNotice} />
      )}
      {tab === 'directions' && (
        <DirectionsTab data={directions} onReload={load} onNotice={onNotice} />
      )}
      {tab === 'products' && (
        <ProductsTab
          data={products}
          vendors={vendors}
          onReload={load}
          onNotice={onNotice}
        />
      )}
      {tab === 'managers' && (
        <ManagersTab data={managers} onReload={load} onNotice={onNotice} />
      )}
      {tab === 'statuses' && (
        <StatusesTab data={statuses} onReload={load} onNotice={onNotice} />
      )}
    </div>
  );
}

// ============================================================
// VENDORS
// ============================================================
function VendorsTab({
  data,
  onReload,
  onNotice,
}: {
  data: Vendor[];
  onReload: () => Promise<void>;
  onNotice: (m: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const methods = String(f.get('contact_methods') ?? '')
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const err = await upsertVendor({
      id: editing?.id,
      name: String(f.get('name')),
      description: String(f.get('description') ?? ''),
      site: String(f.get('site') ?? ''),
      contactName: String(f.get('contact_name') ?? ''),
      contactPhone: String(f.get('contact_phone') ?? ''),
      contactEmail: String(f.get('contact_email') ?? ''),
      contactMethods: methods,
    });
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    onNotice(editing ? 'Вендор обновлён.' : 'Вендор добавлен.');
    setModalOpen(false);
    setEditing(null);
    await onReload();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setImportOpen(true)}
        >
          <Upload size={13} /> Импорт Excel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={13} /> Добавить
        </Button>
      </div>

      {data.length === 0 ? (
        <EmptyState text="Вендоров нет" icon={Building2} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.map((v) => (
            <div
              key={v.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 flex items-center justify-center">
                  <Building2 size={16} />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditing(v);
                      setModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600"
                    aria-label="Редактировать"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => {
                      if (!window.confirm(`Удалить «${v.name}»?`)) return;
                      void deleteVendor(v.id).then(() => onReload());
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                    aria-label="Удалить"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {v.name}
              </p>
              {v.contact_name && (
                <p className="text-xs text-slate-500 mt-1">
                  {v.contact_name}
                  {v.contact_phone ? ` · ${v.contact_phone}` : ''}
                  {v.contact_email ? ` · ${v.contact_email}` : ''}
                </p>
              )}
              {v.contact_methods && v.contact_methods.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {v.contact_methods.map((m) => (
                    <span
                      key={m}
                      className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}
              {v.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {v.description}
                </p>
              )}
              {v.site && (
                <a
                  href={v.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sky-600 hover:underline mt-2 block"
                >
                  {v.site}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <SimpleModal
          title={editing ? 'Редактировать вендора' : 'Новый вендор'}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        >
          <form onSubmit={submit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Название" wide>
                <input
                  name="name"
                  required
                  defaultValue={editing?.name ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Описание" wide>
                <input
                  name="description"
                  defaultValue={editing?.description ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Сайт" wide>
                <input
                  name="site"
                  type="url"
                  defaultValue={editing?.site ?? ''}
                  className={inputClass}
                />
              </Field>
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
              <Field label="Email">
                <input
                  name="contact_email"
                  type="email"
                  defaultValue={editing?.contact_email ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Способы связи (через запятую)">
                <input
                  name="contact_methods"
                  defaultValue={(editing?.contact_methods ?? []).join(', ')}
                  placeholder="Почта, Чат в ТГ"
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                type="button"
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

      {importOpen && (
        <CatalogImportModal
          entity="vendors"
          entityLabel="Вендоры"
          onClose={() => setImportOpen(false)}
          onImported={onReload}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}

// ============================================================
// DIRECTIONS
// ============================================================
function DirectionsTab({
  data,
  onReload,
  onNotice,
}: {
  data: ItDirection[];
  onReload: () => Promise<void>;
  onNotice: (m: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<ItDirection | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const err = await upsertDirection({
      id: editing?.id,
      name: String(f.get('name')),
      code: String(f.get('code') ?? ''),
      description: String(f.get('description') ?? ''),
      color: String(f.get('color') ?? 'sky'),
      sort_order: Number(f.get('sort_order')) || 100,
    });
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    onNotice(editing ? 'Направление обновлено.' : 'Направление добавлено.');
    setModalOpen(false);
    setEditing(null);
    await onReload();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setImportOpen(true)}
        >
          <Upload size={13} /> Импорт Excel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={13} /> Добавить
        </Button>
      </div>
      {data.length === 0 ? (
        <EmptyState text="Направлений нет" icon={Layers} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.map((d) => {
            const c = tagColor(d.color);
            return (
              <div
                key={d.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg} ${c.text}`}
                  >
                    <Layers size={16} />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(d);
                        setModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600"
                      aria-label="Редактировать"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => {
                        if (!window.confirm(`Удалить «${d.name}»?`)) return;
                        void deleteDirection(d.id).then(() => onReload());
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                      aria-label="Удалить"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {d.name}
                </p>
                {d.code && (
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {d.code}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <SimpleModal
          title={editing ? 'Редактировать направление' : 'Новое направление'}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        >
          <form onSubmit={submit} className="space-y-4">
            <Field label="Название">
              <input
                name="name"
                required
                defaultValue={editing?.name ?? ''}
                className={inputClass}
              />
            </Field>
            <Field label="Код">
              <input
                name="code"
                defaultValue={editing?.code ?? ''}
                className={inputClass}
              />
            </Field>
            <Field label="Цвет">
              <div className="flex gap-2 flex-wrap">
                {TAG_COLORS.map((col) => {
                  const c = tagColor(col);
                  return (
                    <label key={col} className="cursor-pointer">
                      <input
                        type="radio"
                        name="color"
                        value={col}
                        defaultChecked={(editing?.color ?? 'sky') === col}
                        className="hidden peer"
                      />
                      <div
                        className={`w-7 h-7 rounded-full ${c.dot} peer-checked:ring-2 peer-checked:ring-offset-2`}
                      />
                    </label>
                  );
                })}
              </div>
            </Field>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                type="button"
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

      {importOpen && (
        <CatalogImportModal
          entity="directions"
          entityLabel="Направления"
          onClose={() => setImportOpen(false)}
          onImported={onReload}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}

// ============================================================
// PRODUCTS
// ============================================================
function ProductsTab({
  data,
  vendors,
  onReload,
  onNotice,
}: {
  data: ItProduct[];
  vendors: Vendor[];
  onReload: () => Promise<void>;
  onNotice: (m: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<ItProduct | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const vendorId = String(f.get('vendor_id') ?? '');
    const err = await upsertProduct({
      id: editing?.id,
      name: String(f.get('name')),
      vendor_id: vendorId || null,
      description: String(f.get('description') ?? ''),
      license_type: String(f.get('license_type') ?? ''),
      sort_order: Number(f.get('sort_order')) || 100,
    });
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    onNotice(editing ? 'Продукт обновлён.' : 'Продукт добавлен.');
    setModalOpen(false);
    setEditing(null);
    await onReload();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setImportOpen(true)}
        >
          <Upload size={13} /> Импорт Excel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={13} /> Добавить
        </Button>
      </div>
      {data.length === 0 ? (
        <EmptyState text="Продуктов нет" icon={Package} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.map((p) => {
            const v = vendors.find((x) => x.id === p.vendor_id);
            return (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 flex items-center justify-center">
                    <Package size={16} />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(p);
                        setModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600"
                      aria-label="Редактировать"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => {
                        if (!window.confirm(`Удалить «${p.name}»?`)) return;
                        void deleteProduct(p.id).then(() => onReload());
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                      aria-label="Удалить"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {p.name}
                </p>
                {v && (
                  <p className="text-xs text-sky-600 dark:text-sky-400 mt-0.5">
                    {v.name}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <SimpleModal
          title={editing ? 'Редактировать продукт' : 'Новый продукт'}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        >
          <form onSubmit={submit} className="space-y-4">
            <Field label="Название">
              <input
                name="name"
                required
                defaultValue={editing?.name ?? ''}
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
            <Field label="Тип лицензии">
              <input
                name="license_type"
                defaultValue={editing?.license_type ?? ''}
                className={inputClass}
              />
            </Field>
            <Field label="Описание">
              <input
                name="description"
                defaultValue={editing?.description ?? ''}
                className={inputClass}
              />
            </Field>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                type="button"
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

      {importOpen && (
        <CatalogImportModal
          entity="products"
          entityLabel="Продукты"
          onClose={() => setImportOpen(false)}
          onImported={onReload}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}

// ============================================================
// MANAGERS
// ============================================================
function ManagersTab({
  data,
  onReload,
  onNotice,
}: {
  data: Manager[];
  onReload: () => Promise<void>;
  onNotice: (m: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Manager | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      full_name: String(f.get('full_name')),
      email: String(f.get('email') ?? '') || null,
      phone: String(f.get('phone') ?? '') || null,
      position: String(f.get('position') ?? '') || null,
      department: String(f.get('department') ?? '') || null,
      avatar_color: String(f.get('avatar_color') ?? 'blue'),
      active: f.get('active') === 'on',
      sort_order: Number(f.get('sort_order')) || 100,
      notes: String(f.get('notes') ?? '') || null,
    };
    const err = editing
      ? await updateManager(editing.id, payload)
      : await createManager(payload);
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    onNotice(editing ? 'Обновлено.' : 'Добавлено.');
    setModalOpen(false);
    setEditing(null);
    await onReload();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setImportOpen(true)}
        >
          <Upload size={13} /> Импорт Excel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={13} /> Добавить
        </Button>
      </div>

      {data.length === 0 ? (
        <EmptyState text="Ответственных нет" icon={UserCircle} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.map((m) => (
            <div
              key={m.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border ${
                m.active
                  ? 'border-slate-100 dark:border-slate-800'
                  : 'border-slate-200 dark:border-slate-800 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <Avatar
                  name={m.full_name}
                  size="lg"
                  color={
                    (m.avatar_color as
                      | 'blue'
                      | 'green'
                      | 'orange'
                      | 'purple') ?? 'blue'
                  }
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditing(m);
                      setModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600"
                    aria-label="Редактировать"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => {
                      if (!window.confirm(`Удалить «${m.full_name}»?`)) return;
                      void deleteManager(m.id).then(() => onReload());
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                    aria-label="Удалить"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {m.full_name}
              </p>
              {m.position && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                  <Briefcase size={11} />
                  {m.position}
                </p>
              )}
              <div className="space-y-1 mt-2">
                {m.email && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Mail size={11} />
                    {m.email}
                  </p>
                )}
                {m.phone && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone size={11} />
                    {m.phone}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <SimpleModal
          title={
            editing ? 'Редактировать ответственного' : 'Новый ответственный'
          }
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        >
          <form onSubmit={submit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="ФИО" wide>
                <input
                  name="full_name"
                  required
                  defaultValue={editing?.full_name ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Должность">
                <input
                  name="position"
                  defaultValue={editing?.position ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Отдел">
                <input
                  name="department"
                  defaultValue={editing?.department ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Email">
                <input
                  name="email"
                  type="email"
                  defaultValue={editing?.email ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Телефон">
                <input
                  name="phone"
                  defaultValue={editing?.phone ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Порядок">
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={editing?.sort_order ?? 100}
                  className={inputClass}
                />
              </Field>
              <Field label="Цвет аватара">
                <select
                  name="avatar_color"
                  defaultValue={editing?.avatar_color ?? 'blue'}
                  className={selectClass}
                >
                  {['blue', 'green', 'orange', 'purple'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={editing?.active ?? true}
                  className="w-4 h-4 rounded border-slate-300 text-sky-600"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Активен
                </span>
              </label>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                type="button"
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

      {importOpen && (
        <CatalogImportModal
          entity="managers"
          entityLabel="Ответственные"
          onClose={() => setImportOpen(false)}
          onImported={onReload}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}

// ============================================================
// STATUSES
// ============================================================
function StatusesTab({
  data,
  onReload,
  onNotice,
}: {
  data: WorkflowStatusCatalog[];
  onReload: () => Promise<void>;
  onNotice: (m: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkflowStatusCatalog | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const err = await upsertStatusCatalog({
      id: editing?.id,
      code: String(f.get('code')),
      label: String(f.get('label')),
      color: String(f.get('color') ?? 'slate'),
      sort_order: Number(f.get('sort_order')) || 100,
      is_final: f.get('is_final') === 'on',
    });
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    onNotice(editing ? 'Обновлён.' : 'Добавлен.');
    setModalOpen(false);
    setEditing(null);
    await onReload();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={13} />
          Добавить
        </Button>
      </div>

      {data.length === 0 ? (
        <EmptyState text="Статусов нет" icon={Tag} />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <th className="text-left font-medium px-4 py-3">Код</th>
                <th className="text-left font-medium px-4 py-3">Отображение</th>
                <th className="text-left font-medium px-4 py-3">Цвет</th>
                <th className="text-center font-medium px-4 py-3">Финальный</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-50 dark:border-slate-800 last:border-0"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {s.code}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.label} />
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className={`inline-block w-4 h-4 rounded-full ${tagColor(s.color).dot}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.is_final ? '✓' : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditing(s);
                          setModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600"
                        aria-label="Редактировать"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (!window.confirm(`Удалить статус «${s.label}»?`))
                            return;
                          void deleteStatusCatalog(s.id).then(() => onReload());
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                        aria-label="Удалить"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <SimpleModal
          title={editing ? 'Редактировать статус' : 'Новый статус'}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        >
          <form onSubmit={submit} className="space-y-4">
            <Field label="Код (латиница)">
              <input
                name="code"
                required
                defaultValue={editing?.code ?? ''}
                className={inputClass}
              />
            </Field>
            <Field label="Отображение">
              <input
                name="label"
                required
                defaultValue={editing?.label ?? ''}
                className={inputClass}
              />
            </Field>
            <Field label="Цвет">
              <div className="flex gap-2 flex-wrap">
                {TAG_COLORS.map((col) => {
                  const c = tagColor(col);
                  return (
                    <label key={col} className="cursor-pointer">
                      <input
                        type="radio"
                        name="color"
                        value={col}
                        defaultChecked={(editing?.color ?? 'slate') === col}
                        className="hidden peer"
                      />
                      <div
                        className={`w-7 h-7 rounded-full ${c.dot} peer-checked:ring-2 peer-checked:ring-offset-2`}
                      />
                    </label>
                  );
                })}
              </div>
            </Field>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                name="is_final"
                type="checkbox"
                defaultChecked={editing?.is_final ?? false}
                className="w-4 h-4 rounded border-slate-300 text-sky-600"
              />
              <span className="text-sm text-slate-600 dark:text-slate-300">
                Финальный статус
              </span>
            </label>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                type="button"
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
    </div>
  );
}