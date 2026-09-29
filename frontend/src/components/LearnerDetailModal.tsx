// frontend/src/components/LearnerDetailModal.tsx
import { useCallback, useEffect, useState } from 'react';
import { BookOpen, GraduationCap, IdCard, MapPin } from 'lucide-react';
import type { Learner } from '@/types';
import { getLearner } from '@/lib/learners';
import { SimpleModal, Avatar, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/utils';

interface Props {
  learnerId: string;
  onClose: () => void;
  onNotice: (msg: string) => void;
}

/**
 * Карточка слушателя. Показывает ПД уровня УЗ-1 (паспорт/СНИЛС/диплом).
 * Доступ логируется в PII Access Log с категорией identity.
 */
export function LearnerDetailModal({ learnerId, onClose, onNotice }: Props) {
  const [learner, setLearner] = useState<Learner | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLearner(learnerId);
      if (!data) {
        onNotice('Не удалось загрузить слушателя.');
        onClose();
        return;
      }
      setLearner(data);
    } finally {
      setLoading(false);
    }
  }, [learnerId, onNotice, onClose]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <SimpleModal title="Слушатель" onClose={onClose} wide>
        <p className="text-sm text-slate-400 text-center py-12">Загрузка…</p>
      </SimpleModal>
    );
  }

  if (!learner) {
    return (
      <SimpleModal title="Слушатель" onClose={onClose} wide>
        <EmptyState text="Не найдено" />
      </SimpleModal>
    );
  }

  const fullName = `${learner.last_name} ${learner.first_name} ${learner.middle_name ?? ''}`.trim();

  const Section = ({
    icon: Icon,
    title,
    rows,
  }: {
    icon: typeof IdCard;
    title: string;
    rows: { label: string; value: string | null | undefined }[];
  }) => (
    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-sky-500" />
        <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">
          {title}
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map((r) => (
          <div key={r.label}>
            <p className="text-xs text-slate-400">{r.label}</p>
            <p className="text-slate-700 dark:text-slate-200">
              {r.value || '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <SimpleModal title={fullName} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={fullName} size="lg" />
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {fullName}
            </p>
            <p className="text-xs text-slate-400">
              {learner.email ?? '—'} · {learner.phone ?? '—'}
            </p>
          </div>
        </div>

        <Section
          icon={IdCard}
          title="Удостоверение личности"
          rows={[
            { label: 'СНИЛС', value: learner.snils },
            {
              label: 'Дата рождения',
              value: learner.birth_date ? formatDate(learner.birth_date) : null,
            },
            { label: 'Пол', value: learner.gender },
            { label: 'Серия паспорта', value: learner.passport_series },
            { label: 'Номер паспорта', value: learner.passport_number },
            { label: 'Кем выдан', value: learner.passport_issued_by },
            {
              label: 'Дата выдачи',
              value: learner.passport_issued_at
                ? formatDate(learner.passport_issued_at)
                : null,
            },
            { label: 'Код подразделения', value: learner.passport_dept_code },
          ]}
        />

        <Section
          icon={MapPin}
          title="Регистрация"
          rows={[
            { label: 'Регион', value: learner.reg_region },
            { label: 'Город', value: learner.reg_city },
            { label: 'Улица', value: learner.reg_street },
            { label: 'Дом', value: learner.reg_house },
            { label: 'Квартира', value: learner.reg_flat },
            { label: 'Индекс', value: learner.reg_index },
          ]}
        />

        <Section
          icon={GraduationCap}
          title="Образование"
          rows={[
            { label: 'Уровень', value: learner.education_level },
            { label: 'Профессия', value: learner.diploma_profession },
            { label: 'Учебное заведение', value: learner.diploma_institution },
            { label: 'Фамилия в дипломе', value: learner.diploma_last_name },
            { label: 'Серия диплома', value: learner.diploma_series },
            { label: 'Номер диплома', value: learner.diploma_number },
            { label: 'Рег. номер', value: learner.diploma_reg_number },
            {
              label: 'Дата выдачи',
              value: learner.diploma_issued_at
                ? formatDate(learner.diploma_issued_at)
                : null,
            },
          ]}
        />

        {learner.orders && learner.orders.length > 0 && (
          <Section
            icon={BookOpen}
            title={`Заявки (${learner.orders.length})`}
            rows={learner.orders.map((o) => ({
              label: `№ ${o.external_id}`,
              value: `${o.course?.name ?? '—'} (поток ${o.stream?.number ?? '—'})`,
            }))}
          />
        )}
      </div>
    </SimpleModal>
  );
}