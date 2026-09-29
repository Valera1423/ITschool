// frontend/src/pages/ReportsPage.tsx
import { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Download,
  MessageSquare,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';
import type { University, Interaction, Task, Workflow } from '@/types';
import {
  StatusBadge,
  PanelHeading,
  Button,
  inputClass,
  selectClass,
} from '@/components/ui';
import { formatDate } from '@/lib/utils';
import {
  exportInteractionsPdf,
  exportTasksPdf,
  exportUniversitiesPdf,
} from '@/lib/pdf';
import {
  exportUniversitiesXls,
  exportUniversitiesSpreadsheet,
} from '@/lib/excel';
import { downloadFromServer } from '@/lib/exportServer';
import { ExportWithColumnsModal } from '@/components/ExportWithColumnsModal';
import { FullReportButton } from '@/components/FullReportButton';
import { ChartWrapper, ExportAllPdfButton } from '@/components/ChartWrapper';

/**
 * Отчёты.
 *
 * - Фильтр по датам
 * - Экспорт в XLS, XLSX, PDF, JSON
 * - Выбор колонок
 * - Экспорт диаграмм в PNG
 * - Полный JSON-отчёт
 * - PDF-презентация (backend)
 */
interface Props {
  universities: University[];
  interactions: Interaction[];
  tasks: Task[];
  workflows: Workflow[];
  onNotice: (msg: string) => void;
}

const DIRECTIONS = [
  'Разработка',
  'DevOps',
  'QA',
  'Аналитика данных',
  'Информационная безопасность',
];
const PRODUCTS = [
  'Ростелеком DataLab',
  'ИТ-платформа Практикум',
  'Ростелеком Security Lab',
];
const STATUSES = [
  'Новый',
  'Переговоры',
  'Обучение',
  'Внедрение',
  'Партнёр',
  'Отказ',
];

export function ReportsPage({
  universities,
  interactions,
  tasks,
  workflows,
  onNotice,
}: Props) {
  // Фильтр по датам
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  });
  const [statusFilter, setStatusFilter] = useState('Все');

  // Модалка выбора колонок
  const [exportModal, setExportModal] = useState<{
    title: string;
    filename: string;
    columns: { key: string; label: string }[];
    rows: Record<string, unknown>[];
  } | null>(null);

  const filteredUniversities = useMemo(
    () =>
      universities.filter((u) => {
        const created = u.created_at.slice(0, 10);
        return (
          created >= from &&
          created <= to &&
          (statusFilter === 'Все' || u.status === statusFilter)
        );
      }),
    [universities, from, to, statusFilter],
  );

  const filteredInteractions = useMemo(
    () =>
      interactions.filter(
        (i) => i.interaction_date >= from && i.interaction_date <= to,
      ),
    [interactions, from, to],
  );

  const filteredTasks = useMemo(
    () => tasks.filter((t) => t.due_date >= from && t.due_date <= to),
    [tasks, from, to],
  );

  const distribution = DIRECTIONS.map((d) => ({
    d,
    count: filteredUniversities.filter((u) => u.direction === d).length,
  }));
  const maxDist = Math.max(...distribution.map((x) => x.count), 1);

  const productDist = PRODUCTS.map((p) => ({
    p,
    count: filteredUniversities.filter((u) => u.product === p).length,
  }));
  const maxProd = Math.max(...productDist.map((x) => x.count), 1);

  const openExportUniversities = () =>
    setExportModal({
      title: 'Отчёт по вузам',
      filename: 'universities',
      columns: [
        { key: 'name', label: 'Вуз' },
        { key: 'city', label: 'Город' },
        { key: 'direction', label: 'ИТ-направление' },
        { key: 'product', label: 'ИТ-продукт' },
        { key: 'status', label: 'Статус' },
        { key: 'handover_status', label: 'Статус передачи' },
        { key: 'manager', label: 'Ответственный' },
        { key: 'license_signed', label: 'Лицензия' },
        { key: 'contract_number', label: 'Договор' },
      ],
      rows: filteredUniversities.map((u) => ({
        ...u,
        license_signed: u.license_signed ? 'Подписана' : 'Нет',
      })) as unknown as Record<string, unknown>[],
    });

  const openExportInteractions = () =>
    setExportModal({
      title: 'Журнал взаимодействий',
      filename: 'interactions',
      columns: [
        { key: 'date', label: 'Дата' },
        { key: 'type', label: 'Тип' },
        { key: 'title', label: 'Название' },
        { key: 'university', label: 'Вуз' },
        { key: 'status', label: 'Статус' },
        { key: 'manager', label: 'Ответственный' },
        { key: 'details', label: 'Детали' },
      ],
      rows: filteredInteractions.map((i) => ({
        date: formatDate(i.interaction_date),
        type: i.type,
        title: i.title,
        university:
          universities.find((u) => u.id === i.university_id)?.name ?? '—',
        status: i.status,
        manager: i.manager,
        details: i.details ?? '',
      })),
    });

  const openExportTasks = () =>
    setExportModal({
      title: 'Задачи за период',
      filename: 'tasks',
      columns: [
        { key: 'title', label: 'Задача' },
        { key: 'due_date', label: 'Срок' },
        { key: 'priority', label: 'Приоритет' },
        { key: 'status', label: 'Статус' },
        { key: 'assignee', label: 'Ответственный' },
        { key: 'university', label: 'Вуз' },
      ],
      rows: filteredTasks.map((t) => ({
        title: t.title,
        due_date: formatDate(t.due_date),
        priority: t.priority,
        status: t.status,
        assignee: t.assignee,
        university:
          universities.find((u) => u.id === t.university_id)?.name ?? '—',
      })),
    });

  const generatePdf = async () => {
    try {
      await downloadFromServer(
        `/reports/interactions.pdf?from=${from}&to=${to}`,
        `interactions-${from}_${to}.pdf`,
      );
      onNotice('PDF сформирован на сервере.');
    } catch (e) {
      onNotice(`Ошибка: ${e instanceof Error ? e.message : 'неизвестная'}`);
    }
  };

  const getChartElements = () => {
    const els: { element: HTMLElement; title: string }[] = [];
    document.querySelectorAll('[data-chart-export]').forEach((el) => {
      const title = el.getAttribute('data-chart-title') ?? 'Диаграмма';
      els.push({ element: el as HTMLElement, title });
    });
    return els;
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">
            Данные за выбранный период
          </p>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Отчёты
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Экспорт в XLS, XLSX, CSV, PDF, JSON. Выбор колонок.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void generatePdf()}>
            <Download size={15} /> PDF-презентация
          </Button>
          <FullReportButton period={{ from, to }} onNotice={onNotice} />
          <ExportAllPdfButton
            getElements={getChartElements}
            filename={`crm-charts-${from}_${to}`}
            onNotice={onNotice}
          />
        </div>
      </section>

      {/* Фильтр по датам */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">С даты</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">По дату</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Статус</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectClass}
          >
            <option>Все</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-slate-400">
          Найдено: {filteredUniversities.length} вузов ·{' '}
          {filteredInteractions.length} касаний · {filteredTasks.length} задач
        </span>
      </div>

      {/* Карточки экспорта */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Вузы за период',
            value: filteredUniversities.length,
            icon: Building2,
            color:
              'bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
            onExport: openExportUniversities,     // оставляем (модалка колонок, клиентская)
            onPDF: async () => {
              await downloadFromServer(
                `/reports/universities.pdf?from=${from}&to=${to}&status=${encodeURIComponent(statusFilter)}`,
                `universities-${from}_${to}.pdf`,
              );
            },
            onXls: async () => {
              await downloadFromServer(
                `/reports/universities.xls?from=${from}&to=${to}`,
                `universities-${from}_${to}.xls`,
              );
            },
            onXlsx: async () => {
              await downloadFromServer(
                `/reports/universities.xlsx?from=${from}&to=${to}`,
                `universities-${from}_${to}.xlsx`,
              );
            },
          },
          {
            label: 'Взаимодействия',
            value: filteredInteractions.length,
            icon: MessageSquare,
            color:
              'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
            onExport: openExportInteractions,
            onPDF: () =>
              void exportInteractionsPdf(filteredInteractions, universities),
            onXls: null,
            onXlsx: null,
          },
          {
            label: 'Задачи',
            value: filteredTasks.length,
            icon: CheckCircle2,
            color:
              'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300',
            onExport: openExportTasks,
            onPDF: () => void exportTasksPdf(filteredTasks),
            onXls: null,
            onXlsx: null,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}
            >
              <card.icon size={20} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {card.label}
            </p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
              {card.value}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button variant="secondary" size="sm" onClick={card.onExport}>
                <Download size={14} />
                Экспорт
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void card.onPDF()}
              >
                <FileJson size={14} />
                PDF
              </Button>
              {card.onXls && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void card.onXls?.()}
                >
                  <FileSpreadsheet size={14} />
                  XLS
                </Button>
              )}
              {card.onXlsx && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void card.onXlsx?.()}
                >
                  <FileSpreadsheet size={14} />
                  XLSX
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Диаграммы */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartWrapper title="Вузы по направлениям" filename="chart-directions">
          <div data-chart-export data-chart-title="Вузы по направлениям">
            <div className="flex items-end justify-between gap-3 h-48 pt-4">
              {distribution.map((item) => (
                <div
                  key={item.d}
                  className="flex flex-col items-center gap-2 flex-1"
                >
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {item.count}
                  </div>
                  <div
                    className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg overflow-hidden flex items-end"
                    style={{ height: '140px' }}
                  >
                    <div
                      className="w-full bg-gradient-to-t from-sky-500 to-sky-300 rounded-t-lg transition-all duration-500"
                      style={{ height: `${(item.count / maxDist) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 text-center">
                    {item.d
                      .replace('Информационная безопасность', 'ИБ')
                      .replace('Аналитика данных', 'Аналитика')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ChartWrapper>

        <ChartWrapper title="Продукты в работе" filename="chart-products">
          <div data-chart-export data-chart-title="Продукты в работе">
            <div className="space-y-4 pt-2">
              {productDist.map((item) => (
                <div key={item.p}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-slate-600 dark:text-slate-300">
                      {item.p}
                    </span>
                    <strong className="text-slate-800 dark:text-slate-100">
                      {item.count}
                    </strong>
                  </div>
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${(item.count / maxProd) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartWrapper>
      </div>

      {/* Статусы */}
      <ChartWrapper title="Статусы взаимодействия" filename="chart-statuses">
        <div data-chart-export data-chart-title="Статусы взаимодействия">
          <div className="space-y-3">
            {STATUSES.map((status) => {
              const count = filteredUniversities.filter(
                (u) => u.status === status,
              ).length;
              const pct =
                filteredUniversities.length > 0
                  ? (count / filteredUniversities.length) * 100
                  : 0;
              return (
                <div key={status} className="flex items-center gap-4">
                  <div className="w-32">
                    <StatusBadge status={status} />
                  </div>
                  <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <strong className="text-slate-700 dark:text-slate-200 w-8 text-right">
                    {count}
                  </strong>
                </div>
              );
            })}
          </div>
        </div>
      </ChartWrapper>

      {/* Workflow сводка */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
        <PanelHeading title="Workflow" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {workflows.map((w) => (
            <div
              key={w.id}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60"
            >
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {w.name}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {w.runs_count} запусков · {w.status}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Модалка выбора колонок */}
      {exportModal && (
        <ExportWithColumnsModal
          title={exportModal.title}
          filename={exportModal.filename}
          columns={exportModal.columns}
          rows={exportModal.rows}
          onClose={() => setExportModal(null)}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}