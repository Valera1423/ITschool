import type { Meta, StoryObj } from '@storybook/react';
import { Toast } from './ui';

const meta: Meta<typeof Toast> = {
  title: 'UI/Toast',
  component: Toast,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Toast>;

export const Default: Story = {
  args: {
    message: 'Вуз успешно создан',
    onClose: () => {},
  },
};

export const WithAction: Story = {
  args: {
    message: 'Вуз удалён',
    onClose: () => {},
    action: { label: 'Отменить', onClick: () => alert('undo') },
  },
};