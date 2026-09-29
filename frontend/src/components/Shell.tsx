// frontend/src/components/Shell.tsx
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Database,
  FileBarChart,
  FileText,
  GraduationCap,
  Inbox,
  Info,
  LayoutDashboard,
  Layers,
  Lock,
  Menu,
  MessagesSquare,
  MoreHorizontal,
  Phone,
  Plug,
  Redo2,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trello,
  TrendingUp,
  Undo2,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import type {
  AuditLogEntry,
  CallLog,
  CrmUser,
  Interaction,
  OnboardingStep,
  Profile,
  ProfileSettings,
  Task,
  University,
  UserPreferences,
  ViewKey,
} from '@/types';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import { useApi } from '@/hooks/useApi';
import { useNotifications } from '@/hooks/useNotifications';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useReminders } from '@/hooks/useReminders';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useIpGuard } from '@/hooks/useIpGuard';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useWorkflows, useWorkflowSteps } from '@/hooks/queries/useWorkflows';
import { useManagers } from '@/hooks/queries/useCatalogs';
import { queryKeys } from '@/lib/queryClient';
import { startHealthCheck } from '@/lib/health';
import { listSteps, getPreferences, updatePreferences } from '@/lib/onboarding';
import { Avatar, Button, LoadingState, Toast } from '@/components/ui';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { CommandPalette } from '@/components/CommandPalette';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { OnboardingBanner } from '@/components/onboarding/OnboardingBanner';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { OfflineBanner } from '@/components/OfflineBanner';
import { InstallPrompt } from '@/components/InstallPrompt';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { KbChatWidget } from '@/components/kb/KbChatWidget';
import { MfaRequiredBanner } from '@/components/MfaRequiredBanner';
import { useHistory } from '@/components/UndoProvider';

// ============================================================
// ТИПЫ
// ============================================================

interface NavItem {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
  group: string;
  adminOnly?: boolean;
  permission?: string;
}

// ============================================================
// LAZY PAGES
// ============================================================

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const MyDashboardsPage = lazy(() =>
  import('@/pages/MyDashboardsPage').then((m) => ({ default: m.MyDashboardsPage })),
);
const UniversitiesPage = lazy(() =>
  import('@/pages/UniversitiesPage').then((m) => ({ default: m.UniversitiesPage })),
);
const InteractionsPage = lazy(() =>
  import('@/pages/InteractionsPage').then((m) => ({ default: m.InteractionsPage })),
);
const InteractionsReportPage = lazy(() =>
  import('@/pages/InteractionsReportPage').then((m) => ({
    default: m.InteractionsReportPage,
  })),
);
const CalendarPage = lazy(() =>
  import('@/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })),
);
const CallsPage = lazy(() =>
  import('@/pages/CallsPage').then((m) => ({ default: m.CallsPage })),
);
const KanbanPage = lazy(() =>
  import('@/pages/KanbanPage').then((m) => ({ default: m.KanbanPage })),
);
const TasksPage = lazy(() =>
  import('@/pages/TasksPage').then((m) => ({ default: m.TasksPage })),
);
const WorkflowsPage = lazy(() =>
  import('@/pages/WorkflowsPage').then((m) => ({ default: m.WorkflowsPage })),
);
const AutomationPage = lazy(() =>
  import('@/pages/AutomationPage').then((m) => ({ default: m.AutomationPage })),
);
const ContractsPage = lazy(() =>
  import('@/pages/ContractsPage').then((m) => ({ default: m.ContractsPage })),
);
const SegmentsPage = lazy(() =>
  import('@/pages/SegmentsPage').then((m) => ({ default: m.SegmentsPage })),
);
const InboxPage = lazy(() =>
  import('@/pages/InboxPage').then((m) => ({ default: m.InboxPage })),
);
const ReportsPage = lazy(() =>
  import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const MetricsPage = lazy(() =>
  import('@/pages/MetricsPage').then((m) => ({ default: m.MetricsPage })),
);
const AnalyticsPage = lazy(() =>
  import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const ExecutiveDashboardPage = lazy(() =>
  import('@/pages/ExecutiveDashboardPage').then((m) => ({
    default: m.ExecutiveDashboardPage,
  })),
);
const UsersPage = lazy(() =>
  import('@/pages/UsersPage').then((m) => ({ default: m.UsersPage })),
);
const CustomRolesPage = lazy(() =>
  import('@/pages/CustomRolesPage').then((m) => ({ default: m.CustomRolesPage })),
);
const IntegrationsPage = lazy(() =>
  import('@/pages/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage })),
);
const CatalogsPage = lazy(() =>
  import('@/pages/CatalogsPage').then((m) => ({ default: m.CatalogsPage })),
);
const JournalPage = lazy(() =>
  import('@/pages/JournalPage').then((m) => ({ default: m.JournalPage })),
);
const SystemHealthPage = lazy(() =>
  import('@/pages/SystemHealthPage').then((m) => ({ default: m.SystemHealthPage })),
);
const SecurityPage = lazy(() =>
  import('@/pages/SecurityPage').then((m) => ({ default: m.SecurityPage })),
);
const TrashPage = lazy(() =>
  import('@/pages/TrashPage').then((m) => ({ default: m.TrashPage })),
);
const BackupPage = lazy(() =>
  import('@/pages/BackupPage').then((m) => ({ default: m.BackupPage })),
);
const KnowledgePage = lazy(() =>
  import('@/pages/KnowledgePage').then((m) => ({ default: m.KnowledgePage })),
);
const AboutPage = lazy(() =>
  import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const LearnersPage = lazy(() =>
  import('@/pages/LearnersPage').then((m) => ({ default: m.LearnersPage })),
);
const CoursesPage = lazy(() =>
  import('@/pages/CoursesPage').then((m) => ({ default: m.CoursesPage })),
);
const OrdersPage = lazy(() =>
  import('@/pages/OrdersPage').then((m) => ({ default: m.OrdersPage })),
);

// ============================================================
// SHELL
// ============================================================

export function Shell({ initialView }: { initialView?: ViewKey } = {}) {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const { resolved, toggleTheme } = useTheme();
  const api = useApi();
  const { undo, redo, canUndo, canRedo } = useHistory();

  const [page, setPage] = useState<ViewKey>(initialView ?? 'dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [online, setOnline] = useState(true);
  const [timeoutWarn, setTimeoutWarn] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [onboardingSteps, setOnboardingSteps] = useState<OnboardingStep[]>([]);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [kbChatOpen, setKbChatOpen] = useState(false);

  const notifications = useNotifications();

  useEffect(() => {
    document.documentElement.setAttribute(
      'lang',
      i18n.language?.startsWith('en') ? 'en' : 'ru',
    );
  }, [i18n.language]);

  const universitiesQuery = useQuery({
    queryKey: queryKeys.universities.list(),
    queryFn: () => api.get<University[]>('/universities?pageSize=100'),
    staleTime: 30_000,
  });

  const interactionsQuery = useQuery({
    queryKey: queryKeys.interactions.list(),
    queryFn: () => api.get<Interaction[]>('/interactions?pageSize=100'),
    staleTime: 30_000,
  });

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks.list(),
    queryFn: () => api.get<Task[]>('/tasks?pageSize=100'),
    staleTime: 30_000,
  });

  const workflowsQuery = useWorkflows();
  const workflowStepsQuery = useWorkflowSteps();
  const managersQuery = useManagers(true);

  const universities = universitiesQuery.data ?? [];
  const interactions = interactionsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const workflows = workflowsQuery.data ?? [];
  const workflowSteps = workflowStepsQuery.data ?? [];
  const managers = useMemo(
    () =>
      (managersQuery.data ?? [])
        .filter((m) => m.active)
        .map((m) => m.full_name),
    [managersQuery.data],
  );

  const loading =
    universitiesQuery.isLoading ||
    interactionsQuery.isLoading ||
    tasksQuery.isLoading;

  const loadData = useCallback(async () => {
    await Promise.all([
      universitiesQuery.refetch(),
      interactionsQuery.refetch(),
      tasksQuery.refetch(),
      workflowsQuery.refetch(),
      workflowStepsQuery.refetch(),
    ]);
  }, [
    universitiesQuery,
    interactionsQuery,
    tasksQuery,
    workflowsQuery,
    workflowStepsQuery,
  ]);

  useRealtimeSync({
    enabled: !!user,
    onNotice: (msg) => setNotice(msg),
  });

  useEffect(() => {
    const stop = startHealthCheck((isOnline) => setOnline(isOnline), 30_000);
    return () => stop();
  }, []);

  const ipGuard = useIpGuard(!!user, user?.profileId ?? undefined, user?.email);

  const handleWarn = useCallback(() => setTimeoutWarn(true), []);
  const handleTimeout = useCallback(async () => {
    setTimeoutWarn(false);
    await signOut();
  }, [signOut]);

  useSessionTimeout({
    enabled: !!user,
    timeoutMinutes: 30,
    warnBeforeMinutes: 2,
    userId: user?.profileId ?? undefined,
    email: user?.email,
    onWarn: handleWarn,
    onTimeout: handleTimeout,
  });

  useReminders({ enabled: !!user, user: user as CrmUser | null });

  useEffect(() => {
    if (!user?.profileId) return;
    let cancelled = false;
    void (async () => {
      const [s, p] = await Promise.all([
        listSteps(),
        getPreferences(user.profileId!),
      ]);
      if (cancelled) return;
      setOnboardingSteps(s);
      setPrefs(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.profileId]);

  useEffect(() => {
    if (!user || !prefs || onboardingSteps.length === 0) return;
    if (prefs.onboarding_completed) return;
    if (prefs.onboarding_dismissed) return;
    if (showTour) return;

    const timer = window.setTimeout(() => setShowTour(true), 800);
    return () => window.clearTimeout(timer);
  }, [user, prefs, onboardingSteps.length, showTour]);

  const finishTour = useCallback(async () => {
    if (!user?.profileId) return;
    await updatePreferences(user.profileId, {
      onboarding_completed: true,
      tour_completed: true,
    });
    setShowTour(false);
    setPrefs((p) =>
      p ? { ...p, onboarding_completed: true, tour_completed: true } : p,
    );
    setNotice('Отлично! Теперь вы знаете основы.');
  }, [user?.profileId]);

  const skipTour = useCallback(async () => {
    if (!user?.profileId) return;
    await updatePreferences(user.profileId, { onboarding_dismissed: true });
    setShowTour(false);
    setPrefs((p) => (p ? { ...p, onboarding_dismissed: true } : p));
  }, [user?.profileId]);

  const dismissBanner = useCallback(async () => {
    if (!user?.profileId) return;
    await updatePreferences(user.profileId, { onboarding_dismissed: true });
    setPrefs((p) => (p ? { ...p, onboarding_dismissed: true } : p));
  }, [user?.profileId]);

  const navigate = useCallback((next: ViewKey) => {
    setPage(next);
    setSidebarOpen(false);
  }, []);

  useKeyboardShortcuts({
    onNavigate: navigate,
    onNewUniversity: () => navigate('universities'),
    onNewTask: () => navigate('tasks'),
    onNewInteraction: () => navigate('interactions'),
    onSearch: () => setPaletteOpen(true),
    onShowHelp: () => setHelpOpen(true),
    onToggleTheme: toggleTheme,
    onUndo: () => void undo(),
    onRedo: () => void redo(),
    disabled: !user,
  });

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const NAV_ITEMS: NavItem[] = useMemo(
    () => [
      { key: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, group: t('nav.group_workspace') },
      { key: 'my-dashboards', label: t('nav.my_dashboards'), icon: LayoutDashboard, group: t('nav.group_workspace') },
      { key: 'universities', label: t('nav.universities'), icon: GraduationCap, group: t('nav.group_workspace') },
      { key: 'interactions', label: t('nav.interactions'), icon: MessagesSquare, group: t('nav.group_workspace') },
      { key: 'calendar', label: t('nav.calendar'), icon: CalendarDays, group: t('nav.group_workspace') },
      { key: 'calls', label: t('nav.calls'), icon: Phone, group: t('nav.group_workspace') },
      { key: 'kanban', label: t('nav.kanban'), icon: Trello, group: t('nav.group_workspace') },
      { key: 'tasks', label: t('nav.tasks'), icon: CheckSquare, group: t('nav.group_workspace') },
      { key: 'workflows', label: t('nav.workflows'), icon: Workflow, group: t('nav.group_workspace') },
      { key: 'contracts', label: t('nav.contracts'), icon: FileText, group: t('nav.group_workspace') },
      { key: 'segments', label: t('nav.segments'), icon: Users, group: t('nav.group_workspace') },
      { key: 'inbox', label: t('nav.inbox'), icon: Inbox, group: t('nav.group_workspace') },
      { key: 'orders', label: 'Заявки', icon: FileText, group: t('nav.group_workspace') },
      { key: 'learners', label: 'Слушатели', icon: Users, group: t('nav.group_workspace') },
      { key: 'courses', label: 'Курсы', icon: BookOpen, group: t('nav.group_workspace') },

      { key: 'reports', label: t('nav.reports'), icon: FileBarChart, group: t('nav.group_analytics') },
      { key: 'interactions-report', label: t('nav.interactions'), icon: FileText, group: t('nav.group_analytics') },
      { key: 'metrics', label: t('nav.metrics'), icon: BarChart3, group: t('nav.group_analytics') },
      { key: 'analytics', label: t('nav.analytics'), icon: TrendingUp, group: t('nav.group_analytics'), permission: 'analytics.view' },
      { key: 'executive', label: t('nav.executive'), icon: TrendingUp, group: t('nav.group_analytics') },

      { key: 'users', label: t('nav.users'), icon: Users, group: t('nav.group_admin'), adminOnly: true },
      { key: 'custom-roles', label: t('nav.custom_roles'), icon: Shield, group: t('nav.group_admin'), permission: 'users.manage' },
      { key: 'integrations', label: t('nav.integrations'), icon: Plug, group: t('nav.group_admin'), permission: 'integrations.manage' },
      { key: 'catalogs', label: t('nav.catalogs'), icon: Layers, group: t('nav.group_admin'), permission: 'catalogs.manage' },
      { key: 'automation', label: t('nav.automation'), icon: Workflow, group: t('nav.group_admin'), adminOnly: true },
      { key: 'journal', label: t('nav.journal'), icon: ShieldCheck, group: t('nav.group_admin'), permission: 'audit.view' },
      { key: 'system-health', label: t('nav.system_health'), icon: Activity, group: t('nav.group_admin'), adminOnly: true },
      { key: 'security', label: t('nav.security'), icon: Lock, group: t('nav.group_admin') },
      { key: 'trash', label: t('nav.trash'), icon: Trash2, group: t('nav.group_admin') },
      { key: 'backup', label: t('nav.backup'), icon: Database, group: t('nav.group_admin'), permission: 'backup.manage' },

      { key: 'knowledge', label: t('nav.knowledge'), icon: BookOpen, group: t('nav.group_system') },
      { key: 'about', label: 'О проекте', icon: Info, group: t('nav.group_system') },
      { key: 'settings', label: t('nav.settings'), icon: Settings, group: t('nav.group_system') },
    ],
    [t],
  );

  if (ipGuard.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-atmr-bg-page">
        <LoadingState />
      </div>
    );
  }

  if (!ipGuard.allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-atmr-bg-page p-4">
        <div className="max-w-md bg-atmr-bg-surface1 rounded-atmr-xl p-8 shadow-atmr-l text-center">
          <div className="w-14 h-14 mx-auto rounded-atmr-full bg-atmr-error-soft flex items-center justify-center mb-4">
            <Lock size={24} className="text-atmr-error" />
          </div>
          <h1 className="atmr-h3 text-atmr-fg mb-2">
            {t('errors.forbidden')}
          </h1>
          <p className="atmr-body-s text-atmr-fg-soft mb-6">
            Ваш IP {ipGuard.ip} не входит в белый список.
          </p>
          <Button
            variant="secondary"
            onClick={() => void signOut()}
            className="w-full"
          >
            {t('auth.login_button')}
          </Button>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  const hasPerm = (p: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.permissions?.includes(p) ?? false;
  };

  const visibleNav = NAV_ITEMS.filter((n) => {
    if (n.adminOnly && !isAdmin) return false;
    if (n.permission && !hasPerm(n.permission)) return false;
    return true;
  });

  const navGroups = Array.from(new Set(visibleNav.map((n) => n.group)));

  const plannedCount = interactions.filter((i) => i.status === 'Запланировано').length;
  const openTasksCount = tasks.filter(
    (t) => t.status !== 'Готово' && t.status !== 'Отменено',
  ).length;

  const displayName = user?.name ?? 'Пользователь';
  const roleLabel =
    user?.role === 'admin'
      ? 'Администратор'
      : user?.role === 'manager'
        ? 'Руководитель'
        : 'Пользователь (НАМ)';

  const showBanner =
    !!prefs && !prefs.onboarding_completed && !prefs.onboarding_dismissed;

  const counters: Partial<Record<ViewKey, number>> = {
    universities: universities.length,
    interactions: plannedCount,
    tasks: openTasksCount,
  };

  const pageTitle = t(`nav.${page.replace(/-/g, '_')}`);

  return (
    <div className="min-h-screen bg-atmr-bg-page flex">
      <aside
        className={`fixed lg:sticky top-0 left-0 z-atmr-2xl h-screen w-64 bg-atmr-bg-surface1 border-r border-atmr-border-soft flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-5 py-5 border-b border-atmr-border-soft">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-atmr-l bg-atmr-accent text-atmr-accent-on flex items-center justify-center">
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="atmr-body-s-strong text-atmr-fg leading-tight">
                {t('app.short_name')}
              </p>
              <p className="atmr-desc-l text-atmr-fg-muted leading-tight">
                Ростелеком CRM
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {navGroups.map((group) => (
            <div key={group} className="mb-4">
              <p className="atmr-desc-l-strong text-atmr-fg-muted uppercase tracking-wide px-3 mb-1.5">
                {group}
              </p>
              {visibleNav
                .filter((n) => n.group === group)
                .map((item) => {
                  const Icon = item.icon;
                  const count = counters[item.key] ?? 0;
                  return (
                    <button
                      key={item.key}
                      data-tour={`nav-${item.key}`}
                      onClick={() => navigate(item.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-atmr-l atmr-body-s-strong transition-colors duration-atmr-fast mb-0.5 ${
                        page === item.key
                          ? 'bg-atmr-accent-soft text-atmr-accent'
                          : 'text-atmr-fg-soft hover:bg-atmr-bg-surface2 hover:text-atmr-fg'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {count > 0 && (
                        <span
                          className={`atmr-desc-l-strong px-2 py-0.5 rounded-atmr-full ${
                            page === item.key
                              ? 'bg-atmr-accent-muted text-atmr-accent'
                              : 'bg-atmr-bg-surface2 text-atmr-fg-muted'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-atmr-border-soft space-y-1">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-atmr-l atmr-desc-l-strong text-atmr-fg-soft hover:bg-atmr-bg-surface2 transition-colors duration-atmr-fast"
          >
            {resolved === 'dark' ? '☀️ Светлая тема' : '🌙 Тёмная тема'}
          </button>
          <div className="flex items-center gap-3 px-2 py-2 rounded-atmr-l">
            <Avatar name={displayName} size="md" />
            <div className="flex-1 min-w-0">
              <p className="atmr-body-s-strong text-atmr-fg truncate">
                {displayName}
              </p>
              <p className="atmr-desc-l text-atmr-fg-muted truncate">
                {roleLabel}
              </p>
            </div>
          </div>
          <button
            onClick={() => void signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-atmr-l atmr-desc-l-strong text-atmr-fg-soft hover:bg-atmr-error-soft hover:text-atmr-error-fg transition-colors duration-atmr-fast"
          >
            <MoreHorizontal size={14} /> {t('auth.login_title')}
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-atmr-l bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-atmr-m bg-atmr-bg-surface1/80 backdrop-blur-md border-b border-atmr-border-soft px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-atmr-m text-atmr-fg-soft hover:bg-atmr-bg-surface2 transition-colors"
              aria-label="Открыть меню"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 atmr-body-s">
              <span className="text-atmr-fg-muted">{t('app.short_name')}</span>
              <span className="text-atmr-fg-disabled">/</span>
              <strong className="atmr-body-s-strong text-atmr-fg">
                {pageTitle}
              </strong>
            </div>
            <span
              className={`hidden sm:flex items-center gap-1.5 atmr-desc-s ml-2 ${
                online ? 'text-atmr-success' : 'text-atmr-error'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {online && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-atmr-success opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    online ? 'bg-atmr-success' : 'bg-atmr-error'
                  }`}
                />
              </span>
              {online ? t('app.online') : t('app.offline')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void undo()}
              disabled={!canUndo}
              className="p-2 rounded-atmr-m text-atmr-fg-muted hover:bg-atmr-bg-surface2 hover:text-atmr-fg disabled:opacity-30 transition-colors duration-atmr-fast"
              title="Отменить (⌘Z)"
              aria-label="Отменить"
            >
              <Undo2 size={18} />
            </button>
            <button
              onClick={() => void redo()}
              disabled={!canRedo}
              className="p-2 rounded-atmr-m text-atmr-fg-muted hover:bg-atmr-bg-surface2 hover:text-atmr-fg disabled:opacity-30 transition-colors duration-atmr-fast"
              title="Повторить (⌘⇧Z)"
              aria-label="Повторить"
            >
              <Redo2 size={18} />
            </button>
            <button
              data-tour="search"
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-atmr-m text-atmr-fg-muted hover:bg-atmr-bg-surface2 hover:text-atmr-fg transition-colors duration-atmr-fast atmr-body-s"
            >
              <Search size={15} />
              <span>{t('actions.search')}</span>
              <kbd className="ml-2 atmr-desc-s border border-atmr-border rounded px-1.5 py-0.5 font-mono">
                ⌘K
              </kbd>
            </button>
            <button
              onClick={() => setPaletteOpen(true)}
              className="sm:hidden p-2 rounded-atmr-m text-atmr-fg-muted hover:bg-atmr-bg-surface2 transition-colors"
              aria-label={t('actions.search')}
            >
              <Search size={19} />
            </button>
            <LanguageSwitcher />
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="relative p-2 rounded-atmr-m text-atmr-fg-muted hover:bg-atmr-bg-surface2 hover:text-atmr-fg transition-colors duration-atmr-fast"
              aria-label="Уведомления"
            >
              <Bell size={19} />
              {notifications.unread > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-atmr-error text-white atmr-desc-s-strong rounded-atmr-full flex items-center justify-center">
                  {notifications.unread > 9 ? '9+' : notifications.unread}
                </span>
              )}
            </button>
            <div className="hidden sm:flex items-center gap-2 ml-1">
              <Avatar name={displayName} size="sm" />
              <ChevronDown size={14} className="text-atmr-fg-disabled" />
            </div>
          </div>
        </header>

        <MfaRequiredBanner />

        {notifOpen && (
          <div className="relative">
            <NotificationsPanel
              items={notifications.items}
              loading={notifications.loading}
              onMarkRead={notifications.markRead}
              onMarkAllRead={notifications.markAllRead}
              onRemove={notifications.remove}
              onClose={() => setNotifOpen(false)}
            />
          </div>
        )}

        {notice && <Toast message={notice} onClose={() => setNotice('')} />}

        {timeoutWarn && (
          <div className="fixed bottom-6 right-6 z-atmr-3xl max-w-sm p-4 rounded-atmr-xl bg-atmr-warning text-white shadow-atmr-xl animate-slide-up">
            <p className="atmr-body-s-strong mb-1">Сессия скоро завершится</p>
            <p className="atmr-desc-l opacity-90 mb-3">
              Вы неактивны — выход через 2 минуты.
            </p>
            <button
              onClick={() => setTimeoutWarn(false)}
              className="w-full py-2 rounded-atmr-m bg-white/20 hover:bg-white/30 atmr-body-s-strong transition-colors duration-atmr-fast"
            >
              Остаться в системе
            </button>
          </div>
        )}

        <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full pb-24 lg:pb-6">
          {loading ? (
            <LoadingState />
          ) : (
            <Suspense fallback={<LoadingState />}>
              {page === 'dashboard' && (
                <>
                  {showBanner && (
                    <OnboardingBanner
                      userName={displayName}
                      onStartTour={() => setShowTour(true)}
                      onOpenKnowledge={() => navigate('knowledge')}
                      onDismiss={() => void dismissBanner()}
                    />
                  )}
                  <DashboardPage
                    universities={universities}
                    interactions={interactions}
                    tasks={tasks}
                    workflows={workflows}
                    onNavigate={navigate}
                    onAddUniversity={() => navigate('universities')}
                    onExport={() => {
                      setNotice('Откройте раздел Отчёты для экспорта.');
                      navigate('reports');
                    }}
                  />
                </>
              )}

              {page === 'my-dashboards' && (
                <MyDashboardsPage
                  universities={universities}
                  interactions={interactions}
                  tasks={tasks}
                  workflows={workflows}
                  managers={managers}
                  onNotice={setNotice}
                />
              )}

              {page === 'universities' && <UniversitiesPage />}

              {page === 'interactions' && (
                <InteractionsPage
                  universities={universities}
                  onNotice={setNotice}
                />
              )}

              {page === 'interactions-report' && (
                <InteractionsReportPage
                  universities={universities}
                  interactions={interactions}
                  onNotice={setNotice}
                />
              )}

              {page === 'calendar' && (
                <CalendarPage
                  interactions={interactions}
                  universities={universities}
                  onNotice={setNotice}
                  onRefresh={loadData}
                />
              )}

              {page === 'calls' && (
                <CallsPageContainer
                  universities={universities}
                  onNotice={setNotice}
                  onRefresh={loadData}
                />
              )}

              {page === 'kanban' && (
                <KanbanPage
                  tasks={tasks}
                  universities={universities}
                  workflows={workflows}
                  workflowSteps={workflowSteps}
                  managers={managers}
                  onNotice={setNotice}
                  onRefresh={loadData}
                />
              )}

              {page === 'tasks' && (
                <TasksPage
                  universities={universities}
                  managers={managers}
                  onNotice={setNotice}
                />
              )}

              {page === 'workflows' && (
                <WorkflowsPage
                  workflows={workflows}
                  workflowSteps={workflowSteps}
                  onNotice={setNotice}
                  onRefresh={loadData}
                />
              )}

              {page === 'automation' && isAdmin && (
                <AutomationPage onNotice={setNotice} />
              )}

              {page === 'contracts' && (
                <ContractsPage
                  universities={universities}
                  onNotice={setNotice}
                />
              )}

              {page === 'segments' && (
                <SegmentsPage
                  universities={universities}
                  interactions={interactions}
                  tasks={tasks}
                  onNotice={setNotice}
                />
              )}

              {page === 'inbox' && (
                <InboxPage
                  universities={universities}
                  currentUserName={displayName}
                  onNotice={setNotice}
                  onRefresh={loadData}
                />
              )}

              {page === 'orders' && <OrdersPage onNotice={setNotice} />}
              {page === 'learners' && <LearnersPage onNotice={setNotice} />}
              {page === 'courses' && <CoursesPage />}

              {page === 'reports' && (
                <ReportsPage
                  universities={universities}
                  interactions={interactions}
                  tasks={tasks}
                  workflows={workflows}
                  onNotice={setNotice}
                />
              )}

              {page === 'metrics' && (
                <MetricsPage
                  universities={universities}
                  interactions={interactions}
                  tasks={tasks}
                  workflows={workflows}
                  managers={managers}
                />
              )}

              {page === 'analytics' && <AnalyticsPage onNotice={setNotice} />}

              {page === 'executive' && (
                <ExecutiveDashboardPage
                  universities={universities}
                  interactions={interactions}
                  tasks={tasks}
                  workflows={workflows}
                  managers={managers}
                />
              )}

              {page === 'users' && isAdmin && (
                <UsersPageContainer
                  onNotice={setNotice}
                  currentRole={user?.role ?? 'nam'}
                  currentUserId={user?.profileId ?? ''}
                />
              )}

              {page === 'custom-roles' && isAdmin && (
                <CustomRolesPage onNotice={setNotice} />
              )}

              {page === 'integrations' && isAdmin && (
                <IntegrationsPage onNotice={setNotice} />
              )}

              {page === 'catalogs' && isAdmin && (
                <CatalogsPage onNotice={setNotice} />
              )}

              {page === 'journal' && isAdmin && (
                <JournalPageContainer onRefresh={loadData} />
              )}

              {page === 'system-health' && isAdmin && (
                <SystemHealthPage onNotice={setNotice} />
              )}

              {page === 'security' && (
                <SecurityPage
                  currentRole={user?.role ?? 'nam'}
                  onNotice={setNotice}
                />
              )}

              {page === 'trash' && (
                <TrashPage onNotice={setNotice} onRefresh={loadData} />
              )}

              {page === 'backup' && isAdmin && (
                <BackupPage onNotice={setNotice} onRefresh={loadData} />
              )}

              {page === 'knowledge' && (
                <KnowledgePage
                  currentRole={user?.role ?? 'nam'}
                  onNotice={setNotice}
                />
              )}

              {page === 'about' && <AboutPage />}

              {page === 'settings' && (
                <SettingsPageContainer
                  onNotice={setNotice}
                  onRefresh={loadData}
                />
              )}
            </Suspense>
          )}
        </div>

        <MobileBottomNav
          current={page}
          onNavigate={navigate}
          onOpenMenu={() => setSidebarOpen(true)}
        />
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(view) => navigate(view)}
      />

      {helpOpen && <KeyboardShortcutsHelp onClose={() => setHelpOpen(false)} />}

      {showTour && onboardingSteps.length > 0 && user && (
        <OnboardingTour
          steps={onboardingSteps}
          userId={user.profileId ?? ''}
          onComplete={finishTour}
          onSkip={skipTour}
        />
      )}

      <button
        onClick={() => setKbChatOpen(true)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-atmr-l w-14 h-14 rounded-atmr-full bg-atmr-accent hover:bg-atmr-accent-hover text-atmr-accent-on shadow-atmr-accent flex items-center justify-center transition-colors duration-atmr-fast"
        aria-label="Спросить AI"
        title="Спросить AI по базе знаний"
      >
        <Sparkles size={22} />
      </button>

      {kbChatOpen && (
        <KbChatWidget
          onClose={() => setKbChatOpen(false)}
          onOpenArticle={(slug) => {
            setPage('knowledge');
            setKbChatOpen(false);
            try {
              sessionStorage.setItem('kb:open-slug', slug);
            } catch {
              /* приватный режим — игнорируем */
            }
          }}
        />
      )}

      <OfflineBanner />
      <InstallPrompt />
    </div>
  );
}

function CallsPageContainer({
  universities,
  onNotice,
  onRefresh,
}: {
  universities: University[];
  onNotice: (msg: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const api = useApi();
  const callsQuery = useQuery({
    queryKey: ['calls', 'list'],
    queryFn: () => api.get<CallLog[]>('/calls?pageSize=200'),
    staleTime: 30_000,
  });

  return (
    <CallsPage
      calls={callsQuery.data ?? []}
      universities={universities}
      onNotice={onNotice}
      onRefresh={async () => {
        await callsQuery.refetch();
        await onRefresh();
      }}
    />
  );
}

function UsersPageContainer({
  onNotice,
  currentRole,
  currentUserId,
}: {
  onNotice: (msg: string) => void;
  currentRole: string;
  currentUserId: string;
}) {
  const api = useApi();
  const usersQuery = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.get<Profile[]>('/users'),
    staleTime: 60_000,
  });

  return (
    <UsersPage
      users={usersQuery.data ?? []}
      onNotice={onNotice}
      onRefresh={() => usersQuery.refetch().then(() => undefined)}
      currentRole={currentRole}
      currentUserId={currentUserId}
    />
  );
}

function JournalPageContainer({
  onRefresh,
}: {
  onRefresh: () => Promise<void>;
}) {
  const api = useApi();
  const logsQuery = useQuery({
    queryKey: ['audit', 'list'],
    queryFn: () => api.get<AuditLogEntry[]>('/audit?limit=300'),
    staleTime: 30_000,
  });

  return (
    <JournalPage
      logs={logsQuery.data ?? []}
      onRefresh={async () => {
        await logsQuery.refetch();
        await onRefresh();
      }}
    />
  );
}

function SettingsPageContainer({
  onNotice,
  onRefresh,
}: {
  onNotice: (msg: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const api = useApi();
  const profileQuery = useQuery({
    queryKey: ['workspace-settings'],
    queryFn: () =>
      api.get<ProfileSettings | null>('/settings/profile').catch(() => null),
    staleTime: 60_000,
  });

  return (
    <SettingsPage
      profile={profileQuery.data ?? null}
      onNotice={onNotice}
      onRefresh={async () => {
        await profileQuery.refetch();
        await onRefresh();
      }}
    />
  );
}