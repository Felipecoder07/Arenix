import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminConfiguracoesQuadras } from '../src/screens/admin/AdminConfiguracoesQuadras';

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

function setup(role = 'Administrador', success = true) {
  window.history.replaceState({}, '', '/admin/configuracoes?aba=usuarios');
  localStorage.setItem('courtmanager_user', JSON.stringify({ id: 1, perfil: role }));
  const users = [
    { id: 1, nome: 'Atual', perfil: role, ativo: 1 },
    { id: 2, nome: 'Destino', perfil: 'Gerente', ativo: 1 },
    { id: 3, nome: 'Inativo', perfil: 'Recepcionista', ativo: 0 },
    { id: 4, nome: 'Outro administrador', perfil: 'Administrador', ativo: 1 },
  ];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === 'POST') return { ok: success, status: success ? 200 : 403, json: async () => ({ error: 'Confirme sua senha atual para continuar.' }) };
    const data = url === '/api/auth/me' ? { usuario: users[0] }
      : url === '/api/usuarios' ? users
      : url === '/api/motivos/estatisticas' ? { mes: {}, ultimos30Dias: { porMotivo: [] } }
      : url === '/api/quadras' || url === '/api/usuarios/atividades' || url === '/api/motivos' ? [] : {};
    return { ok: true, status: 200, json: async () => data };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<AdminConfiguracoesQuadras />);
  return fetchMock;
}

async function openTransfer() {
  const button = await screen.findByRole('button', { name: 'Transferir administração' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  fireEvent.change(screen.getByLabelText('Novo Administrador'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Sua senha atual'), { target: { value: 'test-password' } });
}

it('transfers with password proof, excludes ineligible users and ends the local session', async () => {
  const fetchMock = setup();
  const expired = vi.fn();
  window.addEventListener('cm:session-expired', expired);
  try {
    await openTransfer();
    expect(screen.queryByRole('option', { name: /Inativo|Outro administrador/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar transferência' }));
    await waitFor(() => expect(expired).toHaveBeenCalledOnce());
    expect(localStorage.getItem('courtmanager_user')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/usuarios/transferir-administracao', expect.objectContaining({ method: 'POST', body: JSON.stringify({ usuario_id: 2, senha_atual: 'test-password' }) }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  } finally { window.removeEventListener('cm:session-expired', expired); }
});

it('keeps the session and allows retry after rejected password proof', async () => {
  setup('Administrador', false);
  await openTransfer();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar transferência' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Confirme sua senha atual');
  expect(localStorage.getItem('courtmanager_user')).not.toBeNull();
  expect(screen.getByLabelText('Sua senha atual')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Sua senha atual'), { target: { value: 'correct-password' } });
  expect(screen.getByRole('button', { name: 'Confirmar transferência' })).toBeEnabled();
});

it('does not enable ownership transfer for a manager', async () => {
  setup('Gerente');
  await screen.findByText('Destino');
  expect(screen.getByRole('button', { name: 'Transferir administração' })).toBeDisabled();
});
