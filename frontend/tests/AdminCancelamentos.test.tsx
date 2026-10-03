import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { AdminConfiguracoesQuadras } from '../src/screens/admin/AdminConfiguracoesQuadras';

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

test('aba de cancelamentos mostra contagens e valores recebidos da API', async () => {
  window.history.replaceState({}, '', '/admin/configuracoes?aba=cancelamentos');
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url === '/api/quadras' ? []
      : url === '/api/motivos' ? [
        { id: -1, motivo: 'Desistência do Cliente' },
        { id: -2, motivo: 'Condições Climáticas' },
      ]
      : url === '/api/motivos/estatisticas' ? {
        mes: { total: 3, valorTotal: 150 },
        ultimos30Dias: {
          total: 4,
          porMotivo: [
            { id: -1, motivo: 'Desistência do Cliente', total: 2 },
            { id: null, motivo: 'Cancelamento pelo cliente', total: 2 },
          ],
        },
      } : {};
    return { ok: true, json: async () => body };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<AdminConfiguracoesQuadras />);

  await waitFor(() => expect(document.querySelector('[data-pencil-name="Valor resumo motivos ativos"]')).toHaveTextContent('2'));
  expect(document.querySelector('[data-pencil-name="Valor resumo cancelamentos no mês"]')).toHaveTextContent('3');
  expect(document.querySelector('[data-pencil-name="Valor resumo por desistência"]')).toHaveTextContent('50%');
  expect(document.querySelector('[data-pencil-name="Valor impacto receita afetada"]')).toHaveTextContent('R$ 150,00');
  expect(document.querySelector('[data-pencil-name="Total distribuição"]')).toHaveTextContent('4 cancelamentos');
  expect(screen.getByText('Outros ou sem motivo')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/motivos/estatisticas', expect.anything());
});
