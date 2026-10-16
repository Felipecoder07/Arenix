import { fireEvent, render, screen, cleanup, within, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { AdminAssinatura } from '../src/screens/admin/AdminAssinatura';

vi.mock('react-router-dom', () => ({ useOutletContext: () => ({}) }));
vi.mock('../src/components/ArenaPortalButton', () => ({ ArenaPortalButton: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('falha no catálogo impede contratação e nova tentativa usa os dados reais', async () => {
  let failed = true;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/planos-disponiveis')) return {
      ok: !failed,
      json: async () => [{ id: 42, nome: 'Plano Servidor', valor_mensal: 123, valor_anual: 101, max_quadras: 7, max_usuarios: 9 }],
    };
    return { ok: true, json: async () => url.endsWith('/plano') ? {
      arena_id: 1, arena_nome: 'Arena', arena_status: 1, dia_vencimento: 10,
      trial_expira_em: null, em_trial: false, ciclo_cobranca: 'mensal',
      plano: { id: 1, nome: 'Inicial', valor_mensal: 50, max_quadras: 2, max_usuarios: 3 },
      uso: { quadras_usadas: 1, usuarios_usados: 1 }, fatura_atual: null,
    } : [] };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<AdminAssinatura />);
  fireEvent.click(await screen.findByRole('button', { name: /Trocar plano/ }));
  await screen.findByRole('alert');
  expect(screen.queryByText('Basic')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Selecionar plano' })).not.toBeInTheDocument();
  expect(screen.queryByText(/ATIVAÇÃO IMEDIATA/)).not.toBeInTheDocument();
  failed = false;
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await screen.findByText('Plano Servidor');
  expect(screen.getByText('Até 7 quadras')).toBeInTheDocument();
  expect(screen.getByText('Até 9 usuários')).toBeInTheDocument();
  expect(screen.queryByText('-20%')).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('solicitar-upgrade'))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Anual 12 meses' }));
  fireEvent.click(screen.getByRole('button', { name: 'Selecionar plano' }));
  const confirmation = within(screen.getByRole('region', { name: 'Confirmar troca de plano' }));
  expect(confirmation.getByText(/Plano atual: Inicial/)).toBeInTheDocument();
  expect(confirmation.getByText(/Plano escolhido: Plano Servidor/)).toBeInTheDocument();
  expect(confirmation.getByText(/1.212,00/)).toBeInTheDocument();
  expect(confirmation.getByText(/após a confirmação do pagamento/)).toBeInTheDocument();
  expect(confirmation.getByText(/sem desconto proporcional/)).toBeInTheDocument();
  expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('solicitar-upgrade'))).toBe(true);
});

test('confirma o total em centavos e atualiza limites somente após o pagamento', async () => {
  let paid = false;
  const post = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    let body: unknown = [];
    if (url.endsWith('/plano')) body = {
      arena_id: 1, arena_nome: 'Arena', arena_status: 1, dia_vencimento: 10,
      trial_expira_em: null, em_trial: false, ciclo_cobranca: 'mensal',
      plano: { id: paid ? 2 : 1, nome: paid ? 'Maior' : 'Inicial', valor_mensal: paid ? 123 : 50, max_quadras: paid ? 7 : 2, max_usuarios: paid ? 9 : 3 },
      uso: { quadras_usadas: 1, usuarios_usados: 1 }, fatura_atual: null,
    };
    if (url.endsWith('/planos-disponiveis')) body = [{ id: 2, nome: 'Maior', valor_mensal: 123, valor_anual: 101, max_quadras: 7, max_usuarios: 9 }];
    if (url.endsWith('/solicitar-upgrade')) {
      post(JSON.parse(String(init?.body)));
      body = { fatura_id: 5, valor: 123, plano_nome: 'Maior', pix: { gateway_ref: '123', copia_cola: 'pix', expira_em: '2099-01-01' } };
    }
    if (url.includes('/status-pagamento/')) { paid = true; body = { pago: true }; }
    return { ok: true, json: async () => body };
  }));
  render(<AdminAssinatura />);
  fireEvent.click(await screen.findByRole('button', { name: /Trocar plano/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Selecionar plano' }));
  expect(post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar e gerar Pix' }));
  await waitFor(() => expect(post).toHaveBeenCalledWith({ plano_id: 2, ciclo: 'mensal', valor_confirmado_centavos: 12300 }));
  await screen.findByText('Plano Inicial');
  await screen.findByText('Pagamento Confirmado!', {}, { timeout: 6000 });
  await screen.findByText('Plano Maior');
});
