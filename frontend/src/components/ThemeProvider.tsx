import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ColorTheme = 'default' | 'purple';
type Mode = 'light' | 'dark' | 'system';
type ResolvedMode = 'light' | 'dark';

interface ThemeContextValue {
  colorTheme: ColorTheme;
  mode: Mode;
  resolvedMode: ResolvedMode;
  /** Для обратной совместимости: 'light' | 'dark' */
  resolved: ResolvedMode;
  theme: Mode;
  setColorTheme: (t: ColorTheme) => void;
  setMode: (m: Mode) => void;
  setTheme: (t: Mode) => void;
  toggleTheme: () => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const MODE_KEY = 'crm:theme';
const COLOR_KEY = 'crm:color-theme';

const ALL_CLASSES = [
  'Theme_root_rtk_default_light',
  'Theme_root_rtk_default_dark',
  'Theme_root_rtk_purple_light',
  'Theme_root_rtk_purple_dark',
];

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function applyTheme(colorTheme: ColorTheme, mode: ResolvedMode): void {
  const html = document.documentElement;

  html.classList.toggle('dark', mode === 'dark');

  html.classList.remove(...ALL_CLASSES);

  const cls =
    colorTheme === 'purple'
      ? (mode === 'dark' ? 'Theme_root_rtk_purple_dark' : 'Theme_root_rtk_purple_light')
      : (mode === 'dark' ? 'Theme_root_rtk_default_dark' : 'Theme_root_rtk_default_light');

  html.classList.add(cls);
  html.style.colorScheme = mode;
}

function readStoredMode(): Mode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch { /* ignore */ }
  return 'system';
}

function readStoredColor(): ColorTheme {
  try {
    const raw = localStorage.getItem(COLOR_KEY);
    if (raw === 'default' || raw === 'purple') return raw;
  } catch { /* ignore */ }
  return 'default';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(readStoredColor);
  const [mode, setModeState] = useState<Mode>(readStoredMode);
  const [resolved, setResolved] = useState<ResolvedMode>(() =>
    readStoredMode() === 'dark' ? 'dark' : 'light',
  );

  const resolveAndApply = useCallback((ct: ColorTheme, m: Mode): ResolvedMode => {
    const r: ResolvedMode = m === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : m;
    setResolved(r);
    applyTheme(ct, r);
    return r;
  }, []);

  useEffect(() => {
    resolveAndApply(colorTheme, mode);
    try {
      localStorage.setItem(MODE_KEY, mode);
      localStorage.setItem(COLOR_KEY, colorTheme);
    } catch { /* ignore */ }
  }, [colorTheme, mode, resolveAndApply]);

  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => resolveAndApply(colorTheme, 'system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode, colorTheme, resolveAndApply]);

  const setMode = useCallback((m: Mode) => setModeState(m), []);
  const setColorTheme = useCallback((c: ColorTheme) => setColorThemeState(c), []);

  const toggleTheme = useCallback(() => {
    setModeState((current) => {
      const currentResolved: ResolvedMode =
        current === 'system'
          ? systemPrefersDark()
            ? 'dark'
            : 'light'
          : current;
      return currentResolved === 'dark' ? 'light' : 'dark';
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colorTheme,
      mode,
      resolvedMode: resolved,
      resolved,
      theme: mode,
      setColorTheme,
      setMode,
      setTheme: setMode,
      toggleTheme,
      toggle: toggleTheme,
    }),
    [colorTheme, mode, resolved, setColorTheme, setMode, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}