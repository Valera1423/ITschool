// frontend/src/components/calendar/EventModal.tsx
import { useState, type FormEvent } from 'react';
import { Video, Trash2, ExternalLink, Plus, X } from 'lucide-react';
import type { Interaction, University } from '@/types';
import { INTERACTION_TYPES, INTERACTION_STATUSES, MANAGERS } from '@/constants';
import { EVENT_COLORS } from '@/lib/calendar';
import {
  SimpleModal,
  Button,
  Field,
  inputClass,
  selectClass,
  textareaClass,
} from '@/components/ui';

/**
 * Модалка создания/редактирования события.
 *
 * Особенности:
 * - Переключение «Весь день»
 * - Ссылка Zoom/Meet
 * - Участники (чипсы)
 * - Цвет метки (6 вариантов)
 * - Напоминание за N минут
 */
interface Props {
  event: Partial<Interaction> & { interaction_date: string };
  isNew: boolean;
  universities: University[];
  onClose: () => void;
  onSave: (data: Partial<Interaction>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onNotice: (msg: string) => void;
}

export function EventModal({
  event,
  isNew,
  universities,
  onClose,
  onSave,
  onDelete,
  onNotice,
}: Props) {
  const [data, setData] = useState({
    university_id: event.university_id ?? universities[0]?.id ?? '',
    title: event.title ?? '',
    details: event.details ?? '',
    type: event.type ?? 'Встреча',
    status: event.status ?? 'Запланировано',
    manager: event.manager ?? MANAGERS[0],
    interaction_date: event.interaction_date,
    start_time: event.start_time?.slice(0, 5) ?? '10:00',
    end_time: event.end_time?.slice(0, 5) ?? '11:00',
    all_day: event.all_day ?? false,
    meeting_url: event.meeting_url ?? '',
    location: event.location ?? '',
    reminder_minutes: event.reminder_minutes ?? 15,
    color: event.color ?? 'sky',
    attendees: event.attendees ?? [],
  });
  const [attendeeInput, setAttendeeInput] = useState('');
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof data>(k: K, v: typeof data[K]) => {
    setData((d) => ({ ...d, [k]: v }));
  };

  const addAttendee = () => {
    const v = attendeeInput.trim();
    if (!v || data.attendees.includes(v)) {
      setAttendeeInput('');
      return;
    }
    set('attendees', [...data.attendees, v]);
    setAttendeeInput('');
  };

  const removeAttendee = (a: string) => {
    set('attendees', data.attendees.filter((x) => x !== a));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data.title.trim()) {
      onNotice('Введите название');
      return;
    }

    setSaving(true);
    const payload: Partial<Interaction> = {
      university_id: data.university_id,
      title: data.title.trim(),
      details: data.details || null,
      type: data.type,
      status: data.status,
      manager: data.manager,
      interaction_date: data.interaction_date,
      all_day: data.all_day,
      start_time: data.all_day ? null : data.start_time,
      end_time: data.all_day ? null : data.end_time,
      meeting_url: data.meeting_url || null,
      location: data.location || null,
      reminder_minutes: data.reminder_minutes,
      color: data.color,
      attendees: data.attendees,
    };

    await onSave(payload);
    setSaving(false);
  };

  const deleteEvent = async () => {
    if (!onDelete) return;
    if (!window.confirm('Удалить событие?')) return;
    setSaving(true);
    await onDelete();
    setSaving(false);
  };

  return (
    <SimpleModal
      title={isNew ? 'Новое событие' : 'Редактировать событие'}
      onClose={onClose}
      wide
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Название" wide>
            <input
              required
              value={data.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Встреча с вузом"
              className={inputClass}
              autoFocus
            />
          </Field>

          <Field label="Вуз">
            <select
              value={data.university_id}
              onChange={(e) => set('university_id', e.target.value)}
              className={selectClass}
              required
            >
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Тип">
            <select
              value={data.type}
              onChange={(e) => set('type', e.target.value)}
              className={selectClass}
            >
              {INTERACTION_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>

          <Field label="Дата">
            <input
              type="date"
              required
              value={data.interaction_date}
              onChange={(e) => set('interaction_date', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Статус">
            <select
              value={data.status}
              onChange={(e) => set('status', e.target.value)}
              className={selectClass}
            >
              {INTERACTION_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
            <input
              type="checkbox"
              checked={data.all_day}
              onChange={(e) => set('all_day', e.target.checked)}
              className="w-4 h-4 rounded border-atmr-border text-atmr-accent focus:ring-atmr-accent"
            />
            <span className="atmr-body-s text-atmr-fg">
              Весь день (без времени)
            </span>
          </label>

          {!data.all_day && (
            <>
              <Field label="Начало">
                <input
                  type="time"
                  value={data.start_time}
                  onChange={(e) => set('start_time', e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Окончание">
                <input
                  type="time"
                  value={data.end_time}
                  onChange={(e) => set('end_time', e.target.value)}
                  className={inputClass}
                />
              </Field>
            </>
          )}

          <Field label="Ответственный">
            <select
              value={data.manager}
              onChange={(e) => set('manager', e.target.value)}
              className={selectClass}
            >
              {MANAGERS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>

          <Field label="Напомнить за">
            <select
              value={String(data.reminder_minutes)}
              onChange={(e) => set('reminder_minutes', Number(e.target.value))}
              className={selectClass}
            >
              <option value="0">Без напоминания</option>
              <option value="5">За 5 минут</option>
              <option value="15">За 15 минут</option>
              <option value="30">За 30 минут</option>
              <option value="60">За 1 час</option>
              <option value="1440">За 1 день</option>
            </select>
          </Field>

          <Field label="Ссылка на Zoom / Meet / Teams" wide>
            <div className="relative">
              <Video
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-atmr-fg-muted"
              />
              <input
                type="url"
                value={data.meeting_url}
                onChange={(e) => set('meeting_url', e.target.value)}
                placeholder="https://zoom.us/j/..."
                className={`${inputClass} pl-10`}
              />
            </div>
          </Field>

          <Field label="Место / кабинет" wide>
            <input
              value={data.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Москва, Ленинский пр-т 30, каб. 401"
              className={inputClass}
            />
          </Field>

          <Field label="Участники" wide>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={attendeeInput}
                  onChange={(e) => setAttendeeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAttendee();
                    }
                  }}
                  placeholder="email или имя, Enter чтобы добавить"
                  className={inputClass}
                />
                <Button
                  variant="secondary"
                  onClick={addAttendee}
                  disabled={!attendeeInput.trim()}
                >
                  <Plus size={15} />
                </Button>
              </div>
              {data.attendees.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.attendees.map((a) => (
                    <span
                      key={a}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-atmr-m bg-atmr-bg-surface2 atmr-desc-l text-atmr-fg"
                    >
                      {a}
                      <button
                        type="button"
                        onClick={() => removeAttendee(a)}
                        className="text-atmr-fg-muted hover:text-atmr-error transition-colors"
                        aria-label="Убрать участника"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <Field label="Цвет" wide>
            <div className="flex items-center gap-2">
              {Object.keys(EVENT_COLORS).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('color', c)}
                  className={`w-7 h-7 rounded-atmr-full ${
                    EVENT_COLORS[c].dot
                  } transition-transform duration-atmr-fast ${
                    data.color === c
                      ? 'ring-2 ring-offset-2 ring-atmr-fg-muted dark:ring-offset-slate-900 scale-110'
                      : 'hover:scale-110'
                  }`}
                  title={c}
                />
              ))}
            </div>
          </Field>

          <Field label="Описание" wide>
            <textarea
              value={data.details}
              onChange={(e) => set('details', e.target.value)}
              placeholder="Что обсудить на встрече"
              className={textareaClass}
            />
          </Field>
        </div>

        {data.meeting_url && (
          <a
            href={data.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 atmr-body-s text-atmr-accent hover:underline"
          >
            <ExternalLink size={13} /> Открыть ссылку на встречу
          </a>
        )}

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-atmr-border-soft">
          {!isNew && onDelete ? (
            <Button variant="danger" onClick={() => void deleteEvent()} disabled={saving}>
              <Trash2 size={15} /> Удалить
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving || !data.title.trim()}>
              {saving ? 'Сохранение…' : isNew ? 'Создать' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </form>
    </SimpleModal>
  );
}