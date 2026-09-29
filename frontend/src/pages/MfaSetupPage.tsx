import { useEffect, useState } from 'react';
import { ExternalLink, ShieldCheck, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  onNotice: (msg: string) => void;
}

/**
 * Двухфакторная аутентификация.
 *
 * Реализация: перенаправляем в Keycloak Account Console, где пользователь
 * сам настраивает OTP (Google Authenticator, Authy и др.).
 */
export function MfaSetupPage({ onNotice }: Props) {
  const { oidc } = useAuth();
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const authority = import.meta.env.VITE_OIDC_AUTHORITY ?? '';
  const realmMatch = authority.match(/\/realms\/([^/]+)/);
  const realm = realmMatch?.[1] ?? 'it-school';
  const baseUrl = authority.replace(/\/realms\/.*$/, '');
  const accountUrl = `${baseUrl}/realms/${realm}/account/#/security/signingin`;

  // acr="1" — OTP применяется. Проверяем claim `amr` c `otp`.
  useEffect(() => {
    const profile = oidc?.user?.profile as
      | { amr?: string[]; acr?: string }
      | undefined;
    const amr = profile?.amr;
    setMfaEnabled(Array.isArray(amr) && amr.includes('otp'));
  }, [oidc?.user?.profile]);

  const openAccount = () => {
    window.open(accountUrl, '_blank', 'noopener,noreferrer');
    onNotice('Открыт Keycloak Account Console — вкладка «Signing in»');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 flex items-center justify-center">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Двухфакторная аутентификация
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Управляется через Keycloak. Поддерживается TOTP (Google
            Authenticator, Authy).
          </p>
        </div>
      </div>

      {mfaEnabled ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm">
            <Check size={16} /> 2FA активна в текущей сессии
          </div>
          <p className="text-xs text-slate-400">
            Управление и смена устройства — в Account Console.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-900/40 p-3 text-xs text-sky-700 dark:text-sky-300 flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">Как включить 2FA:</p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Нажмите кнопку ниже — откроется Account Console</li>
                <li>Раздел «Signing in»</li>
                <li>«Set up Authenticator Application»</li>
                <li>Отсканируйте QR-код в Google Authenticator</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      <Button onClick={openAccount} className="w-full mt-4">
        <ExternalLink size={15} /> Открыть Keycloak Account Console
      </Button>
    </div>
  );
}