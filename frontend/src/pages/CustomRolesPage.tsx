import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Shield, Check } from 'lucide-react';
import {
  listCustomRoles, listPermissions, createCustomRole, updateCustomRole,
  deleteCustomRole, type CustomRole, type PermissionDef,
} from '@/lib/customRoles';
import {
  EmptyState, SimpleModal, Button, Field, inputClass, selectClass, StatusBadge,
} from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

interface Props { onNotice: (msg: string) => void; }

export function CustomRolesPage({ onNotice }: Props) {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([listCustomRoles(), listPermissions()]);
      setRoles(r);
      setPermissions(p);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => {
    const map: Record<string, PermissionDef[]> = {};
    permissions.forEach((p) => {
      if (!map[p.group]) map[p.group] = [];
      map[p.group].push(p);
    });
    return map;
  }, [permissions]);

  const remove = async (role: CustomRole) => {
    if (!window.confirm(`Удалить роль «${role.label}»?`)) return;
    const err = await deleteCustomRole(role.id);
    onNotice(err ? `Ошибка: ${err}` : 'Роль удалена.');
    if (!err) await load();
  };

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">RBAC</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Кастомные роли</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Пресеты permissions поверх базовой роли Keycloak
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus size={18} /> Новая роль
        </Button>
      </section>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Загрузка…</p>
      ) : roles.length === 0 ? (
        <EmptyState text="Ролей нет" icon={Shield} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((r) => (
            <div key={r.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border ${r.active ? 'border-slate-100 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800 opacity-70'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 flex items-center justify-center">
                  <Shield size={18} />
                </div>
                <StatusBadge status={r.active ? 'Активна' : 'Отключена'} />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{r.label}</h3>
              <code className="text-[10px] text-slate-400">{r.code} · base: {r.baseRole}</code>
              <p className="text-xs text-slate-500 mt-1">
                {r.permissions.length} разрешений
              </p>
              {r._count && (
                <p className="text-xs text-slate-400 mt-1">
                  Назначена: {r._count.profiles} польз.
                </p>
              )}
              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-50 dark:border-slate-800">
                <button onClick={() => { setEditing(r); setModalOpen(true); }}
                  className="p-2 rounded-lg text-slate-400 hover:text-sky-600" aria-label="Редактировать"
                ><Pencil size={14} /></button>
                <button onClick={() => void remove(r)}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-600" aria-label="Удалить"
                ><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <RoleEditorModal
          role={editing}
          grouped={grouped}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={load}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}

function RoleEditorModal({
  role, grouped, onClose, onSaved, onNotice,
}: {
  role: CustomRole | null;
  grouped: Record<string, PermissionDef[]>;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onNotice: (msg: string) => void;
}) {
  const [label, setLabel] = useState(role?.label ?? '');
  const [code, setCode] = useState(role?.code ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [baseRole, setBaseRole] = useState<'admin' | 'manager' | 'nam'>(role?.baseRole ?? 'nam');
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const [saving, setSaving] = useState(false);

  const toggle = (code: string) => {
    setSelected((s) => s.includes(code) ? s.filter((x) => x !== code) : [...s, code]);
  };

  const submit = async () => {
    if (!label.trim() || !code.trim()) return onNotice('Заполните название и код.');
    setSaving(true);
    const payload = {
      label: label.trim(),
      code: code.trim(),
      description: description.trim() || null,
      baseRole,
      permissions: selected,
      active: true,
      sortOrder: 100,
    };
    const err = role
      ? await updateCustomRole(role.id, payload)
      : await createCustomRole(payload);
    setSaving(false);
    if (err) return onNotice(`Ошибка: ${err}`);
    onNotice(role ? 'Роль обновлена.' : 'Роль создана.');
    await onSaved();
    onClose();
  };

  return (
    <SimpleModal title={role ? 'Редактировать роль' : 'Новая роль'} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Название">
            <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Код (латиница)">
            <input value={code} onChange={(e) => setCode(e.target.value)} disabled={!!role} className={inputClass} />
          </Field>
          <Field label="Базовая роль Keycloak">
            <select value={baseRole} onChange={(e) => setBaseRole(e.target.value as typeof baseRole)} className={selectClass}>
              <option value="nam">nam</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
            </select>
          </Field>
          <Field label="Описание" wide>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Разрешения</p>
          {Object.entries(grouped).map(([group, list]) => (
            <div key={group} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
              <p className="text-xs font-medium text-slate-500 mb-2">{group}</p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {list.map((p) => {
                  const on = selected.includes(p.code);
                  return (
                    <label key={p.code} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800">
                      <input type="checkbox" checked={on} onChange={() => toggle(p.code)} className="w-4 h-4 rounded border-slate-300 text-sky-600" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{p.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={() => void submit()} disabled={saving}>
            <Check size={14} /> {saving ? 'Сохранение…' : (role ? 'Сохранить' : 'Создать')}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}