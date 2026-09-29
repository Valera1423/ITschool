// frontend/src/components/MfaRequiredBanner.tsx
import { ShieldAlert, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Баннер «Настройте 2FA».
 *
 * Показывается, если у пользователя admin или manager роль,
 * но 2FA не пройдена в текущей сессии (нет amr с otp/mfa).
 *
 * Баннер неблокирующий: пользователь может работать, но
 * критические операции (импорт, bulk, /security/*, /users/*)
 * отвалятся с 403 CRM-403-007. Баннер заранее предупреждает.
 */
export function MfaRequiredBanner() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'nam') return null;
  if (user.mfa) return null;

  const authority = import.meta.env.VITE_OIDC_AUTHORITY ?? '';
  const baseUrl = authority.replace(/\/realms\/.*$/, '');
  const realmMatch = authority.match(/\/realms\/([^/]+)/);
  const realm = realmMatch?.[1] ?? 'it-school';
  const accountUrl = `${baseUrl}/realms/${realm}/account/#/security/signingin`;

  return (
    <div className="sticky top-0 z-30 bg-amber-500 text-white px-4 py-2.5 flex items-center gap-3 text-sm shadow-md">
      <ShieldAlert size={18} className="flex-shrink-0" />
      <div className="flex-1">
        <strong className="font-semibold">Требуется 2FA. </strong>
        Критические операции (импорт, управление пользователями, безопасность)
        недоступны, пока вы не настроите двухфакторную аутентификацию.
      </div>
      <a
        href={accountUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-medium transition-colors"
      >
        Настроить <ExternalLink size={12} />
      </a>
    </div>
  );
}