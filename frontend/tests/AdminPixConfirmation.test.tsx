import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AdminPagamentos } from '../src/screens/admin/AdminPagamentos';

vi.mock('react-router-dom', () => ({ useOutletContext: () => ({}) }));
const response = (body: unknown) => ({ ok: true, json: async () => body });

function setup(manual: boolean) {
  let paid = false;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/gateway/status/')) return response({ status_pagamento: paid ? 'Pago' : 'Parcial', transacao_status: paid ? 'Pago' : 'Pendente' });
    if (url.endsWith('/gateway/cobranca')) return response({ gateway_ref: manual ? 'PIX_ESTATICO_1' : '991', qr_code: 'data:image/png;base64,AA==', copia_cola: 'pix-code', manual_confirmation: manual });
    if (url === '/api/pagamentos') return response({ message: 'Pagamento registrado.' });
    if (url.includes('/pagamentos/reservas?')) return response([{ id: 1, cliente_nome: 'Cliente Pix', quadra_nome: 'Quadra 1', data_reserva: '2030-01-10', hora_inicio: '10:00', hora_fim: '11:00', valor_total: 10000, total_pago: 4000, saldo_devedor: 6000, metodos: 'Pix', status_pagamento: 'Parcial' }]);
    if (url.includes('/pagamentos/resumo')) return response({});
    return response([]);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<AdminPagamentos />);
  return { fetchMock, approve: () => { paid = true; } };
}

async function createPix() {
  await waitFor(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    expect(screen.getByLabelText('Valor a pagar *')).toHaveValue('60,00');
  });
  fireEvent.change(screen.getByLabelText('Método *'), { target: { value: 'Pix Online (Gateway)' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar Pagamento' }));
  await screen.findByAltText('Pix QR Code');
}

it('explains static Pix and only records it after staff confirms the bank receipt', async () => {
  const { fetchMock } = setup(true);
  await createPix();
  expect(screen.getByText(/Pix por chave, sem confirmação automática/)).toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/gateway/status/'))).toBe(false);
  expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/pagamentos')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Conferi no banco: registrar recebimento' }));
  await screen.findByText('Recebimento Pix registrado após conferência.');
});

it('keeps an existing partial payment from confirming a new Pix and closes after this charge is paid', async () => {
  const { fetchMock, approve } = setup(false);
  await createPix();
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/gateway/status/1?gateway_ref=991'))).toBe(true));
  expect(screen.getByAltText('Pix QR Code')).toBeInTheDocument();
  expect(screen.queryByText(/Pagamento parcial registrado no caixa/)).toBeNull();
  approve();
  await screen.findByText('Pagamento confirmado (Quitado) no caixa!', {}, { timeout: 6000 });
  expect(screen.queryByAltText('Pix QR Code')).toBeNull();
});
