import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { AdminAssinatura } from '../src/screens/admin/AdminAssinatura';

vi.mock('react-router-dom', () => ({ useOutletContext: () => ({}) }));
vi.mock('../src/components/ArenaPortalButton', () => ({ ArenaPortalButton: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const oldInvoice = { id: 1, valor: 49.99, status: 'Pendente', data_vencimento: '2026-08-10', plano_nome: 'Plano da fatura', competencia: '10/08/2026 a 10/09/2026' };
function setup(invoices: object[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.endsWith('/plano') ? {
      arena_id: 1, arena_nome: 'Arena', arena_status: 1, dia_vencimento: 10,
      trial_expira_em: null, em_trial: false, ciclo_cobranca: 'mensal', proximo_vencimento: '2026-08-10',
      plano: { id: 2, nome: 'Plano atual diferente', valor_mensal: 90, max_quadras: 7, max_usuarios: 9 },
      uso: { quadras_usadas: 1, usuarios_usados: 1 }, fatura_atual: null,
    } : url.endsWith('/faturas') ? invoices : url.endsWith('/gerar-pix') ? {
      gateway_ref: '123', copia_cola: 'pix-test', expira_em: '2099-01-01',
    } : [];
    return { ok: true, json: async () => body };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<AdminAssinatura />);
  return fetchMock;
}

test('cartão reúne valor, data, plano e pagamento da mesma pendência mais antiga', async () => {
  const fetchMock = setup([
    { ...oldInvoice, id: 2, valor: 767.88, data_vencimento: '2027-01-10', plano_nome: 'Pro', competencia: '10/01/2027 a 10/01/2028' },
    oldInvoice,
  ]);
  const label = await screen.findByText('FATURA ATUAL');
  const card = within(label.closest('[data-pencil-name="Fatura Atual Compacta"]') as HTMLElement);
  expect(card.getByText(/49,99/)).toBeInTheDocument();
  expect(card.getByText('Vencimento: 10/08/2026 · Plano Plano da fatura')).toBeInTheDocument();
  expect(card.queryByText(/767,88/)).not.toBeInTheDocument();
  fireEvent.click(card.getByRole('button', { name: 'Pagar Fatura com Pix' }));
  await screen.findByText('Aguardando confirmação do pagamento em tempo real...');
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/faturas/1/gerar-pix'))).toBe(true);
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/adiantar-fatura'))).toBe(false);
  expect(screen.queryByText(/4.999,00/)).not.toBeInTheDocument();
});

test.each([{ invoices: [] }, { invoices: [{ ...oldInvoice, status: 'Paga' }] }])('sem pendências não oferece pagamento de uma fatura paga', async ({ invoices }) => {
  setup(invoices);
  await screen.findByText('Sem pendências');
  expect(screen.queryByRole('button', { name: 'Pagar Fatura com Pix' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Adiantar Mensalidade com Pix' })).toBeInTheDocument();
  if (!invoices.length) {
    expect(screen.getByText('Nenhuma fatura emitida.')).toBeInTheDocument();
    expect(screen.queryByText('Trial ativo')).not.toBeInTheDocument();
  }
});
