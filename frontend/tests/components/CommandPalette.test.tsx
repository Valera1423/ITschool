import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from '@/components/CommandPalette';
import { globalSearch } from '@/lib/search';

vi.mock('@/lib/search', () => ({
  globalSearch: vi.fn().mockResolvedValue([
    { entity: 'universities', id: 'u1', title: 'МФТИ', subtitle: 'Москва' },
  ]),
  SEARCH_ENTITY_LABELS: { universities: 'Вуз' },
  targetViewFor: () => 'universities',
}));

describe('CommandPalette', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('ищет после 2 символов', async () => {
    const onNavigate = vi.fn();
    render(
      <CommandPalette open onClose={() => {}} onNavigate={onNavigate} />,
    );

    const input = screen.getByPlaceholderText(/ищите/i);
    await userEvent.type(input, 'мф');

    await waitFor(() => {
      expect(globalSearch).toHaveBeenCalledWith('мф');
    });
  });

  it('Enter открывает результат', async () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette open onClose={onClose} onNavigate={onNavigate} />,
    );

    await userEvent.type(screen.getByPlaceholderText(/ищите/i), 'мфти');

    await waitFor(() => screen.getByText('МФТИ'));
    await userEvent.keyboard('{Enter}');

    expect(onNavigate).toHaveBeenCalledWith('universities', 'u1');
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape закрывает', async () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} onNavigate={() => {}} />);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});