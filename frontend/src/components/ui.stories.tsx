import type { Meta, StoryObj } from '@storybook/react';
import {
  Button,
  StatusBadge,
  PriorityBadge,
  EmptyState,
  Avatar,
  Toast,
  LoadingState,
  Field,
  inputClass,
} from './ui';
import { Plus, Inbox } from 'lucide-react';

const meta: Meta = {
  title: 'UI/Atoms',
  parameters: {
    layout: 'centered',
  },
};

export default meta;

// ============================================================
// Button
// ============================================================
export const Buttons: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4 items-start">
      <div className="flex gap-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </div>
      <div className="flex gap-2 items-center">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button disabled>Disabled</Button>
        <Button>
          <Plus size={15} /> С иконкой
        </Button>
      </div>
    </div>
  ),
};

// ============================================================
// Badges
// ============================================================
export const Badges: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-3 items-start">
      <div className="flex gap-2 flex-wrap">
        <StatusBadge status="Новый" />
        <StatusBadge status="Переговоры" />
        <StatusBadge status="Партнёр" />
        <StatusBadge status="Отказ" />
      </div>
      <div className="flex gap-2 flex-wrap">
        <PriorityBadge priority="Низкий" />
        <PriorityBadge priority="Средний" />
        <PriorityBadge priority="Высокий" />
        <PriorityBadge priority="Срочный" />
      </div>
    </div>
  ),
};

// ============================================================
// Avatar
// ============================================================
export const Avatars: StoryObj = {
  render: () => (
    <div className="flex gap-4 items-center">
      <Avatar name="Анна Кузнецова" size="sm" color="blue" />
      <Avatar name="Максим Орлов" size="md" color="green" />
      <Avatar name="Ольга Миронова" size="lg" color="purple" />
    </div>
  ),
};

// ============================================================
// EmptyState
// ============================================================
export const EmptyStates: StoryObj = {
  render: () => (
    <div className="w-96 bg-white dark:bg-slate-900 rounded-2xl">
      <EmptyState
        text="Здесь пока ничего нет"
        hint="Добавьте первую запись"
        icon={Inbox}
        actionLabel="Добавить"
        onAction={() => alert('clicked')}
      />
    </div>
  ),
};

// ============================================================
// Toast
// ============================================================
export const Toasts: StoryObj = {
  render: () => (
    <div className="relative h-32">
      <Toast message="Вуз успешно создан" onClose={() => {}} />
    </div>
  ),
};

export const ToastWithAction: StoryObj = {
  render: () => (
    <div className="relative h-32">
      <Toast
        message="Вуз удалён"
        onClose={() => {}}
        action={{ label: 'Отменить', onClick: () => alert('undo') }}
      />
    </div>
  ),
};

// ============================================================
// Field
// ============================================================
export const Fields: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4 w-96">
      <Field label="Название">
        <input className={inputClass} placeholder="МФТИ" />
      </Field>
      <Field label="Email">
        <input type="email" className={inputClass} placeholder="i@mipt.ru" />
      </Field>
    </div>
  ),
};

// ============================================================
// LoadingState
// ============================================================
export const Loading: StoryObj = {
  render: () => (
    <div className="w-96 bg-white dark:bg-slate-900 rounded-2xl">
      <LoadingState />
    </div>
  ),
};