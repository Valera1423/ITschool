// frontend/src/pages/AboutPage.tsx
import {
  GraduationCap,
  Github,
  FileText,
  Presentation,
  BookOpen,
  ShieldCheck,
  Layers,
  Database,
  Server,
  Code2,
} from 'lucide-react';
import { PanelHeading } from '@/components/ui';

/**
 * Страница «О проекте».
 *
 * По ТЗ п.10 «Требования к сдаче решений»:
 * - ссылка на репозиторий
 * - ссылка на презентацию
 * - ссылка на документацию
 * - описание стека
 */
export function AboutPage() {
  const stack = [
    {
      group: 'Frontend',
      icon: Code2,
      items: [
        'React 18 + TypeScript 5',
        'Vite 5 (сборка)',
        'TailwindCSS 3',
        'TanStack Query 5 (кэш данных)',
        'react-oidc-context (Keycloak OIDC)',
        'react-hook-form + Zod',
        'Recharts / ReactFlow / Leaflet',
      ],
    },
    {
      group: 'Backend',
      icon: Server,
      items: [
        'Node.js 20 + Express 4',
        'Prisma ORM 6 (PostgreSQL 16)',
        'Redis 7 + BullMQ (очереди)',
        'Keycloak 26 (OIDC + RBAC)',
        'MinIO (S3-совместимое хранилище)',
        'OpenTelemetry + Sentry',
        'Prometheus + Grafana + Loki',
      ],
    },
    {
      group: 'Инфраструктура',
      icon: Database,
      items: [
        'Docker / Docker Compose',
        'Nginx (reverse proxy + SSL)',
        'Certbot (автообновление сертификатов)',
        'PostgreSQL 16 (основная БД)',
        'Redis 7 (кеш + rate limit)',
      ],
    },
  ];

  const features = [
    {
      icon: GraduationCap,
      title: 'Управление вузами',
      description:
        'Каталог вузов с контактами, статусами, тегами, документами и историей взаимодействий.',
    },
    {
      icon: Layers,
      title: 'Workflow',
      description:
        'Визуализация цикла взаимодействия с вузом. 14 базовых шагов, кастомизация статусов.',
    },
    {
      icon: FileText,
      title: 'Отчёты и экспорт',
      description:
        'Формирование отчётов за период по вузам, направлениям, продуктам. Экспорт в XLS, XLSX, PDF, CSV, JSON.',
    },
    {
      icon: ShieldCheck,
      title: 'Безопасность 152-ФЗ',
      description:
        'Соответствие 152-ФЗ и приказу ФСТЭК №117. Шифрование ПД, RBAC, аудит, IP-whitelist, 2FA.',
    },
  ];

  const links = [
    {
      icon: Github,
      label: 'Исходный код',
      href: 'https://github.com/rt-it-school/crm',
      description: 'Открытый репозиторий без обфускации',
    },
    {
      icon: Presentation,
      label: 'Презентация',
      href: '/docs/presentation.pdf',
      description: 'PDF/PPTX с описанием решения',
    },
    {
      icon: BookOpen,
      label: 'Документация',
      href: '/docs/user-guide.pdf',
      description: 'Руководство пользователя и администратора',
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero */}
      <section className="bg-gradient-to-br from-sky-500 to-sky-700 rounded-2xl p-8 text-white">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <GraduationCap size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">
              ИТ Школа Ростелеком · CRM
            </h1>
            <p className="text-base opacity-95 max-w-3xl">
              Система контроля и обработки статистических данных по обучению
              студентов ВУЗов и школ по ИТ-направлениям.
            </p>
            <p className="text-sm opacity-80 mt-3">
              Автоматизирует полный цикл взаимодействия с вузом: от поиска
              контактов до сопровождения внедрения ИТ-продуктов. Соответствует
              требованиям 152-ФЗ и приказа ФСТЭК №117.
            </p>
          </div>
        </div>
      </section>

      {/* Возможности */}
      <section>
        <PanelHeading title="Ключевые возможности" />
        <div className="grid sm:grid-cols-2 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="w-11 h-11 rounded-xl bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 flex items-center justify-center mb-3">
                <f.icon size={22} />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                {f.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Стек */}
      <section>
        <PanelHeading title="Технологический стек" />
        <div className="grid sm:grid-cols-3 gap-4">
          {stack.map((g) => (
            <div
              key={g.group}
              className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <g.icon size={18} className="text-sky-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                  {g.group}
                </h3>
              </div>
              <ul className="space-y-1.5">
                {g.items.map((item) => (
                  <li
                    key={item}
                    className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2"
                  >
                    <span className="w-1 h-1 rounded-full bg-sky-400 mt-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Ссылки */}
      <section>
        <PanelHeading title="Материалы проекта" />
        <div className="grid sm:grid-cols-3 gap-4">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:border-sky-300 hover:shadow-md transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-sky-50 dark:group-hover:bg-sky-900/40 group-hover:text-sky-600 dark:group-hover:text-sky-300 flex items-center justify-center mb-3 transition-colors">
                <l.icon size={20} />
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                {l.label}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {l.description}
              </p>
            </a>
          ))}
        </div>
      </section>

      {/* Футер */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          © 2026 Ростелеком · ИТ Школа · Версия{' '}
          <strong className="text-slate-700 dark:text-slate-200">
            {import.meta.env.VITE_APP_VERSION ?? '1.0.0'}
          </strong>
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Сборка: {import.meta.env.MODE} · API:{' '}
          <code className="font-mono">{import.meta.env.VITE_API_URL}</code>
        </p>
      </section>
    </div>
  );
}