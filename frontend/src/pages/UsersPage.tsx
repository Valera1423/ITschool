// frontend/src/pages/UsersPage.tsx
import { useState, type FormEvent } from 'react';
import {
  Pencil,
  Trash2,
  ShieldCheck,
  Shield,
  Lock,
  Unlock,
  Search,
  Mail,
  KeyRound,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type { Profile, UserRole } from '@/types';
import { USER_ROLES } from '@/constants';
import { roleLabel } from '@/lib/roles';
import {
  StatusBadge,
  EmptyState,
  SimpleModal,
  Button,
  Avatar,
  Field,
  inputClass,
  selectClass,
} from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { asArray } from '@/lib/utils';
import { UserScopeModal } from '@/components/UserScopeModal';
import { InviteUserModal } from '@/components/InviteUserModal';

/**
 * Управление пользователями.
 * Новые сотрудники регистрируются через Keycloak, здесь — роли и блокировки.
 * Плюс — разграничение доступа к данным через user_scopes.
 */
interface Props {
  users: Profile[];
  onNotice: (notice: string) => void;
  onRefresh: () => Promise<void>;
  currentRole: string;
  currentUserId: string;
}

export function UsersPage({
  users,
  onNotice,
  onRefresh,
  currentRole,
  currentUserId,
}: Props) {
  const api = useApi();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'Все' | UserRole>('Все');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [scopeFor, setScopeFor] = useState<Profile | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const isAdmin = currentRole === 'admin';
  const safeUsers = asArray<Profile>(users);

  const filtered = safeUsers.filter(
    (u) =>
      `${u.full_name} ${u.email}`.toLowerCase().includes(query.toLowerCase()) &&
      (roleFilter === 'Все' || u.role === roleFilter),
  );

  const toggleBlock = async (u: Profile) => {
    if (!isAdmin) {
      onNotice('Только администратор может блокировать.');
      return;
    }
    if (u.id === currentUserId && !u.blocked) {
      onNotice('Нельзя заблокировать самого себя.');
      return;
    }
    if (u.role === 'admin' && !u.blocked) {
      const admins = safeUsers.filter((x) => x.role === 'admin' && !x.blocked);
      if (admins.length <= 1) {
        onNotice('Нельзя заблокировать единственного администратора.');
        return;
      }
    }
    setBusy(u.id);
    try {
      await api.post(`/users/${u.id}/block`, { blocked: !u.blocked });
      onNotice(u.blocked ? 'Разблокирован.' : 'Заблокирован.');
      await onRefresh();
    } finally {
      setBusy(null);
    }
  };

  const changeRole = async (u: Profile, role: UserRole) => {
    if (!isAdmin) {
      onNotice('Только администратор может менять роли.');
      return;
    }
    if (u.id === currentUserId && role !== 'admin') {
      onNotice('Нельзя снять с себя роль админа.');
      return;
    }
    setBusy(u.id);
    try {
      await api.patch(`/users/${u.id}/role`, { role });
      onNotice(`Роль: ${roleLabel(role)}.`);
      await onRefresh();
    } finally {
      setBusy(null);
    }
  };

  const deleteUser = async (u: Profile) => {
    if (!isAdmin) {
      onNotice('Только администратор может удалять.');
      return;
    }
    if (u.id === currentUserId) {
      onNotice('Нельзя удалить самого себя.');
      return;
    }
    if (!window.confirm(`Удалить профиль «${u.full_name}»?`)) return;
    setBusy(u.id);
    try {
      await api.delete(`/users/${u.id}`);
      onNotice('Профиль удалён.');
      await onRefresh();
    } finally {
      setBusy(null);
    }
  };

  const resetPassword = async (u: Profile) => {
    if (!window.confirm(`Отправить ссылку для сброса пароля на ${u.email}?`))
      return;
    await api.post(`/users/${u.id}/reset-password`);
    onNotice('Письмо отправлено.');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const data: Record<string, string> = {};
    new FormData(e.currentTarget).forEach((v, k) => {
      data[k] = String(v);
    });
    await api.patch(`/users/${editing.id}`, {
      fullName: data.full_name,
      role: data.role,
      avatarColor: data.avatar_color,
      blocked: data.blocked === 'on',
    });
    onNotice('Профиль обновлён.');
    setModalOpen(false);
    setEditing(null);
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">
            Команда и права доступа
          </p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Пользователи
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Роли, блокировка, сброс пароля, ограничения по данным.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus size={18} /> Пригласить сотрудника
          </Button>
        )}
      </section>

      {!isAdmin && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 text-sm">
          <ShieldCheck size={18} />
          Режим просмотра. Управление доступно только администратору.
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
            placeholder="Поиск по имени или email"
            className={`${inputClass} pl-10`}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
          className={`${selectClass} sm:w-52`}
        >
          <option>Все</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((u) => (
          <div
            key={u.id}
            className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border shadow-sm ${
              u.blocked
                ? 'border-rose-100 dark:border-rose-900/60 opacity-70'
                : 'border-slate-100 dark:border-slate-800'
            }`}
          >
            <div className="flex items-start gap-3 mb-3">
              <Avatar
                name={u.full_name}
                size="lg"
                color={
                  (u.avatar_color as
                    | 'blue'
                    | 'green'
                    | 'orange'
                    | 'purple') ?? 'blue'
                }
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {u.full_name}{' '}
                  {u.id === currentUserId && (
                    <span className="text-xs text-sky-600 font-normal">
                      (вы)
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400 truncate">{u.email}</p>
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <StatusBadge status={roleLabel(u.role)} />
                  {u.blocked && (
                    <span className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/40 px-2 py-0.5 rounded">
                      Заблокирован
                    </span>
                  )}
                  {u.totp_enabled && (
                    <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 px-2 py-0.5 rounded flex items-center gap-1">
                      <KeyRound size={10} />
                      2FA
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
              <p className="flex items-center gap-1.5">
                <Mail size={12} />
                {u.email}
              </p>
              {u.last_login_at && (
                <p className="text-[11px] text-slate-400">
                  Последний вход:{' '}
                  {new Date(u.last_login_at).toLocaleString('ru-RU')}
                </p>
              )}
            </div>

            {isAdmin && (
              <>
                <div className="mb-3">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      void changeRole(u, e.target.value as UserRole)
                    }
                    className={`${selectClass} text-xs py-1.5`}
                    disabled={u.id === currentUserId || busy === u.id}
                  >
                    {USER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1 pt-3 border-t border-slate-50 dark:border-slate-800">
                  <button
                    onClick={() => setScopeFor(u)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-600 transition-colors"
                    title="Ограничить доступ к данным"
                    aria-label="Ограничить доступ"
                  >
                    <Shield size={15} />
                  </button>
                  <button
                    onClick={() => void toggleBlock(u)}
                    disabled={u.id === currentUserId || busy === u.id}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
                      u.blocked
                        ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                        : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30'
                    }`}
                    aria-label={u.blocked ? 'Разблокировать' : 'Заблокировать'}
                  >
                    {u.blocked ? <Unlock size={15} /> : <Lock size={15} />}
                  </button>
                  <button
                    onClick={() => void resetPassword(u)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600 transition-colors"
                    aria-label="Сбросить пароль"
                  >
                    <KeyRound size={15} />
                  </button>
                  <button
                    onClick={() => {
                      setEditing(u);
                      setModalOpen(true);
                    }}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600 transition-colors"
                    aria-label="Редактировать"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => void deleteUser(u)}
                    disabled={u.id === currentUserId || busy === u.id}
                    className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 transition-colors disabled:opacity-40"
                    aria-label="Удалить"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState
              text="Пользователи не найдены"
              icon={UserCheck}
              hint="Отправьте сотруднику ссылку на страницу регистрации"
            />
          </div>
        )}
      </div>

      {modalOpen && editing && (
        <SimpleModal
          title="Редактировать пользователя"
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="ФИО" wide>
                <input
                  name="full_name"
                  required
                  defaultValue={editing.full_name}
                  className={inputClass}
                />
              </Field>
              <Field label="Email" wide>
                <input
                  value={editing.email}
                  readOnly
                  className={`${inputClass} bg-slate-50 dark:bg-slate-800`}
                />
              </Field>
              <Field label="Роль">
                <select
                  name="role"
                  defaultValue={editing.role}
                  className={selectClass}
                >
                  {USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Цвет аватара">
                <select
                  name="avatar_color"
                  defaultValue={editing.avatar_color}
                  className={selectClass}
                >
                  {['blue', 'green', 'orange', 'purple'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 sm:col-span-2 cursor-pointer">
                <input
                  name="blocked"
                  type="checkbox"
                  defaultChecked={editing.blocked}
                  className="w-4 h-4 rounded border-slate-300 text-sky-600"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Заблокировать доступ
                </span>
              </label>
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
              <Button type="submit">Сохранить</Button>
            </div>
          </form>
        </SimpleModal>
      )}

      {scopeFor && (
        <UserScopeModal
          user={scopeFor}
          onClose={() => setScopeFor(null)}
          onNotice={onNotice}
        />
      )}

      {inviteOpen && (
        <InviteUserModal
          onClose={() => setInviteOpen(false)}
          onInvited={onRefresh}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}