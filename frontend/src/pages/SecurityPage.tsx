import { useEffect, useState, type FormEvent } from 'react';
import {
  ShieldCheck,
  Lock,
  Globe,
  Activity,
  FileText,
  Trash2,
  Plus,
  AlertTriangle,
  Download,
  Ban,
  Check,
  X,
  RefreshCw,
  Monitor,
} from 'lucide-react';
import type {
  UserSession,
  IpWhitelistEntry,
  SecurityEvent,
  PdConsent,
} from '@/types';
import {
  listMySessions,
  revokeSession,
  revokeAllMySessions,
  checkMyIp,
  listIpWhitelist,
  addIpEntry,
  toggleIpEntry,
  deleteIpEntry,
  listSecurityEvents,
  logSecurityEvent,
  listConsents,
  revokeConsent,
  downloadJson,
  SECURITY_EVENT_LABELS,
  SEVERITY_STYLES,
} from '@/lib/security';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  StatusBadge,
  EmptyState,
  SimpleModal,
  Button,
  Field,
  inputClass,
  selectClass,
  Avatar,
} from '@/components/ui';
import { asArray, formatDateTime } from '@/lib/utils';

type Tab = 'sessions' | 'ip' | 'events' | 'pd';

interface Props {
  currentRole: string;
  onNotice: (msg: string) => void;
}

export function SecurityPage({ currentRole, onNotice }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('sessions');
  const isAdmin = currentRole === 'admin';

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [ipEntries, setIpEntries] = useState<IpWhitelistEntry[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [consents, setConsents] = useState<PdConsent[]>([]);
  const [myIp, setMyIp] = useState<string | null>(null);
  const [myIpAllowed, setMyIpAllowed] = useState(true);
  const [loading, setLoading] = useState(true);

  const [ipModalOpen, setIpModalOpen] = useState(false);
  const [pdModalOpen, setPdModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    { kind: 'revoke-all' } | null
  >(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, ip, ev, pd, my] = await Promise.all([
        listMySessions(user?.profileId ?? undefined),
        isAdmin ? listIpWhitelist() : Promise.resolve([]),
        isAdmin ? listSecurityEvents(300) : Promise.resolve([]),
        listConsents(200),
        checkMyIp(),
      ]);
      setSessions(asArray(s));
      setIpEntries(asArray(ip));
      setEvents(asArray(ev));
      setConsents(asArray(pd));
      setMyIp(my.ip);
      setMyIpAllowed(my.allowed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.profileId, currentRole]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.profileId, currentRole]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Безопасность и 152-ФЗ</p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Безопасность
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Сессии, IP, события, обработка персональных данных
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Обновить"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </section>

      <div
        className={`flex items-center gap-3 p-4 rounded-xl border ${
          myIpAllowed
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
            : 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/40 text-rose-700 dark:text-rose-300'
        }`}
      >
        {myIpAllowed ? <Check size={18} /> : <Ban size={18} />}
        <div className="flex-1 text-sm">
          <p className="font-medium">Ваш IP: {myIp ?? '—'}</p>
          <p className="text-xs opacity-80">
            {myIpAllowed
              ? 'Доступ разрешён'
              : 'Доступ заблокирован IP-политикой'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {(
          [
            {
              key: 'sessions' as const,
              label: 'Мои сессии',
              icon: Monitor,
              admin: false,
            },
            { key: 'ip' as const, label: 'IP-доступ', icon: Globe, admin: true },
            {
              key: 'events' as const,
              label: 'Журнал',
              icon: Activity,
              admin: true,
            },
            {
              key: 'pd' as const,
              label: 'Персональные данные',
              icon: FileText,
              admin: false,
            },
          ] as const
        )
          .filter((t) => !t.admin || isAdmin)
          .map(({ key, label, icon: Icon }) => (
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

      {tab === 'sessions' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Активных сессий: {sessions.length}
            </p>
            {sessions.length > 1 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmAction({ kind: 'revoke-all' })}
              >
                <Ban size={13} /> Завершить все другие
              </Button>
            )}
          </div>
          {sessions.length === 0 && (
            <EmptyState text="Активных сессий нет" icon={Monitor} />
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 flex items-center justify-center">
                <Monitor size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {s.device_label ?? 'Неизвестное устройство'}{' '}
                  {s.ip ? `· ${s.ip}` : ''}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {s.user_agent ?? '—'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Активна с {formatDateTime(s.created_at)} · последняя
                  активность {formatDateTime(s.last_active_at)}
                </p>
              </div>
              <button
                onClick={() => void revokeSession(s.id).then(load)}
                className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                aria-label="Завершить сессию"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'ip' && isAdmin && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {ipEntries.filter((i) => i.enabled).length === 0
                ? 'Список пуст — доступ разрешён со всех IP'
                : `Разрешено диапазонов: ${ipEntries.filter((i) => i.enabled).length}`}
            </p>
            <Button size="sm" onClick={() => setIpModalOpen(true)}>
              <Plus size={13} />
              Добавить
            </Button>
          </div>
          <div className="space-y-2">
            {ipEntries.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    e.enabled
                      ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  <Globe size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium text-slate-700 dark:text-slate-200">
                    {e.cidr}
                  </p>
                  {e.label && (
                    <p className="text-xs text-slate-400">{e.label}</p>
                  )}
                </div>
                <StatusBadge status={e.enabled ? 'Активна' : 'Отключена'} />
                <button
                  onClick={() =>
                    void toggleIpEntry(e.id, !e.enabled).then(load)
                  }
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label={e.enabled ? 'Отключить' : 'Включить'}
                >
                  {e.enabled ? <X size={15} /> : <Check size={15} />}
                </button>
                <button
                  onClick={() => void deleteIpEntry(e.id).then(load)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                  aria-label="Удалить"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {ipEntries.length === 0 && (
              <EmptyState
                text="IP-диапазонов нет"
                hint="Доступ открыт для всех IP"
                icon={Globe}
              />
            )}
          </div>
        </div>
      )}

      {tab === 'events' && isAdmin && (
        <div className="space-y-2">
          {events.length === 0 ? (
            <EmptyState text="Событий нет" icon={Activity} />
          ) : (
            events.map((e) => (
              <div
                key={e.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      SEVERITY_STYLES[e.severity]
                    }`}
                  >
                    {e.severity === 'info' ? (
                      <ShieldCheck size={15} />
                    ) : (
                      <AlertTriangle size={15} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {SECURITY_EVENT_LABELS[e.event_type] ?? e.event_type}
                      </p>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {formatDateTime(e.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                      {e.email && (
                        <span className="flex items-center gap-1">
                          <Avatar name={e.email} size="sm" />
                          {e.email}
                        </span>
                      )}
                      {e.ip && <span className="font-mono">{e.ip}</span>}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                      SEVERITY_STYLES[e.severity]
                    }`}
                  >
                    {e.severity === 'critical'
                      ? 'критично'
                      : e.severity === 'warning'
                        ? 'важно'
                        : 'инфо'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'pd' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
              152-ФЗ: права субъектов ПД
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Экспорт и удаление персональных данных по email контакта.
              Поддерживаются категории «contact» и «identity» (УЗ-1).
            </p>
            <Button onClick={() => setPdModalOpen(true)}>
              <FileText size={15} /> Экспорт / удаление по email
            </Button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
              Журнал согласий
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Все выданные согласия на обработку ПД
            </p>
            {consents.length === 0 ? (
              <EmptyState text="Согласий пока нет" icon={Lock} />
            ) : (
              <div className="space-y-2">
                {consents.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        c.granted
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                      }`}
                    >
                      {c.granted ? <Check size={14} /> : <X size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                        {c.subject_name ?? c.subject_email}
                      </p>
                      <p className="text-xs text-slate-400">
                        {c.subject_email} · {formatDateTime(c.granted_at)}
                        {c.revoked_at &&
                          ` · отозвано ${formatDateTime(c.revoked_at)}`}
                      </p>
                    </div>
                    {c.granted && (
                      <button
                        onClick={() =>
                          void revokeConsent(
                            c.id,
                            'Отозвано пользователем',
                          ).then(load)
                        }
                        className="text-xs text-rose-500 hover:text-rose-600 font-medium"
                      >
                        Отозвать
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {ipModalOpen && (
        <SimpleModal
          title="Новый IP-диапазон"
          onClose={() => setIpModalOpen(false)}
        >
          <form
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const err = await addIpEntry(
                String(data.get('cidr')),
                String(data.get('label') ?? ''),
              );
              if (err) {
                onNotice(`Ошибка: ${err}`);
                return;
              }
              onNotice('IP-диапазон добавлен.');
              setIpModalOpen(false);
              await load();
            }}
            className="space-y-4"
          >
            <Field label="CIDR или IP">
              <input
                name="cidr"
                required
                placeholder="192.168.1.0/24 или 10.0.0.5"
                className={inputClass}
              />
            </Field>
            <Field label="Комментарий">
              <input
                name="label"
                placeholder="Офис Москва"
                className={inputClass}
              />
            </Field>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle size={12} className="inline mr-1" />
              Как только добавите хотя бы один IP — доступ со всех остальных
              будет заблокирован.
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setIpModalOpen(false)}
              >
                Отмена
              </Button>
              <Button type="submit">Добавить</Button>
            </div>
          </form>
        </SimpleModal>
      )}

      {pdModalOpen && (
        <PdModal
          onClose={() => setPdModalOpen(false)}
          onNotice={onNotice}
          onDone={load}
        />
      )}

      {confirmAction?.kind === 'revoke-all' && (
        <SimpleModal
          title="Завершить все другие сессии?"
          onClose={() => setConfirmAction(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Все устройства, кроме текущего, потеряют доступ. Вы останетесь
              в системе.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setConfirmAction(null)}
              >
                Отмена
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (!user?.profileId) return;
                  await revokeAllMySessions(user.profileId);
                  await logSecurityEvent({
                    event_type: 'session_revoked',
                    severity: 'warning',
                    user_id: user.profileId,
                    email: user.email,
                  });
                  onNotice('Все другие сессии завершены.');
                  setConfirmAction(null);
                  await load();
                }}
              >
                <Ban size={14} /> Завершить
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}

/**
 * Модалка 152-ФЗ: экспорт и удаление ПД.
 * Категория 'universities' — контакты вузов (УЗ-2),
 * 'learners' — слушатели (УЗ-1, удостоверяющие документы).
 */
function PdModal({
  onClose,
  onNotice,
  onDone,
}: {
  onClose: () => void;
  onNotice: (m: string) => void;
  onDone: () => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [scope, setScope] = useState<'universities' | 'learners'>(
    'universities',
  );
  const [busy, setBusy] = useState<'export' | 'forget' | null>(null);

  const doExport = async () => {
    if (!email.trim()) return;
    setBusy('export');
    try {
      const endpoint =
        scope === 'learners'
          ? '/security/pd/export-learner'
          : '/security/pd/export';
      const data = await api.post<Record<string, unknown>>(endpoint, {
        email: email.trim(),
      });
      downloadJson(`pd-export-${scope}-${email}.json`, data);
      await logSecurityEvent({
        event_type: 'pd_export',
        severity: 'info',
        details: {
          subject_email: email,
          scope,
          piiCategory: scope === 'learners' ? 'identity' : 'contact',
        },
      });
      onNotice('Экспорт готов, файл скачан.');
      await onDone();
    } finally {
      setBusy(null);
    }
  };

  const doForget = async () => {
    if (!email.trim()) return;
    if (
      !window.confirm(
        `Удалить (анонимизировать) все ПД по адресу ${email}? Это необратимо.`,
      )
    )
      return;
    setBusy('forget');
    try {
      const endpoint =
        scope === 'learners'
          ? '/security/pd/forget-learner'
          : '/security/pd/forget';
      const r = await api.post<{ ok: boolean; updated?: number }>(endpoint, {
        email: email.trim(),
      });
      onNotice(`Удалено ПД в ${r.updated ?? 0} записях.`);
      await onDone();
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <SimpleModal title="152-ФЗ: экспорт / удаление" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Категория субъекта ПД">
          <select
            value={scope}
            onChange={(e) =>
              setScope(e.target.value as 'universities' | 'learners')
            }
            className={selectClass}
          >
            <option value="universities">Контакты вузов (contact)</option>
            <option value="learners">
              Слушатели — паспорт/СНИЛС/диплом (identity, УЗ-1)
            </option>
          </select>
        </Field>

        <Field label="Email субъекта ПД">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@example.ru"
            className={inputClass}
          />
        </Field>

        <div className="flex gap-3">
          <Button
            onClick={() => void doExport()}
            disabled={!email.trim() || !!busy}
          >
            <Download size={14} />
            {busy === 'export' ? 'Экспорт…' : 'Экспорт JSON'}
          </Button>
          <Button
            variant="danger"
            onClick={() => void doForget()}
            disabled={!email.trim() || !!busy}
          >
            <Trash2 size={14} />
            {busy === 'forget' ? 'Удаление…' : 'Удалить ПД'}
          </Button>
        </div>

        {scope === 'learners' && (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle size={12} className="inline mr-1" />
            Уровень УЗ-1. Доступ логируется в PII Access Log с категорией
            «identity». Требуется 2FA.
          </div>
        )}
      </div>
    </SimpleModal>
  );
}