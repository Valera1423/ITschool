// frontend/src/lib/chartColors.ts

/**
 * Цвета для графиков (Recharts).
 * Отдельно от lib/colors.ts, потому что палитра для графиков
 * требует различимости одновременного отображения, а не семантики.
 *
 * ⚠️ При смене темы значения переключаются через useChartColors().
 */

export interface ChartPalette {
  accent: string;
  accentSoft: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  grid: string;
  axis: string;
  series: readonly string[];
}

export const CHART_COLORS_LIGHT: ChartPalette = {
  accent: '#ff4f12',
  accentSoft: '#ff8255',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#0ea5e9',
  grid: '#e2e8f0',
  axis: '#94a3b8',
  series: ['#ff4f12', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#14b8a6', '#ef4444'],
};

export const CHART_COLORS_DARK: ChartPalette = {
  accent: '#ff6b35',
  accentSoft: '#ff8255',
  success: '#34d399',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#38bdf8',
  grid: '#334155',
  axis: '#64748b',
  series: ['#ff6b35', '#38bdf8', '#34d399', '#fbbf24', '#a78bfa', '#5eead4', '#f87171'],
};