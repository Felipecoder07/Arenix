import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdminDashboard } from '../src/screens/admin/AdminDashboard';

vi.mock('../src/utils/apiFetch', () => ({
  apiFetch: vi.fn(async (url: string) => ({
    ok: true,
    json: async () => url === '/api/dashboard/resumo'
      ? {
          hoje: '2026-09-30',
          faturamentoDia: 12500,
          faturamentoPendente: 7000,
          reservasPendentesDia: 1,
          reservasDia: 2,
          taxaOcupacao: 0,
          proximasReservas: [],
          alertas: [],
          quadrasStatus: [],
          faturamentoMes: 12500,
          inadimplentes: []
        }
      : { quadras: [], reservas: [], bloqueios: [] }
  }))
}));

describe('AdminDashboard', () => {
  it('exibe centavos em reais e conta apenas reservas com saldo pendente', async () => {
    render(<MemoryRouter><AdminDashboard /></MemoryRouter>);

    expect(await screen.findByText('R$ 70,00')).toBeInTheDocument();
    expect(screen.getByText('1 reserva(s) com saldo pendente hoje')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 125,00')).toHaveLength(2);
  });
});
