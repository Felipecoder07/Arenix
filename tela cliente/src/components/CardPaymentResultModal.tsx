import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { apiFetch as fetch } from '../utils/apiFetch';

interface Props {
  slug: string;
  reservationId: number;
  initialStatus: string;
  onClose: () => void;
}

export default function CardPaymentResultModal({ slug, reservationId, initialStatus, onClose }: Readonly<Props>) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (status === 'approved' || status === 'rejected') return;
    let active = true;
    const check = async () => {
      try {
        const response = await fetch(`/api/public/tenant/${slug}/status-reserva/${reservationId}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        if (data.status_pagamento === 'Pago') setStatus('approved');
        else if (['Cancelado', 'Expirado'].includes(data.status_pagamento) || data.status === 'Cancelada') setStatus('rejected');
      } catch { /* Keep the pending message while the connection recovers. */ }
    };
    void check();
    const timer = window.setInterval(check, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [slug, reservationId, status]);

  const approved = status === 'approved';
  const rejected = status === 'rejected';
  const Icon = approved ? CheckCircle2 : rejected ? XCircle : Clock3;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-charcoal/50 p-5" role="dialog" aria-modal="true" aria-labelledby="card-result-title">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 text-center shadow-xl">
        <Icon size={42} className={`mx-auto mb-3 ${approved ? 'text-available-text' : rejected ? 'text-red-500' : 'text-amber-500'}`} />
        <h2 id="card-result-title" className="text-lg font-bold text-charcoal">
          {approved ? 'Pagamento confirmado' : rejected ? 'Pagamento não aprovado' : 'Pagamento em processamento'}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {approved ? 'Sua reserva está confirmada.' : rejected ? 'A cobrança foi recusada. Você pode fazer uma nova reserva e escolher outra forma de pagamento.' : 'Estamos aguardando a confirmação do Mercado Pago. Esta tela será atualizada automaticamente.'}
        </p>
        <button onClick={onClose} className="tap mt-5 w-full rounded-2xl bg-available-text px-4 text-sm font-bold text-white">
          {approved || rejected ? 'Fechar' : 'Continuar acompanhando depois'}
        </button>
      </div>
    </div>
  );
}
