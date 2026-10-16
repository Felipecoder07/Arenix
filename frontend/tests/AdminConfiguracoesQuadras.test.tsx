import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminConfiguracoesQuadras } from '../src/screens/admin/AdminConfiguracoesQuadras';

const quadra = {
  id: 42,
  nome: 'Quadra teste',
  tipo: 'Areia',
  status: 'Ativa',
  preco_base: 100,
  modalidades: ['Beach Tennis'],
};

afterEach(() => vi.unstubAllGlobals());

describe('status da quadra', () => {
  it('desativa e reativa usando PATCH e mantém o estado retornado pela operação', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/quadras') {
        return { ok: true, json: async () => [quadra] };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminConfiguracoesQuadras />);

    fireEvent.click(await screen.findByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/quadras/42/status',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'Inativa' }) }),
    ));
    fireEvent.click(await screen.findByRole('button', { name: 'Ativar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/quadras/42/status',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'Ativa' }) }),
    ));
  });

  it('preserva o estado e mostra o erro quando a API rejeita a alteração', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) =>
      String(input) === '/api/quadras'
        ? { ok: true, json: async () => [quadra] }
        : { ok: false, json: async () => ({ error: 'Limite do plano atingido.' }) },
    ));
    render(<AdminConfiguracoesQuadras />);

    fireEvent.click(await screen.findByRole('button', { name: 'Desativar' }));
    await screen.findByText('Limite do plano atingido.');
    expect(screen.getByRole('button', { name: 'Desativar' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Ativar' })).not.toBeInTheDocument();
  });

  it('não inventa quadras quando a API retorna uma lista vazia', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
    render(<AdminConfiguracoesQuadras />);
    await waitFor(() => expect(screen.queryByText('Carregando quadras...')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ativar' })).not.toBeInTheDocument();
  });
});

describe('aba de notificações', () => {
  it('abre o sino com comunicados ativos e fecha pelo botão', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () => String(input) === '/api/auth/comunicados/ativos'
        ? [{ id: 7, message: 'Manutenção programada', audience: 'arenas', audienceLabel: 'Arenas', channel: 'alerta', createdAt: '2026-10-01' }]
        : String(input) === '/api/quadras' ? [] : {},
    })));
    window.history.pushState({}, '', '/admin/configuracoes?aba=notificacoes');

    render(<AdminConfiguracoesQuadras />);

    const sino = screen.getByRole('button', { name: 'Abrir notificações' });
    fireEvent.click(sino);
    expect(await screen.findByText('Manutenção programada')).toBeVisible();
    expect(sino).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar notificações' }));
    expect(screen.queryByText('Manutenção programada')).not.toBeInTheDocument();
  });

  it('mostra erro e permite tentar novamente sem exibir preferências presumidas', async () => {
    let unavailable = true;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/arenas/minha') {
        return unavailable
          ? { ok: false, json: async () => ({}) }
          : { ok: true, json: async () => ({ notif_reserva_email: 0, notif_cancelamento_email: 0, notif_pagamento_email: 0, alerta_pagamento_minutos: 45 }) };
      }
      return { ok: true, json: async () => [] };
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/admin/configuracoes?aba=notificacoes');

    render(<AdminConfiguracoesQuadras />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as preferências de notificações.');
    expect(screen.queryByRole('button', { name: /Salvar notificações/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/automações ativas/)).not.toBeInTheDocument();

    unavailable = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('0 automações ativas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Salvar notificações/i })).toBeEnabled();
  });

  it('renderiza canais, automações e salva preferências via PUT /api/arenas/minha', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/arenas/minha') {
        if (init?.method === 'PUT') {
          return { ok: true, json: async () => ({ message: 'Dados da arena atualizados com sucesso.' }) };
        }
        return {
          ok: true,
          json: async () => ({
            notif_reserva_email: 1,
            notif_cancelamento_email: 1,
            notif_pagamento_email: 1,
            alerta_pagamento_minutos: 30,
          }),
        };
      }
      if (url === '/api/quadras') {
        return { ok: true, json: async () => [] };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    // Definir URL inicial com query param aba=notificacoes
    window.history.pushState({}, '', '/admin/configuracoes?aba=notificacoes');

    render(<AdminConfiguracoesQuadras />);

    // Verificar cabeçalho da aba de notificações
    expect(await screen.findByRole('heading', { level: 2, name: 'Notificações' })).toBeInTheDocument();
    expect(screen.getByText('3 automações ativas')).toBeInTheDocument();

    // Canais
    const panel = within(document.querySelector('[data-pencil-name="Painel Configurações Notificações"]') as HTMLElement);
    expect(panel.getByText('E-mail')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    // Automações
    expect(screen.getByText('Confirmação de reserva por e-mail')).toBeInTheDocument();
    expect(screen.getByText('Cancelamento por e-mail')).toBeInTheDocument();
    expect(screen.getByText('Comprovante de pagamento')).toBeInTheDocument();
    expect(screen.getByText('Compartilhamento por WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Alerta de pagamento pendente')).toBeInTheDocument();

    // Testar toggle switch (desligar cancelamento)
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(3);
    fireEvent.click(switches[1]); // Desliga cancelamento

    // O contador de automações ativas deve mudar para 2
    expect(await screen.findByText('2 automações ativas')).toBeInTheDocument();

    // Salvar configurações
    const salvarBtn = screen.getByRole('button', { name: /Salvar notificações/i });
    fireEvent.click(salvarBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/arenas/minha',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            notif_reserva_email: 1,
            notif_cancelamento_email: 0,
            notif_pagamento_email: 1,
            alerta_pagamento_minutos: 30,
          }),
        })
      );
    });
  });
});
