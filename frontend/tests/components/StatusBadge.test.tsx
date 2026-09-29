import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/ui';

describe('StatusBadge', () => {
  it('рендерит статус', () => {
    render(<StatusBadge status="Новый" />);
    expect(screen.getByText('Новый')).toBeInTheDocument();
  });

  it('работает с неизвестным статусом', () => {
    render(<StatusBadge status="Совершенно новый статус" />);
    expect(screen.getByText('Совершенно новый статус')).toBeInTheDocument();
  });
});