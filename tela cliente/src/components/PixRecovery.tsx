import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/apiFetch';

export interface PixIssue { error?: string; reference?: string; next_action?: string }
interface Recovery { issue: PixIssue; url: string }
interface Pix { copia_cola: string; qr_code?: string; expira_em?: string; manual_confirmation?: boolean }

export function PixRecovery({ recovery, onClose }: Readonly<{ recovery: Recovery; onClose: () => void }>) {
  const [message, setMessage] = useState(recovery.issue.error || 'A cobrança está em verificação. Consulte o pagamento.');
  const [busy, setBusy] = useState(false);
  const [pix, setPix] = useState<Pix | null>(null);
  const [expired, setExpired] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (!pix?.expira_em) return;
    const check = () => setExpired(!Number.isFinite(Date.parse(pix.expira_em!)) || Date.parse(pix.expira_em!) <= Date.now());
    check();
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [pix]);
  const consult = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await apiFetch(recovery.url);
      const body = await response.json();
      if (!active.current) return;
      if (!response.ok) throw new Error(body.error || 'Não foi possível consultar. Tente consultar novamente.');
      if (body.pago || body.status_pagamento === 'Pago') {
        setPix(null);
        setMessage('Pagamento confirmado. Você já pode fechar esta consulta.');
      } else if (['failed', 'refunded', 'cancelled'].includes(body.payment_state) || ['Cancelada', 'Cancelamento pendente'].includes(body.status)) {
        setPix(null);
        setMessage(body.payment_error?.error || 'Esta cobrança foi encerrada. Confira a situação com a arena antes de pagar.');
      } else {
        const available = body.pix || (body.copia_cola ? body : null);
        if (available) { setPix(available); setExpired(false); }
        setMessage(available ? 'Cobrança recuperada. O pagamento ainda não foi confirmado.'
          : body.payment_error?.error || 'A cobrança continua em verificação. Aguarde e consulte novamente.');
      }
    } catch (error) {
      if (active.current) setMessage(error instanceof Error ? error.message : 'Falha na consulta. Tente consultar novamente.');
      // A transient lookup failure must not discard a previously verified QR.
    } finally { if (active.current) setBusy(false); }
  };
  return <section aria-label="Acompanhar pagamento Pix" role="status" style={{ position: 'fixed', zIndex: 1000000, bottom: 24, right: 24,
    maxWidth: 380, maxHeight: '85vh', overflow: 'auto', padding: 20, borderRadius: 16, background: '#fff', color: '#152536', boxShadow: '0 8px 40px #0003' }}>
    <h2 style={{ fontSize: 18, fontWeight: 700 }}>Acompanhar pagamento Pix</h2>
    <p>{message}</p>
    {recovery.issue.reference && <p style={{ fontSize: 12 }}>Referência para atendimento: {recovery.issue.reference}</p>}
    {pix && expired && <p>Este QR expirou. Consulte a situação antes de pagar.</p>}
    {pix && !expired && <>
      {pix.qr_code && <img src={pix.qr_code} alt="QR Code Pix recuperado" width={180} height={180} />}
      {pix.manual_confirmation && <p>A arena precisa confirmar o recebimento manualmente.</p>}
      <button type="button" onClick={() => { void (navigator.clipboard?.writeText(pix.copia_cola) || Promise.reject(new Error('Clipboard unavailable'))).catch(() => setMessage('Não foi possível copiar o código.')); }}>Copiar Pix</button>
    </>}
    <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
      <button type="button" onClick={() => { void consult(); }} disabled={busy}>{busy ? 'Consultando…' : 'Consultar pagamento'}</button>
      <button type="button" onClick={onClose}>Fechar</button>
    </div>
  </section>;
}

