import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DateCarousel from '../components/DateCarousel';
import { getLocalDateISO } from '../lib/format';

describe('DateCarousel Component (DateCarousel.tsx)', () => {
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
