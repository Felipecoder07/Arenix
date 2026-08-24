import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SlotGrid from '../components/SlotGrid';
import type { Slot } from '../types';

describe('SlotGrid Component (SlotGrid.tsx)', () => {
  const mockSlots: Slot[] = [
    {
      id: 'court1-2026-08-24-08:00',
      courtId: '1',
      dateISO: '2026-08-24',
      start: '08:00',
      end: '09:00',
      price: 100,
      status: 'free',
      block: 'manha',
      sport: 'Beach Tennis'
    },
    {
      id: 'court1-2026-08-24-14:00',
      courtId: '1',
      dateISO: '2026-08-24',
      start: '14:00',
      end: '15:00',
      price: 120,
      status: 'busy',
      block: 'tarde',
      sport: 'Beach Tennis'
    },
    {
      id: 'court1-2026-08-24-20:00',
      courtId: '1',
      dateISO: '2026-08-24',
      start: '20:00',
      end: '21:00',
      price: 140,
      status: 'past',
      block: 'noite',
      sport: 'Beach Tennis'
    }
  ];

  it('deve renderizar a quantidade correta de horários livres no topo', () => {
    render(<SlotGrid slots={mockSlots} onSelect={vi.fn()} showPrice={true} />);
    expect(screen.getByText('1 livres')).toBeInTheDocument();
    expect(screen.getByText('Horários disponíveis')).toBeInTheDocument();
  });

  it('deve exibir "Disponível" quando showPrice for false e o slot não estiver selecionado', () => {
    render(<SlotGrid slots={mockSlots} onSelect={vi.fn()} showPrice={false} />);
    expect(screen.getByText('08:00 – 09:00')).toBeInTheDocument();
    expect(screen.getByText('Disponível')).toBeInTheDocument();
  });

  it('deve exibir o preço em reais quando showPrice for true', () => {
    render(<SlotGrid slots={mockSlots} onSelect={vi.fn()} showPrice={true} />);
    expect(screen.getByText('08:00 – 09:00')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?100,00/)).toBeInTheDocument();
  });

  it('deve exibir o preço quando o slot estiver selecionado, mesmo com showPrice=false', () => {
    render(
      <SlotGrid 
        slots={mockSlots} 
        selectedSlotIds={['court1-2026-08-24-08:00']} 
        onSelect={vi.fn()} 
        showPrice={false} 
      />
    );
    expect(screen.getByText(/R\$\s?100,00/)).toBeInTheDocument();
  });

  it('deve disparar onSelect ao clicar em um horário livre', () => {
    const onSelectMock = vi.fn();
    render(<SlotGrid slots={mockSlots} onSelect={onSelectMock} showPrice={true} />);

    const freeSlotButton = screen.getByText('08:00 – 09:00').closest('button');
    expect(freeSlotButton).not.toBeNull();
    
    if (freeSlotButton) {
      fireEvent.click(freeSlotButton);
      expect(onSelectMock).toHaveBeenCalledTimes(1);
      expect(onSelectMock).toHaveBeenCalledWith(mockSlots[0]);
    }
  });

  it('deve exibir status de Ocupado e Encerrado para slots não disponíveis', () => {
    render(<SlotGrid slots={mockSlots} onSelect={vi.fn()} showPrice={true} />);
    expect(screen.getByText('Ocupado')).toBeInTheDocument();
    expect(screen.getByText('Encerrado')).toBeInTheDocument();
  });
});
