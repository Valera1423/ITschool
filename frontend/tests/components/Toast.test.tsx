import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from '@/components/ui';

describe('Toast', () => {
  it('показывает сообщение', () => {
    render(<Toast message="Привет" onClose={() => {}} />);
    expect(screen.getByText('Привет')).toBeInTheDocument();
  });

  it('вызывает onClose', () => {
    const onClose = vi.fn();
    render(<Toast message="Привет" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});