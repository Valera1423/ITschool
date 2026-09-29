import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from '@/components/ui';

describe('Field', () => {
  it('рендерит label и input', () => {
    render(
      <Field label="Название">
        <input data-testid="input" />
      </Field>,
    );
    expect(screen.getByText('Название')).toBeInTheDocument();
    expect(screen.getByTestId('input')).toBeInTheDocument();
  });

  it('ассоциирует label с input через вложенность', async () => {
    render(
      <Field label="Email">
        <input type="email" />
      </Field>,
    );
    const input = screen.getByRole('textbox');
    await userEvent.click(screen.getByText('Email'));
    expect(input).toHaveFocus();
  });
});