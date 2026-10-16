import { useEffect, useState } from 'react';
import { apiFetch } from '../utils/apiFetch';

export interface RefundQuote {
  online: boolean;
  valor_centavos: number;
  confirmacao: string;
  reservas: { id: number; data: string; inicio: string; fim: string }[];
}

export function useRefundQuote(reservationId: number | null) {
  const [state, setState] = useState<{ id: number | null; quote: RefundQuote | null; error: string }>({ id: null, quote: null, error: '' });
  useEffect(() => {
    if (!reservationId) return;
    let active = true;
    apiFetch(`/api/pagamentos/reserva/${reservationId}/estorno`).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao consultar estorno.');
      if (active) setState({ id: reservationId, quote: data, error: '' });
    }).catch(error => {
      if (active) setState({ id: reservationId, quote: null, error: error.message });
    });
    return () => { active = false; setState({ id: null, quote: null, error: '' }); };
  }, [reservationId]);
  const current = state.id === reservationId;
  return { quote: current ? state.quote : null, error: current ? state.error : '', loading: Boolean(reservationId && (!current || (!state.quote && !state.error))) };
}
