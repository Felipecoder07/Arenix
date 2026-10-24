import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AdminPagamentos } from '../src/screens/admin/AdminPagamentos';

vi.mock('react-router-dom', () => ({ useOutletContext: () => ({}) }));
const reservation = { id: 1, cliente_nome: 'Cliente Pix', quadra_nome: 'Quadra 1', data_reserva: '2030-01-10', hora_inicio: '10:00', hora_fim: '11:00', valor_total: 10000, total_pago: 10000, saldo_devedor: 0, metodos: 'Pix Online', status_pagamento: 'Cancelado (Pendente Estorno)' };
const quote = { online: true, valor_centavos: 20000, confirmacao: 'confirmed-scope', reservas: [{ id: 1, data: '2030-01-10', inicio: '10:00', fim: '11:00' }, { id: 2, data: '2030-01-10', inicio: '11:00', fim: '12:00' }] };
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

function setup({ pending = false, quoteError = false, manual = false, outstanding = false, refunded = false } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/pagamentos/estorno') return response({ pending, message: pending ? 'Devolucao pendente de confirmacao do Mercado Pago.' : 'Devolucao confirmada pelo Mercado Pago.' }, pending ? 202 : 200);
    if (url.endsWith('/1/estorno')) return quoteError ? response({ error: 'Concilie o recebimento antes de devolver.' }, 409) : response({ ...quote, online: !manual });
    if (url.endsWith('/reserva/1')) return response([
      { id: 11, reserva_id: 1, valor: 10000, metodo: manual ? 'Pix' : 'Pix Online', registrado_em: '2030-01-10T10:00:00Z' },
      ...(refunded ? [{ id: 12, reserva_id: 1, valor: -2000, metodo: 'Estorno', registrado_em: '2030-01-10T11:00:00Z' }] : []),
    ]);
    if (url.startsWith('/api/pagamentos/reservas?')) return response([outstanding ? { ...reservation, total_pago: 4000, saldo_devedor: 6000, status_pagamento: 'Parcial' } : reservation]);
    if (url.startsWith('/api/pagamentos/resumo')) return response({ recebidoHoje: 5992, recebidoMes: 5992, totalInadimplencia: 12014, qtdInadimplentes: 8 });
    if (init?.method === 'POST') throw new Error('Unexpected POST');
    return response([]);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<AdminPagamentos />);
  return fetchMock;
}

async function openRefund() {
  // The initial debounced list refresh can replace the row between findBy and click.
  await waitFor(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Estornar' }));
    expect(screen.getByText('Estornar Pagamento')).toBeInTheDocument();
  });
}

it('allows refunding a pending cancellation, shows grouped amount and sends reais plus confirmation', async () => {
  const fetchMock = setup();
  await openRefund();
  const input = await screen.findByDisplayValue('200,00');
  expect(input).toHaveAttribute('readonly');
  expect(screen.getByText(/Horários envolvidos:/)).toHaveTextContent('#2');
  fireEvent.change(screen.getByLabelText(/Justificativa do Estorno/), { target: { value: 'Pedido do cliente' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar Estorno' }));
  await screen.findByText('Devolucao confirmada pelo Mercado Pago.');
  const call = fetchMock.mock.calls.find(([url]) => url === '/api/pagamentos/estorno');
  expect(JSON.parse(String(call?.[1]?.body))).toEqual({ reserva_id: 1, valor: 200, confirmacao: 'confirmed-scope', motivo: 'Pedido do cliente' });
});

it('keeps the pending result visible instead of reporting success', async () => {
  setup({ pending: true });
  await openRefund();
  await screen.findByDisplayValue('200,00', {}, { timeout: 5000 });
  fireEvent.change(screen.getByLabelText(/Justificativa do Estorno/), { target: { value: 'Pedido do cliente' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar Estorno' }));
  await screen.findByText('Devolucao pendente de confirmacao do Mercado Pago.');
  expect(screen.getByRole('button', { name: 'Confirmar Estorno' })).toBeEnabled();
  expect(screen.getByDisplayValue('200,00')).toBeInTheDocument();
  expect(screen.queryByText('Devolucao confirmada pelo Mercado Pago.')).not.toBeInTheDocument();
});

it('blocks submission when the refundable balance cannot be checked', async () => {
  const fetchMock = setup({ quoteError: true });
  await openRefund();
  await screen.findByRole('alert', {}, { timeout: 5000 });
  expect(screen.getByRole('button', { name: 'Confirmar Estorno' })).toBeDisabled();
  expect(fetchMock.mock.calls.some(([url]) => url === '/api/pagamentos/estorno')).toBe(false);
});

it('converts manual payment history from centavos to reais', async () => {
  setup({ manual: true });
  await openRefund();
  await waitFor(() => expect(screen.getByLabelText('Valor a estornar *')).toHaveValue('100,00'));
  expect(screen.getByLabelText('Valor a estornar *')).not.toHaveAttribute('readonly');
});

it('displays API centavos as reais in the summary and booking list', async () => {
  setup();
  await screen.findByText('Cliente Pix');
  const monthly = document.querySelector('[data-pencil-name="Valor Recebido no mês"]');
  const overdue = document.querySelector('[data-pencil-name="Valor Inadimplência"]');
  expect(monthly?.textContent?.replace(/\s/g, ' ')).toBe('R$ 59,92');
  expect(overdue?.textContent?.replace(/\s/g, ' ')).toBe('R$ 120,14');
  expect(screen.getAllByText(/R\$\s100,00/).length).toBeGreaterThan(0);
});

it('prefills the manual payment with the remaining balance in reais', async () => {
  setup({ outstanding: true });
  await waitFor(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    expect(screen.getByDisplayValue('60,00')).toBeInTheDocument();
  });
});

it('deducts prior refunds from the suggested manual refund', async () => {
  setup({ manual: true, refunded: true });
  await openRefund();
  await waitFor(() => expect(screen.getByLabelText('Valor a estornar *')).toHaveValue('80,00'));
});
