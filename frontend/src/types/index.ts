// frontend/src/types/index.ts

// ============================================================
// ДОМЕННЫЕ МОДЕЛИ
// ============================================================

export interface University {
  id: string;
  name: string;
  city: string;
  direction: string;
  product: string;
  vendor_id: string | null;
  direction_id: string | null;
  product_id: string | null;
  manager_id: string | null;
  contract_number: string | null;
  license_signed: boolean;
  license_expires_at: string | null;
  status: string;
  handover_status: HandoverStatus;
  manager: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  telegram: string | null;
  whatsapp: string | null;
  max_messenger: string | null;
  source: string;
  notes: string | null;
  contract_value: number;
  first_response_at: string | null;
  expected_close_date: string | null;
  closed_at: string | null;
  loss_reason: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;

  current_step_id: string | null;
  current_workflow_id: string | null;

  vendor?: Vendor;
  directionRef?: ItDirection;
  productRef?: ItProduct;
  managerRef?: Manager;
  contacts?: UniversityContact[];
  tags?: UniversityTag[];
}

export type HandoverStatus =
  | 'Не передан'
  | 'Передан частично'
  | 'Передан полностью'
  | 'Отозван';

export interface UniversityContact {
  id: string;
  university_id: string;
  full_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  whatsapp: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  university_id: string;
  type: string;
  title: string;
  details: string | null;
  interaction_date: string;
  status: string;
  manager: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  meeting_url: string | null;
  location: string | null;
  attendees: string[];
  reminder_minutes: number | null;
  color: string | null;
  calendar_event_id: string | null;
  response_time_seconds: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  university?: { id: string; name: string; city: string };
}

export interface Task {
  id: string;
  university_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string;
  reminder_at: string | null;
  assignee: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  university?: { id: string; name: string };
}

export interface Comment {
  id: string;
  university_id: string | null;
  interaction_id: string | null;
  task_id: string | null;
  author: string;
  body: string;
  deleted_at: string | null;
  created_at: string;
  attachments?: {
    id?: string;
    name: string;
    url: string;
    size?: number;
    mime?: string | null;
  }[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  runs_count: number;
  is_default?: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  steps?: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  title: string;
  step_order: number;
  status: string;
  status_code: string | null;
  created_at: string;
}

export interface WorkflowUniversity {
  id: string;
  workflow_id: string;
  university_id: string;
  current_step_id: string | null;
  status: 'В работе' | 'Завершён' | 'Отменён';
  started_at: string;
  completed_at: string | null;
  updated_at: string;
  workflow?: Workflow;
  currentStep?: WorkflowStep;
}

export interface WorkflowTransition {
  id: string;
  step_id: string;
  university_id: string;
  from_status: string | null;
  to_status: string;
  comment: string | null;
  attachments: {
    id?: string;
    name: string;
    url: string;
    size?: number;
    mime?: string | null;
  }[];
  actor_name: string;
  actor_id: string | null;
  created_at: string;
}

export interface WorkflowStatusCatalog {
  id: string;
  code: string;
  label: string;
  color: string;
  sort_order: number;
  is_final: boolean;
  created_at: string;
}

export interface WorkflowTransitionRule {
  id: string;
  workflow_id: string;
  from_step_id: string;
  to_step_id: string;
  condition: Record<string, unknown>;
  requires_comment: boolean;
  created_at: string;
}

export interface WorkflowTemplateInfo {
  key: string;
  name: string;
  description: string;
  stepsCount: number;
}

// ============================================================
// КАТАЛОГИ
// ============================================================

export interface Vendor {
  id: string;
  name: string;
  description: string | null;
  site: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_methods: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItDirection {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ItProduct {
  id: string;
  name: string;
  vendor_id: string | null;
  description: string | null;
  license_type: string | null;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  vendor?: Vendor;
}

export interface Manager {
  id: string;
  profile_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  department: string | null;
  avatar_color: string;
  active: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// ПОЛЬЗОВАТЕЛИ
// ============================================================

export type UserRole = 'admin' | 'manager' | 'nam';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_color: string;
  blocked: boolean;
  totp_enabled: boolean;
  keycloak_sub: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileSettings {
  id: string;
  full_name: string;
  role: string;
  email: string;
  workspace_name: string;
  phone: string | null;
  notifications_enabled: boolean;
  updated_at: string;
}

export interface CrmUser {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  profileId: string | null;
  blocked: boolean;
  permissions?: string[];
  customRoleId?: string | null;
  mfa?: boolean;
}

// ============================================================
// ДОГОВОРЫ
// ============================================================

export type ContractStatus =
  | 'Черновик'
  | 'На проверке'
  | 'Согласован'
  | 'Подписан'
  | 'Отклонён'
  | 'Расторгнут';

export type ApprovalStatus = 'Ожидает' | 'Одобрено' | 'Отклонено' | 'Пропущено';

export interface Contract {
  id: string;
  university_id: string;
  title: string;
  contract_number: string | null;
  amount: number;
  currency: string;
  status: ContractStatus;
  current_step: number;
  signed_at: string | null;
  expires_at: string | null;
  signed_document_id: string | null;
  notes: string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  approvals?: ContractApproval[];
  versions?: ContractVersion[];
}

export interface ContractApproval {
  id: string;
  contract_id: string;
  step_order: number;
  role: string;
  approver_name: string | null;
  approver_id: string | null;
  status: ApprovalStatus;
  comment: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface ContractVersion {
  id: string;
  contract_id: string;
  version: number;
  document_id: string | null;
  storage_path: string | null;
  name: string | null;
  size_bytes: number;
  uploaded_by: string | null;
  comment: string | null;
  created_at: string;
}

// ============================================================
// СЕГМЕНТЫ
// ============================================================

export type SegmentOperator =
  | 'equals' | 'not_equals' | 'greater' | 'less'
  | 'contains' | 'in' | 'not_in' | 'empty' | 'not_empty';

export interface SegmentRule {
  field: string;
  operator: SegmentOperator;
  value?: unknown;
}

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  entity: string;
  rules: SegmentRule[];
  logic: 'AND' | 'OR';
  color: string | null;
  created_by: string | null;
  shared: boolean;
  auto_refresh: boolean;
  last_count: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// ДОКУМЕНТЫ
// ============================================================

export interface DocumentItem {
  id: string;
  university_id: string | null;
  name: string;
  description: string | null;
  category: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number;
  version: number;
  parent_document_id: string | null;
  uploaded_by: string;
  created_at: string;
  deleted_at: string | null;
}

// ============================================================
// УВЕДОМЛЕНИЯ
// ============================================================

export interface AppNotification {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  body: string | null;
  entity: string | null;
  entity_id: string | null;
  action_url: string | null;
  read: boolean;
  created_at: string;
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

// ============================================================
// ИНБОКС
// ============================================================

export type InboxChannel = 'email' | 'telegram' | 'whatsapp' | 'max' | 'sms' | 'web';

export interface InboxMessage {
  id: string;
  channel: InboxChannel;
  direction: 'in' | 'out';
  external_id: string | null;
  from_address: string;
  from_name: string | null;
  to_address: string | null;
  subject: string | null;
  body: string;
  attachments: { name: string; url: string; size?: number }[];
  university_id: string | null;
  interaction_id: string | null;
  manager: string | null;
  read: boolean;
  archived: boolean;
  replied: boolean;
  raw: Record<string, unknown>;
  received_at: string;
  created_at: string;
}

// ============================================================
// АУДИТ
// ============================================================

export interface AuditLogEntry {
  id: number;
  user_id: string | null;
  user_email: string | null;
  entity: string;
  entity_id: string | null;
  action: 'insert' | 'update' | 'delete' | 'restore';
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
  user?: { id: string; full_name: string; email: string } | null;
}

export interface SecurityEvent {
  id: number;
  user_id: string | null;
  email: string | null;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  ip: string | null;
  user_agent: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface PdConsent {
  id: string;
  subject_type: 'contact' | 'user';
  subject_id: string | null;
  subject_email: string | null;
  subject_name: string | null;
  consent_type: string;
  granted: boolean;
  granted_at: string;
  revoked_at: string | null;
  document_version: string | null;
  source: string | null;
  ip: string | null;
  notes: string | null;
  created_by: string | null;
}

export interface UserSession {
  id: string;
  user_id: string;
  token_hash: string;
  ip: string | null;
  user_agent: string | null;
  device_label: string | null;
  last_active_at: string;
  expires_at: string;
  revoked: boolean;
  created_at: string;
}

export interface IpWhitelistEntry {
  id: string;
  cidr: string;
  label: string | null;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
}

// ============================================================
// АВТОМАТИЗАЦИЯ
// ============================================================

export type TriggerType =
  | 'on_create'
  | 'on_update'
  | 'on_field_change'
  | 'on_date_reached'
  | 'on_schedule';

export type ConditionOperator =
  | 'equals' | 'not_equals' | 'contains' | 'not_contains'
  | 'greater' | 'less' | 'empty' | 'not_empty' | 'in' | 'not_in';

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value?: string | number | boolean | string[];
}

export type ActionType =
  | 'create_task' | 'create_interaction' | 'update_field' | 'send_notification'
  | 'send_email' | 'send_telegram' | 'add_tag' | 'remove_tag' | 'assign_manager';

export interface RuleAction {
  type: ActionType;
  params: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  entity: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  conditions: RuleCondition[];
  actions: RuleAction[];
  run_count: number;
  last_run_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRun {
  id: number;
  rule_id: string;
  entity_id: string | null;
  trigger_payload: Record<string, unknown> | null;
  actions_result: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
  ran_at: string;
}

// ============================================================
// TIMELINE
// ============================================================

export interface TimelineEvent {
  kind:
    | 'created' | 'interaction' | 'task' | 'comment'
    | 'document' | 'call' | 'custom_field' | 'tag';
  event_id: string;
  title: string;
  description: string | null;
  actor: string | null;
  happened_at: string;
  payload: Record<string, unknown>;
}

// ============================================================
// КАСТОМНЫЕ ПОЛЯ
// ============================================================

export type CustomFieldType =
  | 'text' | 'number' | 'date' | 'select' | 'multiselect'
  | 'bool' | 'url' | 'phone' | 'email';

export interface CustomField {
  id: string;
  key: string;
  label: string;
  field_type: CustomFieldType;
  options: string[];
  default_value: string | null;
  help_text: string | null;
  required: boolean;
  show_in_table: boolean;
  sort_order: number;
  entity: string;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldValue {
  id: string;
  field_id: string;
  entity_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_bool: boolean | null;
  value_json: unknown[] | null;
  updated_at: string;
  updated_by: string | null;
}

// ============================================================
// ТЕГИ
// ============================================================

export interface Tag {
  id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
}

export interface UniversityTag {
  university_id: string;
  tag_id: string;
  created_at: string;
  tag?: Tag;
}

// ============================================================
// СОХРАНЁННЫЕ ВИДЫ
// ============================================================

export interface SavedView {
  id: string;
  user_id: string;
  name: string;
  entity: string;
  filters: Record<string, unknown>;
  sort: Record<string, unknown> | null;
  color: string | null;
  icon: string | null;
  pinned: boolean;
  shared: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// ИНТЕГРАЦИИ
// ============================================================

export type IntegrationType =
  | 'custom_api' | 'pbx' | 'telegram' | 'whatsapp' | 'email' | 'sms' | 'max';

export interface Integration {
  id: string;
  name: string;
  type: IntegrationType | string;
  config: Record<string, unknown>;
  status: 'Активна' | 'Отключена' | 'Ошибка';
  last_check_at: string | null;
  last_success_at?: string | null;
  last_error: string | null;
  check_count?: number;
  failure_count?: number;
  last_sync_at?: string | null;
  last_sync_status?: 'success' | 'partial' | 'failed' | null;
  last_sync_count?: number | null;
  sync_schedule?: string | null;
  auto_sync?: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  endpoints?: IntegrationEndpoint[];
}

export interface IntegrationEndpoint {
  id: string;
  integration_id: string;
  name: string;
  path: string;
  method: 'GET' | 'POST';
  entity: string;
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  mappings?: IntegrationFieldMapping[];
}

export interface IntegrationFieldMapping {
  id: string;
  endpoint_id: string;
  source_field: string;
  target_field: string;
  transform: string;
  transform_arg: string | null;
  required: boolean;
  default_value: string | null;
  created_at: string;
}

export interface IntegrationSyncLog {
  id: number;
  integration_id: string | null;
  endpoint_id: string | null;
  trigger: 'manual' | 'cron' | 'webhook';
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  status: 'running' | 'success' | 'partial' | 'failed';
  records_fetched: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  records_failed: number;
  error_message: string | null;
  request_url: string | null;
  response_sample: Record<string, unknown> | null;
  errors: { row: number; message: string }[];
  actor: string | null;
}

// ============================================================
// ЗВОНКИ
// ============================================================

export interface CallLog {
  id: string;
  university_id: string | null;
  contact_phone: string;
  contact_name: string | null;
  direction: 'Входящий' | 'Исходящий';
  duration_seconds: number;
  recording_url: string | null;
  started_at: string;
  manager: string;
  integration_id: string | null;
  notes: string | null;
  created_at: string;
}

// ============================================================
// БАЗА ЗНАНИЙ
// ============================================================

export interface KbCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface KbArticle {
  id: string;
  category_id: string | null;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  pinned: boolean;
  views: number;
  helpful_count: number;
  not_helpful_count: number;
  author_id: string | null;
  author_name: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// ДАШБОРДЫ
// ============================================================

export type WidgetType =
  | 'kpi_unis' | 'kpi_tasks' | 'kpi_interactions' | 'kpi_revenue'
  | 'funnel' | 'recent_activity' | 'upcoming_tasks' | 'top_managers'
  | 'chart_unis_by_status' | 'chart_interactions_by_type'
  | 'tasks_overdue' | 'unis_by_city' | 'workflow_status';

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title?: string;
  span: 1 | 2 | 3;
  order: number;
  config?: Record<string, unknown>;
}

export interface Dashboard {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  shared: boolean;
  layout: DashboardWidget[];
  created_at: string;
  updated_at: string;
}

// ============================================================
// ПОИСК
// ============================================================

export interface SearchResult {
  entity:
    | 'universities' | 'tasks' | 'interactions'
    | 'comments' | 'workflows' | 'documents';
  id: string;
  title: string;
  subtitle: string;
}

// ============================================================
// OAUTH
// ============================================================

export interface UserOAuthToken {
  id: string;
  user_id: string;
  provider: 'google' | 'outlook';
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// АНАЛИТИКА
// ============================================================

export interface UniversityMetrics {
  university_id: string;
  name: string;
  manager: string;
  status: string;
  created_at: string;
  contract_value: number;
  interactions_count: number;
  completed_interactions: number;
  last_touch_at: string | null;
  first_touch_at: string | null;
  days_since_last_touch: number;
  days_since_first_touch: number;
  open_tasks_count: number;
  done_tasks_count: number;
  contracts_value: number;
  contracts_count: number;
}

export interface CohortRow {
  cohort_month: string;
  period_offset: number;
  active_count: number;
  cohort_size: number;
}

export interface PeriodComparison {
  metric: string;
  current_value: number;
  previous_value: number;
  change_pct: number;
}

export type AbcCategory = 'A' | 'B' | 'C';
export type XyzCategory = 'X' | 'Y' | 'Z';

export type RfmSegment =
  | 'champions' | 'loyal' | 'potential_loyalist' | 'new' | 'promising'
  | 'need_attention' | 'about_to_sleep' | 'at_risk' | 'cant_lose'
  | 'hibernating' | 'lost';

export interface RfmResult {
  university_id: string;
  name: string;
  manager: string;
  recency: number;
  frequency: number;
  monetary: number;
  r_score: number;
  f_score: number;
  m_score: number;
  segment: RfmSegment;
}

// ============================================================
// ОНБОРДИНГ
// ============================================================

export interface OnboardingStep {
  id: string;
  step_key: string;
  title: string;
  description: string | null;
  target_selector: string | null;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  sort_order: number;
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  onboarding_completed: boolean;
  onboarding_dismissed: boolean;
  tour_completed: boolean;
  compact_mode: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// КАСТОМНЫЕ РОЛИ
// ============================================================

export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// СЛУШАТЕЛИ / КУРСЫ / ЗАЯВКИ
// ============================================================

export interface Learner {
  id: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;

  phone: string | null;
  email: string | null;
  snils: string | null;
  passport_series: string | null;
  passport_number: string | null;
  passport_issued_by: string | null;
  passport_issued_at: string | null;
  passport_dept_code: string | null;
  birth_date: string | null;
  gender: string | null;

  reg_region: string | null;
  reg_city: string | null;
  reg_street: string | null;
  reg_house: string | null;
  reg_flat: string | null;
  reg_index: string | null;

  education_level: string | null;
  diploma_profession: string | null;
  diploma_institution: string | null;
  diploma_last_name: string | null;
  diploma_number: string | null;
  diploma_series: string | null;
  diploma_reg_number: string | null;
  diploma_issued_at: string | null;

  created_at: string;
  updated_at: string;

  orders?: Order[];
}

export interface Course {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  streams?: CourseStream[];
}

export interface CourseStream {
  id: string;
  course_id: string;
  number: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  external_id: string;
  course_id: string;
  stream_id: string | null;
  learner_id: string;
  status: string;
  paid_at: string | null;
  amount: number | null;
  created_at: string;
  updated_at: string;
  course?: Course;
  stream?: CourseStream;
  learner?: Pick<Learner, 'id' | 'last_name' | 'first_name' | 'middle_name'>;
}

// ============================================================
// РОУТИНГ
// ============================================================

export type ViewKey =
  | 'dashboard'
  | 'my-dashboards'
  | 'universities'
  | 'interactions'
  | 'interactions-report'
  | 'calendar'
  | 'calls'
  | 'kanban'
  | 'tasks'
  | 'workflows'
  | 'automation'
  | 'contracts'
  | 'segments'
  | 'inbox'
  | 'reports'
  | 'metrics'
  | 'analytics'
  | 'executive'
  | 'users'
  | 'custom-roles'
  | 'integrations'
  | 'catalogs'
  | 'journal'
  | 'system-health'
  | 'security'
  | 'trash'
  | 'backup'
  | 'knowledge'
  | 'about'
  | 'settings'
  | 'orders'
  | 'learners'
  | 'courses';