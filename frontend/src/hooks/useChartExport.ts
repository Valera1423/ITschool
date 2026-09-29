// frontend/src/hooks/useChartExport.ts
import { useCallback } from 'react';

export interface ChartElement {
  element: HTMLElement;
  title: string;
}

/** @deprecated используйте ChartElement — оставлено для обратной совместимости */
export type ChartElementRef = ChartElement;

/**
 * Собирает DOM-элементы диаграмм для экспорта.
 *
 * Ищем по атрибутам:
 *   [data-chart-export]   — маркер экспортируемого блока
 *   [data-chart-title]    — читаемый заголовок (для имени файла и шапки PDF)
 *
 * Почему DOM, а не реестр компонентов: SVG/HTML-диаграммы рисуются
 * как обычные DOM-узлы (Tailwind + Recharts + reactflow), поэтому
 * html-to-image снимает их «как есть» — без пересборки данных.
 *
 * Если у элемента нет `data-chart-title`, берём:
 *   - ближайший <h3> рядом,
 *   - либо порядковый номер.
 */
export function useChartElements() {
  const getElements = useCallback((): ChartElement[] => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-chart-export]'),
    );

    return nodes.map((el, idx) => {
      let title = el.getAttribute('data-chart-title') ?? '';

      if (!title) {
        // Пробуем найти заголовок в ближайшей карточке
        const card = el.closest<HTMLElement>(
          '[data-chart-card], .rounded-2xl, .rounded-xl',
        );
        const heading = card?.querySelector('h3, [role="heading"]');
        title = heading?.textContent?.trim() ?? '';
      }

      if (!title) title = `Диаграмма ${idx + 1}`;

      return { element: el, title };
    });
  }, []);

  return { getElements };
}

/**
 * Legacy-алиас: возвращает ту же функцию, но под старым именем типа
 * (ChartElementRef). Нужен, чтобы существующие импорты
 * `import { useChartElements } from '@/hooks/useChartExport'`
 * в AnalyticsPage / MetricsPage / ExecutiveDashboardPage
 * продолжали работать без правок.
 */
export function useChartExport() {
  const { getElements } = useChartElements();
  return { getElements };
}