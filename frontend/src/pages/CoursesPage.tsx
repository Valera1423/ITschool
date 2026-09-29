// frontend/src/pages/CoursesPage.tsx
import { useEffect, useState } from 'react';
import { BookOpen, Users } from 'lucide-react';
import type { Course } from '@/types';
import { listCourses } from '@/lib/courses';
import { EmptyState, StatusBadge } from '@/components/ui';
import { asArray } from '@/lib/utils';

export function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = await listCourses();
        setCourses(asArray(data));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-slate-400 mb-1">Программы обучения</p>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          Курсы
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Создаются автоматически при импорте заявок.
        </p>
      </section>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-12">Загрузка…</p>
      ) : courses.length === 0 ? (
        <EmptyState text="Курсов нет" icon={BookOpen} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800"
            >
              <div className="w-11 h-11 rounded-xl bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 flex items-center justify-center mb-3">
                <BookOpen size={20} />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                {c.name}
              </h3>
              {c.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  {c.description}
                </p>
              )}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Users size={12} />
                Потоков: {c.streams?.length ?? 0}
              </div>
              {c.streams && c.streams.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {c.streams.map((s) => (
                    <StatusBadge key={s.id} status={`№${s.number}`} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}