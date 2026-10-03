import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReauthenticationAction } from '../src/components/ReauthenticationAction';

describe('confirmação de operações sensíveis', () => {
  it.each([true, false])('limpa senha após resultado %s', async success => {
    const onConfirm = success ? vi.fn().mockResolvedValue(undefined) : vi.fn().mockRejectedValue(new Error('Senha incorreta.'));
    render(<ReauthenticationAction label="Confirmar operação" onConfirm={onConfirm} />);
    const button = screen.getByRole('button', { name: 'Confirmar operação' });
    expect(button).toBeDisabled();
    const password = screen.getByLabelText('Senha atual');
    expect(password).toHaveAttribute('type', 'password');
    fireEvent.change(password, { target: { value: 'FixturePassword123!' } });
    fireEvent.click(button);
    await waitFor(() => expect(password).toHaveValue(''));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({ senha_atual: 'FixturePassword123!' });
    if (!success) expect(screen.getByRole('alert')).toHaveTextContent('Senha incorreta.');
  });
});
