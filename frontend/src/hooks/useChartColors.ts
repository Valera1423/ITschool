// frontend/src/hooks/useChartColors.ts
import { useTheme } from '@/components/ThemeProvider';
import { CHART_COLORS_LIGHT, CHART_COLORS_DARK, type ChartPalette } from '@/lib/chartColors';

/**
 * Возвращает палитру для графиков в зависимости от текущей темы.
 * Использование:
 *   const colors = useChartColors();
 *   <Bar dataKey="value" fill={colors.accent} />
 */
export function useChartColors(): ChartPalette {
  const { resolved } = useTheme();
  return resolved === 'dark' ? CHART_COLORS_DARK : CHART_COLORS_LIGHT;
}