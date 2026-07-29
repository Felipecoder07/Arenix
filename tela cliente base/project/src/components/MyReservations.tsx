import { useState, useEffect } from 'react';
import { X, Search, CalendarCheck, Clock, Loader2, Ticket, QrCode, ArrowRight } from 'lucide-react';
import { brl, maskPhone, formatLongDate } from '../lib/format';

const BACKEND_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
  ? `http://${window.location.hostname}:3000`
  : 'http://localhost:3000';

interface Props {
  slug: string;
  athlete?: { name: string; email: string; phone: string } | null;
  open: boolean;
  onClose: () => void;
  onPayPending?: (reservaId: number) => void;
}

interface ReservaItem {
  id: number;
  quadra_id: number;
  quadra_nome: string;
  data_reserva: string;
  hora_inicio: string;
  hora_fim: string;
  valor_total: number;
  status: string;
  status_pagamento: string;
  criado_em: string;
}

export default function MyReservations({ slug, athlete, open, onClose, onPayPending }: Props) {
  const [phone, setPhone] = useState(athlete?.phone || '');
  const [reservas, setReservas] = useState<ReservaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [open]);

  const fetchReservas = async (customPhone?: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('courtmanager_athlete_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const targetPhone = customPhone !== undefined ? customPhone : phone;
      const queryPhone = targetPhone ? `?telefone=${encodeURIComponent(targetPhone)}` : '';
      
      const res = await fetch(`${BACKEND_URL}/api/public/tenant/${slug}/minhas-reservas${queryPhone}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const sorted = Array.isArray(data) ? [...data].sort((a, b) => {
          const aPending = (a.status === 'Pendente' || a.status_pagamento === 'Pendente') && a.status !== 'Cancelada';
          const bPending = (b.status === 'Pendente' || b.status_pagamento === 'Pendente') && b.status !== 'Cancelada';
          if (aPending && !bPending) return -1;
          if (!aPending && bPending) return 1;
          return 0;
        }) : [];
        setReservas(sorted);
        setSearched(true);
      }
    } catch (err) {
      console.error('Erro ao buscar minhas reservas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (athlete?.phone) {
      setPhone(athlete.phone);
    }
    fetchReservas(athlete?.phone);
  }, [open, slug, athlete]);

  if (!open) return null;

  const handleSearchClick = () => {
    fetchReservas();
  };

  const getStatusBadge = (r: ReservaItem) => {
    if (r.status === 'Cancelada' || r.status_pagamento === 'Expirado' || r.status_pagamento === 'Desistência') {
      return <span className="text-[11px] font-bold uppercase rounded-full px-2 py-0.5 border bg-neutral-100 text-neutral-600 border-neutral-200">Expirado</span>;
    }
    if (r.status_pagamento === 'Pago') {
      return <span className="text-[11px] font-bold uppercase rounded-full px-2 py-0.5 border bg-available-bg text-available-text border-available-border">Confirmada · Pago</span>;
    }
    return <span className="text-[11px] font-bold uppercase rounded-full px-2 py-0.5 border bg-pending-bg text-pending-text border-pending-bg">Pendente</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-charcoal/50 animate-fadeIn" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card rounded-3xl shadow-sheet animate-scaleIn max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
          <h2 className="text-base font-bold text-charcoal">Minhas reservas</h2>
          <button
            onClick={onClose}
            className="tap -mr-2 flex items-center justify-center rounded-full text-muted active:bg-surface"
            aria-label="Fechar"
          >
            <X size={22} />
          </button>
        </div>

        <div className="px-5 pb-5 overflow-y-auto">
          {!athlete && (
            <>
              <p className="text-sm text-muted mb-3">
                Informe o WhatsApp usado nas suas reservas para consultá-las.
              </p>
              <div className="flex items-center gap-2 rounded-2xl border border-edge bg-cream px-3.5 h-14 mb-4">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  placeholder="(00) 000000000"
                  className="flex-1 bg-transparent outline-none text-base text-charcoal placeholder:text-muted/60"
                />
                <button
                  onClick={handleSearchClick}
                  disabled={loading}
                  className="tap shrink-0 flex items-center gap-1.5 rounded-xl bg-charcoal text-white px-3 h-11 text-sm font-semibold active:scale-95 transition disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Buscar
                </button>
              </div>
            </>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted text-sm">
              <Loader2 size={24} className="animate-spin text-charcoal" />
              <span>Carregando suas reservas...</span>
            </div>
          )}

          {!loading && searched && reservas.length > 0 && (
            <div className="space-y-3 animate-fadeIn">
              {reservas.map((r) => (
                <div key={r.id} className="rounded-2xl border border-edge bg-surface p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CalendarCheck size={16} className="text-muted" />
                      <span className="font-semibold text-charcoal text-sm">{r.quadra_nome}</span>
                    </div>
                    {getStatusBadge(r)}
                  </div>
                  <div className="space-y-1 text-sm text-muted">
                    <p className="flex items-center gap-2">
                      <CalendarCheck size={14} /> {formatLongDate(r.data_reserva)}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock size={14} /> {r.hora_inicio} às {r.hora_fim}
                    </p>
                    <p className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-edge/60">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-charcoal/80 bg-cream/90 px-2.5 py-1 rounded-lg border border-edge/80">
                        <Ticket size={13} className="text-available-text" />
                        Comprovante #{r.id}
                      </span>
                      <span className="font-bold text-charcoal">{brl(r.valor_total)}</span>
                    </p>

                    {(r.status === 'Pendente' || r.status_pagamento === 'Pendente') && r.status !== 'Cancelada' && r.status_pagamento !== 'Expirado' && r.status_pagamento !== 'Desistência' && (
                      <div className="mt-3 pt-2.5 border-t border-edge/60 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                          <QrCode size={13} /> Pix não concluído
                        </span>
                        {onPayPending && (
                          <button
                            onClick={() => {
                              onClose();
                              onPayPending(r.id);
                            }}
                            className="tap px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition"
                          >
                            <QrCode size={13} />
                            Pagar Pix Agora
                            <ArrowRight size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && searched && reservas.length === 0 && (
            <div className="text-center py-8 text-sm text-muted">
              Nenhuma reserva encontrada para a sua conta nesta arena.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
