import { GraduationCap, ArrowRight, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';

/**
 * Страница входа.
 *
 * Авторизация через Keycloak OIDC — вся форма это кнопка,
 * которая редиректит на Keycloak. Логин/пароль вводятся там.
 */
export function LoginPage() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await signIn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-sky-600 text-white flex items-center justify-center">
            <GraduationCap size={22} />
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100 leading-tight">
              ИТ Школа
            </p>
            <p className="text-xs text-slate-400">Ростелеком CRM</p>
          </div>
        </div>

        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Вход в систему
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          Авторизация через корпоративный SSO (Keycloak).
        </p>

        <Button onClick={() => void handleSignIn()} loading={busy} className="w-full">
          Войти через SSO
          <ArrowRight size={16} />
        </Button>

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck size={14} />
          Защищённое соединение · Единый вход для сотрудников
        </div>
      </div>
    </div>
  );
}