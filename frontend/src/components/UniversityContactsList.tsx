import { useState } from 'react';
import { Plus, Trash2, Mail, Phone, Star, Pencil, Upload } from 'lucide-react';
import type { UniversityContact } from '@/types';
import { Button, EmptyState, SimpleModal, Field, inputClass } from '@/components/ui';
import { ContactsImportWizard } from '@/components/ContactsImportWizard';
import { useApi } from '@/hooks/useApi';

interface Props {
  universityId: string;
  contacts: UniversityContact[];
  canEdit: boolean;
  onRefresh: () => Promise<void>;
  onNotice: (msg: string) => void;
}

/**
 * Список ответственных от вуза.
 * По ТЗ п.4.1 — «Ответственные от ВУЗа» (может быть несколько).
 */
export function UniversityContactsList({
  universityId,
  contacts,
  canEdit,
  onRefresh,
  onNotice,
}: Props) {
  const api = useApi();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UniversityContact | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const remove = async (c: UniversityContact) => {
    if (!window.confirm(`Удалить контакт «${c.full_name}»?`)) return;
    try {
      await api.delete(`/universities/contacts/${c.id}`);
      onNotice('Контакт удалён.');
      await onRefresh();
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  const submit = async (payload: Partial<UniversityContact>, id?: string) => {
    try {
      const body = {
        fullName: payload.full_name,
        role: payload.role ?? null,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        telegram: payload.telegram ?? null,
        whatsapp: payload.whatsapp ?? null,
        isPrimary: payload.is_primary ?? false,
        notes: payload.notes ?? null,
      };
      if (id) {
        await api.patch(`/universities/contacts/${id}`, body);
      } else {
        await api.post(`/universities/${universityId}/contacts`, body);
      }
      onNotice(id ? 'Контакт обновлён.' : 'Контакт добавлен.');
      setModalOpen(false);
      setEditing(null);
      await onRefresh();
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void submit(
      {
        full_name: String(f.get('full_name')),
        role: String(f.get('role') ?? '') || null,
        email: String(f.get('email') ?? '') || null,
        phone: String(f.get('phone') ?? '') || null,
        telegram: String(f.get('telegram') ?? '') || null,
        whatsapp: String(f.get('whatsapp') ?? '') || null,
        is_primary: f.get('is_primary') === 'on',
        notes: String(f.get('notes') ?? '') || null,
      },
      editing?.id,
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Ответственные от ВУЗа ({contacts.length})
        </p>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setImportOpen(true)}
            >
              <Upload size={13} /> Импорт
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus size={13} /> Добавить
            </Button>
          </div>
        )}
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          text="Контактов нет"
          hint={canEdit ? 'Добавьте первого ответственного' : undefined}
        />
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60"
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  c.is_primary
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {c.is_primary ? <Star size={16} /> : c.full_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {c.full_name}
                  </p>
                  {c.is_primary && (
                    <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                      основной
                    </span>
                  )}
                </div>
                {c.role && (
                  <p className="text-xs text-slate-400">{c.role}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="flex items-center gap-1 hover:text-sky-600"
                    >
                      <Mail size={11} />
                      {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a
                      href={`tel:${c.phone.replace(/\D/g, '')}`}
                      className="flex items-center gap-1 hover:text-sky-600"
                    >
                      <Phone size={11} />
                      {c.phone}
                    </a>
                  )}
                </div>
                {c.notes && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {c.notes}
                  </p>
                )}
              </div>

              {canEdit && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      setEditing(c);
                      setModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600"
                    aria-label="Редактировать"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => void remove(c)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600"
                    aria-label="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <SimpleModal
          title={editing ? 'Редактировать контакт' : 'Новый контакт'}
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
                  defaultValue={editing?.full_name ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Должность">
                <input
                  name="role"
                  defaultValue={editing?.role ?? ''}
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
              <Field label="Telegram">
                <input
                  name="telegram"
                  defaultValue={editing?.telegram ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="WhatsApp">
                <input
                  name="whatsapp"
                  defaultValue={editing?.whatsapp ?? ''}
                  className={inputClass}
                />
              </Field>
              <Field label="Заметки" wide>
                <input
                  name="notes"
                  defaultValue={editing?.notes ?? ''}
                  className={inputClass}
                />
              </Field>
              <label className="flex items-center gap-2 sm:col-span-2 cursor-pointer">
                <input
                  name="is_primary"
                  type="checkbox"
                  defaultChecked={editing?.is_primary ?? false}
                  className="w-4 h-4 rounded border-slate-300 text-sky-600"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Основной контакт
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
        <ContactsImportWizard
          onClose={() => setImportOpen(false)}
          onDone={onRefresh}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}