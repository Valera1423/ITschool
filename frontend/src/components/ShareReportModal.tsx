import { useState } from 'react';
import { Copy, Link as LinkIcon, Lock } from 'lucide-react';
import { createPublicLink } from '@/lib/publicReports';
import { SimpleModal, Button, Field, inputClass } from '@/components/ui';

interface Props {
  reportType: 'universities' | 'abc-xyz' | 'rfm' | 'period-comparison';
  params: Record<string, unknown>;
  onClose: () => void;
  onNotice: (msg: string) => void;
}

export function ShareReportModal({ reportType, params, onClose, onNotice }: Props) {
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    const result = await createPublicLink({
      report_type: reportType,
      params,
      expires_in_days: expiresInDays,
      password: password || undefined,
    });
    setCreating(false);
    if (!result) {
      onNotice('Не удалось создать ссылку');
      return;
    }
    setUrl(result.url);
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    onNotice('Ссылка скопирована');
  };

  return (
    <SimpleModal title="Поделиться отчётом" onClose={onClose}>
      <div className="space-y-4">
        {!url ? (
          <>
            <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-3 text-xs text-sky-700 dark:text-sky-300">
              Публичная ссылка позволит открыть отчёт без авторизации. Не передавайте в неё персональные данные.
            </div>

            <Field label="Срок действия (дней)">
              <input
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className={inputClass}
              />
            </Field>

            <Field label="Пароль (необязательно)">
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Оставьте пустым — без пароля"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={onClose}>Отмена</Button>
              <Button onClick={() => void create()} disabled={creating}>
                {creating ? 'Создание…' : 'Создать ссылку'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-sm">
              <LinkIcon size={16} /> Ссылка создана
            </div>

            <Field label="Публичная ссылка">
              <div className="relative">
                <input
                  readOnly
                  value={url}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className={`${inputClass} pr-12 font-mono text-xs`}
                />
                <button
                  onClick={() => void copy()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-sky-600"
                >
                  <Copy size={15} />
                </button>
              </div>
            </Field>

            {password && (
              <p className="text-xs text-amber-600">
                <Lock size={11} className="inline mr-1" />
                Пароль: <strong>{password}</strong>. Передайте его отдельно.
              </p>
            )}

            <div className="flex justify-end">
              <Button onClick={onClose}>Готово</Button>
            </div>
          </>
        )}
      </div>
    </SimpleModal>
  );
}