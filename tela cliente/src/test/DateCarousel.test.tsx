import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DateCarousel from '../components/DateCarousel';
import { getLocalDateISO } from '../lib/format';

describe('DateCarousel Component (DateCarousel.tsx)', () => {
  it('usa o dia da arena na virada do dia', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T04:30:00Z'));
    try {
      const onSelect = vi.fn();
      render(<DateCarousel selectedISO="2026-10-20" onSelect={onSelect} timeZone="America/Rio_Branco" />);
      expect(screen.getByText('20/10')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Hoje/ }));
      expect(onSelect).toHaveBeenCalledWith('2026-10-20');
    } finally {
      vi.useRealTimers();
    }
  });

  const todayISO = getLocalDateISO();

  it('deve renderizar a seção de escolha de data e a opção "Hoje"', () => {
    render(<DateCarousel selectedISO={todayISO} onSelect={vi.fn()} />);
    expect(screen.getByText('Escolha a data')).toBeInTheDocument();
    expect(screen.getByText('Hoje')).toBeInTheDocument();
  });

  it('deve disparar onSelect ao clicar em um dia', () => {
    const onSelectMock = vi.fn();
    render(<DateCarousel selectedISO={todayISO} onSelect={onSelectMock} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(7);

    // Clica no segundo dia
    fireEvent.click(buttons[1]);
    expect(onSelectMock).toHaveBeenCalledTimes(1);
  });
});
