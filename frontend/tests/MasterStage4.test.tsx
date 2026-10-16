import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { MasterComunicacao } from '../src/screens/MasterComunicacao';
import { MasterUsuarios } from '../src/screens/MasterUsuarios';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test('agendar exige horário futuro e transmite o instante com fuso', async () => {
  const writes: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch',vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method==='POST') {
      writes.push(JSON.parse(String(init.body)));
      return {ok:true,json:async()=>({agendado:true})};
    }
    return {ok:true,json:async()=>[]};
  }));
  render(<MasterComunicacao />);
  fireEvent.change(await screen.findByLabelText('Quando enviar'),{target:{value:'later'}});
  fireEvent.change(screen.getByPlaceholderText('Escreva o comunicado que todas as arenas receberão...'),{target:{value:'Agendado'}});
  fireEvent.click(screen.getByRole('button',{name:'Agendar envio'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('data e hora futuras');
  expect(writes).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Data e hora do envio (horário local)'),{target:{value:'2099-03-10T14:30'}});
  fireEvent.click(screen.getByRole('button',{name:'Agendar envio'}));
  await waitFor(()=>expect(writes).toHaveLength(1));
  expect(writes[0].scheduledAt).toBe(new Date('2099-03-10T14:30').toISOString());
  expect(await screen.findByText('Comunicado agendado.')).toBeInTheDocument();
});

test('recuperação promete link por e-mail, sem senha padrão ou temporária',async () => {
  vi.stubGlobal('fetch',vi.fn(async (input: RequestInfo | URL) => ({ok:true,json:async()=>String(input).endsWith('/usuarios')
    ? [{id:1,nome:'Gestor',email:'gestor@example.test',role:'Administrador',ativo:1,arenaId:1,arenaName:'Arena'}] : []})));
  render(<MasterUsuarios />);
  fireEvent.click(await screen.findByTitle('Resetar senha'));
  expect(screen.getByText(/Um link individual será enviado/)).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Enviar link por e-mail'})).toBeInTheDocument();
  expect(screen.queryByText(/arena123|Gerar senha temporária/)).not.toBeInTheDocument();
});
