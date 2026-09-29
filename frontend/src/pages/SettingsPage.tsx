import { useEffect, useState } from 'react';
import {
  Save,
  Bell,
  Palette,
  User as UserIcon,
  Mail,
  Settings as SettingsIcon,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfileSelf } from '@/lib/auth';
import { getPreferences, updatePreferences } from '@/lib/onboarding';
import { MfaSetupPage } from '@/pages/MfaSetupPage';
import { Field, Button, inputClass, Avatar } from '@/components/ui';
import { roleLabel } from '@/lib/roles';
import type { Profile, UserPreferences } from '@/types';
import { GoogleCalendarCard } from '@/components/GoogleCalendarCard';
import { SmsSubscriptionsCard } from '@/components/SmsSubscriptionsCard';

interface Props {
  profile: Profile | null;
  onNotice: (msg: string) => void;
  onRefresh: () => Promise<void>;
}

const AVATAR_COLORS = ['blue', 'green', 'orange', 'purple'] as const;
type AvatarColor = (typeof AVATAR_COLORS)[number];

export function SettingsPage({ profile, onNotice, onRefresh }: Props) {
  const { user, refresh } = useAuth();

  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [avatarColor, setAvatarColor] = useState<AvatarColor>(
    (profile?.avatar_color as AvatarColor) ?? 'blue',
  );

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setAvatarColor((profile?.avatar_color as AvatarColor) ?? 'blue');
  }, [profile]);

  useEffect(() => {
    if (!user?.profileId) return;
    void getPreferences(user.profileId).then(setPrefs);
  }, [user?.profileId]);

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);

    const { error } = await updateProfileSelf({
      fullName: fullName.trim(),
      avatarColor,
    });

    setSaving(false);

    if (error) {
      onNotice(`Ошибка: ${error}`);
      return;
    }
    onNotice('Профиль сохранён.');
    await refresh();
    await onRefresh();
  };

  const updatePref = async (patch: Partial<UserPreferences>) => {
    if (!user?.profileId) return;
    const err = await updatePreferences(user.profileId, patch);
    if (err) {
      onNotice(`Ошибка: ${err}`);
      return;
    }
    onNotice('Настройки сохранены.');
    setPrefs((p) => (p ? { ...p, ...patch } : p));
  };

  const restartTour = async () => {
    await updatePref({
      onboarding_completed: false,
      onboarding_dismissed: false,
      tour_completed: false,
    });
    window.location.reload();
  };

  if (!profile) {
    return (
      <div className="text-sm text-slate-400 text-center py-12">
        Профиль не загружен
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-slate-400 mb-1">Профиль и настройки</p>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Настройки
        </h1>
      </section>

      {/* Профиль */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
          Профиль
        </h2>
        <p className="text-sm text-slate-400 mb-5">
          Отображаемое имя и внешний вид аватара
        </p>

        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col items-center gap-3">
            <Avatar name={fullName || profile.email} size="lg" color={avatarColor} />
            <div className="flex gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setAvatarColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    avatarColor === c
                      ? 'ring-2 ring-offset-2 ring-slate-400 scale-110'
                      : ''
                  } ${
                    c === 'blue'
                      ? 'bg-sky-500'
                      : c === 'green'
                        ? 'bg-emerald-500'
                        : c === 'orange'
                          ? 'bg-amber-500'
                          : 'bg-violet-500'
                  }`}
                  aria-label={`Цвет ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <Field label="ФИО">
              <div className="relative">
                <UserIcon
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </Field>

            <Field label="Email (логин)">
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={profile.email}
                  readOnly
                  className={`${inputClass} pl-10 bg-slate-50 dark:bg-slate-800`}
                />
              </div>
            </Field>

            <div className="text-xs text-slate-400">
              Роль:{' '}
              <strong className="text-slate-600 dark:text-slate-300">
                {roleLabel(profile.role)}
              </strong>
            </div>

            <Button
              onClick={() => void saveProfile()}
              loading={saving}
              disabled={!fullName.trim()}
            >
              <Save size={15} />
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </div>

      {/* 2FA */}
      {user && <MfaSetupPage onNotice={onNotice} />}

      {/* Опыт работы */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
          <Palette size={18} /> Опыт работы
        </h2>
        <p className="text-sm text-slate-400 mb-5">
          Уведомления и внешний вид
        </p>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60">
            <input
              type="checkbox"
              checked={prefs?.compact_mode ?? false}
              onChange={(e) => void updatePref({ compact_mode: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-sky-600"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Компактный режим
              </p>
              <p className="text-xs text-slate-400">
                Меньше отступы, больше информации
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60">
            <input
              type="checkbox"
              checked={prefs?.email_notifications ?? true}
              onChange={(e) =>
                void updatePref({ email_notifications: e.target.checked })
              }
              className="w-4 h-4 rounded border-slate-300 text-sky-600"
            />
            <div className="flex-1 flex items-center gap-2">
              <Bell size={15} className="text-slate-400" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Email-уведомления
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60">
            <input
              type="checkbox"
              checked={prefs?.push_notifications ?? true}
              onChange={(e) =>
                void updatePref({ push_notifications: e.target.checked })
              }
              className="w-4 h-4 rounded border-slate-300 text-sky-600"
            />
            <div className="flex-1 flex items-center gap-2">
              <Bell size={15} className="text-slate-400" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Push-уведомления
              </p>
            </div>
          </label>

          <button
            onClick={() => void restartTour()}
            className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-start gap-3"
          >
            <RotateCcw size={16} className="text-sky-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-sky-600">
                Перезапустить обучающий тур
              </p>
              <p className="text-xs text-slate-400">
                Пройти обзор интерфейса заново
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Google Calendar */}
      <GoogleCalendarCard onNotice={onNotice} />

      {/* SMS-подписки */}
      <SmsSubscriptionsCard onNotice={onNotice} />

      {/* Информация о системе */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
          <SettingsIcon size={18} /> О системе
        </h2>
        <div className="mt-3 space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
          <p>
            Версия CRM:{' '}
            <strong className="text-slate-700 dark:text-slate-200">1.0.0</strong>
          </p>
          <p>
            Среда:{' '}
            <strong className="text-slate-700 dark:text-slate-200">
              {import.meta.env.MODE}
            </strong>
          </p>
          <p>
            API:{' '}
            <strong className="text-slate-700 dark:text-slate-200 font-mono text-xs">
              {import.meta.env.VITE_API_URL}
            </strong>
          </p>
        </div>
      </div>
    </div>
  );
}