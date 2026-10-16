import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { MasterArenaDetalhe } from '../src/screens/MasterArenaDetalhe';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test.each([true, false])('salva dados e plano em uma requisição; sucesso=%s', async success => {
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  const writes: Array<{ url: string; body: Record<string, unknown> }> = [];
  const arena = { id: 1, nome: 'Arena A', email: 'a@example.test', telefone: '', endereco: '', plano_id: 1,
    plano_nome: 'Basic', dia_vencimento: 17, status: 1, quadras: 1, usuarios: [], administradores: [], logs: [] };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (options?.method === 'PUT' || options?.method === 'PATCH') {
      writes.push({ url, body: JSON.parse(String(options.body)) });
      return { ok: success, json: async () => ({ error: 'Plano excede o limite.' }) };
    }
    const body = url.endsWith('/planos') ? [
      { id: 1, nome: 'Basic', valor_mensal: 100 }, { id: 2, nome: 'Pro', valor_mensal: 200 }
    ] : url.endsWith('/faturas') ? [] : arena;
    return { ok: true, json: async () => body };
  }));
  render(<MemoryRouter initialEntries={['/?id=1']}><MasterArenaDetalhe onNavigate={() => {}} /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
  fireEvent.change(screen.getByDisplayValue('Arena A'), { target: { value: 'Novo nome' } });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toMatchObject({ url: '/api/saas/arenas/1', body: { nome: 'Novo nome', plano_id: 2, dia_vencimento: 17 } });
  if (!success) {
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Plano excede o limite.'));
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Novo nome')).toBeInTheDocument();
  } else {
    await screen.findByRole('button', { name: 'Editar' });
  }
  expect(writes).toHaveLength(1);
});
