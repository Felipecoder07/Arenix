import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { AdminArenaConfiguracoes } from '../src/screens/admin/AdminArenaConfiguracoes';

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.removeItem('grade_interval');
});

test('carrega e salva os dados da arena e o intervalo da grade', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === '/api/arenas/minha' && init?.method === 'PUT') {
      return { ok: true, json: async () => ({ message: 'Salvo' }) };
    }
    return { ok: true, json: async () => ({
      nome: 'Arena Original', endereco: 'Rua A', telefone: '11999999999',
      email: 'arena@example.test', fuso_horario: 'America/Sao_Paulo',
      foto_capa: '/uploads/capa.webp', status: 1,
    }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<AdminArenaConfiguracoes />);

  fireEvent.change(await screen.findByLabelText('Nome da arena *'), { target: { value: 'Arena Nova' } });
  fireEvent.change(screen.getByLabelText('Intervalo da grade de horários'), { target: { value: '30' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar configurações' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/arenas/minha', expect.objectContaining({
    method: 'PUT',
    body: JSON.stringify({
      nome: 'Arena Nova', endereco: 'Rua A', telefone: '11999999999',
      email: 'arena@example.test', fuso_horario: 'America/Sao_Paulo',
      foto_capa: '/uploads/capa.webp',
    }),
  })));
  expect(window.localStorage.getItem('grade_interval')).toBe('30');
  expect(await screen.findByText('Configurações da arena salvas com sucesso.')).toBeInTheDocument();
});

test('envia a nova foto de capa e mostra a prévia recebida da API', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === '/api/arenas/upload-capa' && init?.method === 'POST') {
      return { ok: true, json: async () => ({ foto_capa: '/uploads/nova-capa.webp' }) };
    }
    return { ok: true, json: async () => ({ nome: 'Arena Teste', status: 1 }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<AdminArenaConfiguracoes />);
  const input = await screen.findByLabelText(/Escolher nova foto/);
  fireEvent.change(input, { target: { files: [new File(['imagem'], 'capa.jpg', { type: 'image/jpeg' })] } });
  await waitFor(() => expect(screen.getByAltText('Prévia da capa da arena')).toHaveAttribute('src', '/uploads/nova-capa.webp'));
  expect(fetchMock).toHaveBeenCalledWith('/api/arenas/upload-capa', expect.objectContaining({ method: 'POST' }));
});
