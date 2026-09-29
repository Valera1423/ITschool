import { useEffect, useState, type FormEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { listCustomRoles, type CustomRole } from '@/lib/customRoles';
import { SimpleModal, Button, Field, inputClass, selectClass } from '@/components/ui';

interface Props {
  onClose: () => void;
  onInvited: () => Promise<void>;
  onNotice: (msg: string) => void;
}

export function InviteUserModal({ onClose, onInvited, onNotice }: Props) {
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void listCustomRoles().then((r) => setCustomRoles(r.filter((x) => x.active)));
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload = {
      email: String(data.get('email')).trim(),
      fullName: String(data.get('fullName')).trim(),
      role: String(data.get('role')) as 'admin' | 'manager' | 'nam',
      customRoleId: (String(data.get('customRoleId') ?? '').trim()) || null,
    };
    setSending(true);
    try {
      await api.post('/users/invite', payload);
      onNotice(`Приглашение отправлено на ${payload.email}.`);
      await onInvited();
      onClose();
    } catch (err) {
      onNotice(`Ошибка: ${err instanceof Error ? err.message : 'неизвестная'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <SimpleModal title="Пригласить сотрудника" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-3 text-xs text-sky-700 dark:text-sky-300">
          На указанный email придёт письмо со ссылкой для установки пароля.
          Сотрудник появится в списке сразу.
        </div>

        <Field label="Email">
          <input name="email" type="email" required placeholder="ivanov@rt.ru" className={inputClass} />
        </Field>

        <Field label="ФИО">
          <input name="fullName" required placeholder="Иванов Иван Иванович" className={inputClass} />
        </Field>

        <Field label="Роль (Keycloak)">
          <select name="role" defaultValue="nam" className={selectClass}>
            <option value="nam">Пользователь (НАМ)</option>
            <option value="manager">Руководитель</option>
            <option value="admin">Администратор</option>
          </select>
        </Field>

        {customRoles.length > 0 && (
          <Field label="Кастомная роль-пресет (необязательно)">
            <select name="customRoleId" defaultValue="" className={selectClass}>
              <option value="">— не назначать —</option>
              {customRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.permissions.length} разрешений)
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={sending}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? 'Отправка…' : 'Пригласить'}
          </Button>
        </div>
      </form>
    </SimpleModal>
  );
}