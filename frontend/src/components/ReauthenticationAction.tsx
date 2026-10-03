import { useState } from 'react';

export function ReauthenticationAction({ label, onConfirm }: {
  label: string;
  onConfirm: (proof: { senha_atual: string }) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
    <label>Senha atual
      <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
    </label>
    {error && <p role="alert">{error}</p>}
    <button type="button" className="btn-primary" disabled={busy || !password} onClick={async () => {
      setBusy(true); setError('');
      try { await onConfirm({ senha_atual: password }); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível concluir a operação.'); }
      finally { setPassword(''); setBusy(false); }
    }}>{busy ? 'Confirmando…' : label}</button>
  </div>;
}
