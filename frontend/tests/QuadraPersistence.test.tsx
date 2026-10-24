import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminConfiguracoesQuadras } from '../src/screens/admin/AdminConfiguracoesQuadras';

const quadra = { id: 42, nome: 'Quadra existente', tipo: 'Areia', status: 'Inativa', preco_base: 125.5, modalidades: [{ nome: 'Beach Tennis', preco: 125.5 }] };
const response = (data: unknown, ok = true) => ({ ok, json: async () => data });
beforeEach(() => window.history.replaceState({}, '', '/admin/configuracoes?aba=quadras'));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('persistência de quadras', () => {
  it.each(['Nova quadra', 'Editar'])('permite limpar e redigitar o preço sem restaurar o valor ao abrir %s', async action => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => response(String(input) === '/api/quadras' ? [quadra] : {}));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminConfiguracoesQuadras />);
    await screen.findByText('Quadra existente');
    fireEvent.click(screen.getByRole('button', { name: action }));
    const input = screen.getByLabelText('Preço por hora de Beach Tennis');
    for (const value of ['', '0', '10abc', '1,2,3']) {
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
      expect(input).toHaveValue(value === '0' ? '0,00' : value);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      fireEvent.submit(input.closest('form')!);
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST' || init?.method === 'PUT')).toBe(false);
    }
    fireEvent.change(input, { target: { value: '' } });
    for (const [typed, displayed] of [['1', '0,01'], ['0,012', '0,12'], ['0,125', '1,25'], ['1,255', '12,55'], ['12,550', '125,50']]) {
      fireEvent.change(input, { target: { value: typed } });
      expect(input).toHaveValue(displayed);
    }
    expect(input).toHaveAttribute('aria-invalid', 'false');
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => {
      if (init?.method !== (action === 'Editar' ? 'PUT' : 'POST')) return false;
      const body = JSON.parse(String(init.body));
      return body.preco_base === 125.5 && body.modalidades[0].preco === 125.5;
    })).toBe(true));
  });

  it.each(['Nova quadra', 'Editar'])('bloqueia horários iguais ou invertidos ao abrir %s', async (action) => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => response(String(input) === '/api/quadras' ? [quadra] : {}));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminConfiguracoesQuadras />);
    await screen.findByText('Quadra existente');
    fireEvent.click(screen.getByRole('button', { name: action }));
    const opening = screen.getByLabelText('Horário de abertura: hora');
    const closing = screen.getByLabelText('Horário de fechamento: hora');
    const form = opening.closest('form')!;
    for (const hour of ['07', '06']) {
      fireEvent.change(closing, { target: { value: hour } });
      expect(screen.getByRole('alert')).toHaveTextContent('O fechamento deve ser depois da abertura.');
      fireEvent.submit(form);
    }
    expect(fetchMock.mock.calls.every(call => !(call[1] as RequestInit | undefined)?.method)).toBe(true);
    fireEvent.change(closing, { target: { value: '22' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['Basic', 3, 'Plano Basic: 1/3 quadras cadastradas'],
    ['Pro', 6, 'Plano Pro: 1/6 quadras cadastradas'],
    ['Enterprise', 0, 'Plano Enterprise: 1 (sem limite) quadras cadastradas'],
  ])('exibe o nome e limite reais do plano %s', async (nome, max_quadras, expected) => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => response(
      String(input) === '/api/quadras' ? [quadra] : String(input) === '/api/tenant/assinatura/plano'
        ? { plano: { nome, max_quadras, max_usuarios: 3 }, uso: { quadras_usadas: 1, usuarios_usados: 1 } } : {}
    )));
    render(<AdminConfiguracoesQuadras />);
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it('não inventa plano ou limite quando a consulta da assinatura falha', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input) === '/api/tenant/assinatura/plano'
      ? response({ error: 'Indisponível' }, false) : response(String(input) === '/api/quadras' ? [quadra] : {})));
    render(<AdminConfiguracoesQuadras />);
    expect(await screen.findByText('1 quadras cadastradas · Plano indisponível')).toBeInTheDocument();
    expect(screen.queryByText(/Plano Pro:/)).not.toBeInTheDocument();
  });

  it.each(['POST', 'PUT', 'DELETE'])('preserva lista e formulário quando %s é recusado', async (method) => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === method) return response({ error: 'Operação recusada pelo servidor.' }, false);
      return response(String(input) === '/api/quadras' ? [quadra] : {});
    }));
    render(<AdminConfiguracoesQuadras />);
    await screen.findByText('Quadra existente');
    fireEvent.click(screen.getByRole('button', { name: method === 'POST' ? 'Nova quadra' : 'Editar' }));
    const input = screen.getByPlaceholderText('Ex: Quadra 1, areia...');
    fireEvent.change(input, { target: { value: 'Nome alterado' } });
    if (method === 'DELETE') fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    else fireEvent.submit(input.closest('form')!);
    await screen.findByText('Operação recusada pelo servidor.');
    expect(input).toHaveValue('Nome alterado');
    expect(screen.getByText('Quadra existente')).toBeInTheDocument();
    expect(screen.queryByText(/com sucesso!/)).not.toBeInTheDocument();
  });

  it('preserva o formulário após falha de rede', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') throw new Error('Sem conexão');
      return response(String(input) === '/api/quadras' ? [quadra] : {});
    }));
    render(<AdminConfiguracoesQuadras />);
    await screen.findByText('Quadra existente');
    fireEvent.click(screen.getByRole('button', { name: 'Nova quadra' }));
    const input = screen.getByPlaceholderText('Ex: Quadra 1, areia...');
    fireEvent.submit(input.closest('form')!);
    await screen.findByText('Sem conexão');
    expect(input).toBeInTheDocument();
  });

  it('envia preços em reais e mantém o status ao editar', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => response(String(input) === '/api/quadras' ? [quadra] : {}));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminConfiguracoesQuadras />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    expect(screen.getByDisplayValue('125,50')).toBeInTheDocument();
    fireEvent.submit(screen.getByPlaceholderText('Ex: Quadra 1, areia...').closest('form')!);
    await screen.findByText('Quadra atualizada com sucesso!');
    expect(fetchMock).toHaveBeenCalledWith('/api/quadras/42', expect.objectContaining({
      method: 'PUT', body: expect.stringContaining('"preco_base":125.5'),
    }));
    expect(fetchMock).toHaveBeenCalledWith('/api/quadras/42', expect.objectContaining({
      body: expect.stringContaining('"status":"Inativa"'),
    }));
    expect(fetchMock).toHaveBeenCalledWith('/api/quadras/42', expect.objectContaining({
      body: expect.stringContaining('"preco":125.5'),
    }));
  });

  it('carrega o ID gerado pelo servidor depois de criar', async () => {
    let created = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') { created = true; return response({ id: 98 }); }
      return response(String(input) === '/api/quadras' ? (created ? [{ ...quadra, id: 98, nome: 'Quadra criada' }] : []) : {});
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminConfiguracoesQuadras />);
    await waitFor(() => expect(screen.queryByText('Carregando quadras...')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Nova quadra' }));
    const input = screen.getByPlaceholderText('Ex: Quadra 1, areia...');
    fireEvent.change(input, { target: { value: 'Quadra criada' } });
    fireEvent.submit(input.closest('form')!);
    await screen.findByText('Nova quadra cadastrada com sucesso!');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.submit(screen.getByPlaceholderText('Ex: Quadra 1, areia...').closest('form')!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/quadras/98', expect.objectContaining({ method: 'PUT' })));
  });
});
