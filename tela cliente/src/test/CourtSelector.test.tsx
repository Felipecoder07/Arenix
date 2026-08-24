import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CourtSelector from '../components/CourtSelector';
import type { Court } from '../types';

describe('CourtSelector Component (CourtSelector.tsx)', () => {
  const mockCourts: Court[] = [
    {
      id: '1',
      name: 'Quadra 1 - Areia Central',
      type: 'areia',
      pricePerHour: 90,
      surface: 'Areia',
      modalities: ['Beach Tennis', 'Vôlei de Praia'],
      sportPricing: [
        { nome: 'Beach Tennis', preco: 100 },
        { nome: 'Vôlei de Praia', preco: 80 }
      ]
    },
    {
      id: '2',
      name: 'Quadra 2 - Coberta',
      type: 'coberta',
      pricePerHour: 120,
      surface: 'Piso Rápido',
      modalities: ['Futevôlei'],
      sportPricing: [{ nome: 'Futevôlei', preco: 120 }]
    }
  ];

  const availableSports = ['Todos', 'Beach Tennis', 'Vôlei de Praia', 'Futevôlei'];

  it('deve renderizar os botões de filtros de esporte', () => {
    render(
      <CourtSelector
        courts={mockCourts}
        selectedId="1"
        onSelect={vi.fn()}
        selectedSport="Todos"
        availableSports={availableSports}
        onSelectSport={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Todos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beach Tennis' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vôlei de Praia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Futevôlei' })).toBeInTheDocument();
  });

  it('deve renderizar os cards de quadras com os nomes corretos', () => {
    render(
      <CourtSelector
        courts={mockCourts}
        selectedId="1"
        onSelect={vi.fn()}
        selectedSport="Todos"
        availableSports={availableSports}
        onSelectSport={vi.fn()}
      />
    );

    expect(screen.getByText('Quadra 1 - Areia Central')).toBeInTheDocument();
    expect(screen.getByText('Quadra 2 - Coberta')).toBeInTheDocument();
  });

  it('deve disparar onSelectSport ao clicar em um esporte da barra', () => {
    const onSelectSportMock = vi.fn();
    render(
      <CourtSelector
        courts={mockCourts}
        selectedId="1"
        onSelect={vi.fn()}
        selectedSport="Todos"
        availableSports={availableSports}
        onSelectSport={onSelectSportMock}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Beach Tennis' }));
    expect(onSelectSportMock).toHaveBeenCalledWith('Beach Tennis');
  });

  it('deve disparar onSelect com o ID da quadra ao clicar em um card', () => {
    const onSelectMock = vi.fn();
    render(
      <CourtSelector
        courts={mockCourts}
        selectedId="1"
        onSelect={onSelectMock}
        selectedSport="Todos"
        availableSports={availableSports}
        onSelectSport={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Quadra 2 - Coberta'));
    expect(onSelectMock).toHaveBeenCalledWith('2');
  });
});
