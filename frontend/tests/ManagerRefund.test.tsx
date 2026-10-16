import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AdminPagamentos } from '../src/screens/admin/AdminPagamentos';

vi.mock('react-router-dom', () => ({ useOutletContext: () => ({}) }));
const reservation = { id: 1, cliente_nome: 'Cliente Pix', quadra_nome: 'Quadra 1', data_reserva: '2030-01-10', hora_inicio: '10:00', hora_fim: '11:00', valor_total: 100, total_pago: 100, saldo_devedor: 0, metodos: 'Pix Online', status_pagamento: 'Cancelado (Pendente Estorno)' };
const quote = { online: true, valor_centavos: 20000, confirmacao: 'confirmed-scope', reservas: [{ id: 1, data: '2030-01-10', inicio: '10:00', fim: '11:00' }, { id: 2, data: '2030-01-10', inicio: '11:00', fim: '12:00' }] };
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

function setup({ pending = false, quoteError = false, manual = false } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/pagamentos/estorno') return response({ pending, message: pending ? 'Devolucao pendente de confirmacao do Mercado Pago.' : 'Devolucao confirmada pelo Mercado Pago.' }, pending ? 202 : 200);
    if (url.endsWith('/1/estorno')) return quoteError ? response({ error: 'Concilie o recebimento antes de devolver.' }, 409) : response({ ...quote, online: !manual });
    if (url.endsWith('/reserva/1')) return response([{ id: 11, reserva_id: 1, valor: 10000, metodo: manual ? 'Pix' : 'Pix Online', registrado_em: '2030-01-10T10:00:00Z' }]);
    if (url.startsWith('/api/pagamentos/reservas?')) return response([reservation]);
    if (url.startsWith('/api/pagamentos/resumo')) return response({});
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
