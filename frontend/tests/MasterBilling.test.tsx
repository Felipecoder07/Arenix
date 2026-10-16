import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { MasterFinanceiro } from '../src/screens/MasterFinanceiro';
import { formatDate } from '../src/data/mock';

vi.mock('../src/components/MasterRevenueChart', () => ({ MasterRevenueChart: () => null }));
afterEach(() => vi.unstubAllGlobals());

test('data de calendário mantém o dia e preserva meses curtos', () => {
  expect(formatDate('2026-10-10')).toBe('10/10/2026');
  expect(formatDate('2032-02-29')).toBe('29/02/2032');
  expect(formatDate(undefined)).toBe('—');
});

test('Financeiro usa tolerância e data do servidor para aviso e destaque', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.endsWith('/configuracoes') ? { dias_tolerancia_bloqueio: 2, data_faturamento: '2030-01-10' }
      : url.endsWith('/faturas') ? [
        { id: 1, arena_nome: 'No limite', plano_nome: 'Pro', valor: 100, status: 'Atrasada', data_vencimento: '2030-01-08' },
        { id: 2, arena_nome: 'Além do limite', plano_nome: 'Pro', valor: 100, status: 'Atrasada', data_vencimento: '2030-01-07' }
      ] : url.endsWith('/planos') ? [] : {};
    return { ok: true, json: async () => body };
  }));
  render(<MasterFinanceiro />);
  await screen.findByText('mais de 2 dias');
  expect(screen.getByRole('button', { name: /Ver faturas para pagamento/ })).toBeInTheDocument();
  expect(screen.getByText('No limite').closest('tr')).not.toHaveClass('bg-danger-soft/40');
  expect(screen.getByText('Além do limite').closest('tr')).toHaveClass('bg-danger-soft/40');
  expect(screen.getByText('08/01/2030')).toBeInTheDocument();
});

test('falha ao carregar política não apresenta prazo inventado', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => ({
    ok: !String(input).endsWith('/configuracoes'),
    json: async () => String(input).endsWith('/metrics') ? {} : [],
  })));
  render(<MasterFinanceiro />);
  await waitFor(() => expect(screen.queryByText('Carregando faturas...')).not.toBeInTheDocument());
  expect(screen.getByText(/Prazo de bloqueio indisponível/)).toBeInTheDocument();
});
