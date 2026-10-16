import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PixRecovery } from '../src/components/PixRecovery';

const api = vi.hoisted(() => vi.fn());
vi.mock('../src/utils/apiFetch', () => ({ apiFetch: api }));
afterEach(() => { cleanup(); api.mockReset(); });
const mount = () => render(<PixRecovery recovery={{ url: '/existing-pix', issue: { error: 'Em verificação', reference: 'safe-reference' } }} onClose={() => {}} />);
const result = (body: unknown) => ({ ok: true, json: async () => body });

it('explains legacy review instead of telling the user to wait indefinitely', async () => {
  mount();
  api.mockResolvedValueOnce(result({ payment_state: 'unknown', payment_error: {
    error: 'Confira a cobrança antiga com o responsável financeiro.', next_action: 'contact_support',
  } }));
  fireEvent.click(screen.getByText('Consultar pagamento'));
  await screen.findByText('Confira a cobrança antiga com o responsável financeiro.');
  expect(screen.getByText('Consultar após conferência')).toBeInTheDocument();
  expect(screen.queryByText('Copiar Pix')).toBeNull();
  expect(screen.getByText(/Informe a referência abaixo/)).toBeInTheDocument();
});

it('queries the existing payment only after an explicit click and preserves QR during a transient failure', async () => {
  mount();
  expect(api).not.toHaveBeenCalled();
  api.mockResolvedValueOnce(result({ pix: { copia_cola: 'code', qr_code: 'data:image/png;base64,AA==', expira_em: '2099-01-01' } }));
  fireEvent.click(screen.getByText('Consultar pagamento'));
  await screen.findByAltText('QR Code Pix recuperado');
  expect(api).toHaveBeenCalledWith('/existing-pix');
  api.mockRejectedValueOnce(new Error('Falha temporária'));
  fireEvent.click(screen.getByText('Consultar pagamento'));
  await screen.findByText('Falha temporária');
  expect(screen.getByAltText('QR Code Pix recuperado')).toBeTruthy();
  api.mockResolvedValueOnce(result({ status_pagamento: 'Pago' }));
  fireEvent.click(screen.getByText('Consultar pagamento'));
  await screen.findByText(/Pagamento confirmado/);
  expect(screen.queryByAltText('QR Code Pix recuperado')).toBeNull();
});

it('does not offer an expired QR for copying', async () => {
  api.mockResolvedValueOnce(result({ pix: { copia_cola: 'code', expira_em: '2000-01-01' } }));
  mount();
  fireEvent.click(screen.getByText('Consultar pagamento'));
  await screen.findByText(/Este QR expirou/);
  expect(screen.queryByText('Copiar Pix')).toBeNull();
});

it('blocks concurrent queries and handles definitive refusal', async () => {
  let complete!: (value: unknown) => void;
  api.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
  mount();
  fireEvent.click(screen.getByText('Consultar pagamento'));
  fireEvent.click(screen.getByText('Consultando…'));
  expect(api).toHaveBeenCalledTimes(1);
  complete(result({ payment_state: 'failed' }));
  await waitFor(() => expect(screen.getByText(/Esta cobrança foi encerrada/)).toBeTruthy());
});
