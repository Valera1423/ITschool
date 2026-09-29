import { z } from 'zod';

export const universitySchema = z.object({
  name: z.string().min(2, 'Минимум 2 символа').max(500),
  city: z.string().min(1, 'Укажите город').default('Москва'),
  direction: z.string().min(1).default('Разработка'),
  product: z.string().min(1).default('Ростелеком DataLab'),
  status: z.string().default('Новый'),
  handover_status: z.string().default('Не передан'),
  manager: z.string().default('Анна Кузнецова'),
  contract_number: z.string().nullable().optional(),
  contract_value: z.coerce.number().min(0).default(0),
  license_signed: z.boolean().default(false),
  license_expires_at: z.string().nullable().optional(),
  contact_name: z.string().nullable().optional(),
  contact_email: z.string().email('Некорректный email').nullable().optional().or(z.literal('')),
  contact_phone: z.string().nullable().optional(),
  telegram: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  max_messenger: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const taskSchema = z.object({
  title: z.string().min(1, 'Введите название').max(500),
  description: z.string().nullable().optional(),
  status: z.string().default('К выполнению'),
  priority: z.string().default('Средний'),
  due_date: z.string().refine(
    (v) => !isNaN(new Date(v).getTime()),
    'Некорректная дата',
  ),
  reminder_at: z.string().nullable().optional(),
  assignee: z.string().min(1, 'Выберите ответственного'),
  university_id: z.string().uuid().nullable().optional(),
});

export const interactionSchema = z.object({
  university_id: z.string().uuid('Выберите вуз'),
  type: z.string().min(1),
  title: z.string().min(1, 'Введите название').max(500),
  details: z.string().nullable().optional(),
  interaction_date: z.string().refine(
    (v) => !isNaN(new Date(v).getTime()),
    'Некорректная дата',
  ),
  status: z.string().default('Запланировано'),
  manager: z.string().min(1),
  start_time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  all_day: z.boolean().default(false),
  meeting_url: z.string().url('Некорректный URL').nullable().optional().or(z.literal('')),
  location: z.string().nullable().optional(),
});

export const contractSchema = z.object({
  university_id: z.string().uuid('Выберите вуз'),
  title: z.string().min(1, 'Введите название'),
  contract_number: z.string().nullable().optional(),
  amount: z.coerce.number().min(0, 'Сумма не может быть отрицательной'),
  currency: z.string().default('RUB'),
  expires_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  template: z.enum(['standard', 'short', 'legal']).default('standard'),
});

export type UniversityFormData = z.infer<typeof universitySchema>;
export type TaskFormData = z.infer<typeof taskSchema>;
export type InteractionFormData = z.infer<typeof interactionSchema>;
export type ContractFormData = z.infer<typeof contractSchema>;