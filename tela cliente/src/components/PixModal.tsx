import { useEffect, useMemo, useState } from 'react';
import { X, Copy, Check, Clock, ShieldCheck, Loader2, Zap } from 'lucide-react';
import type { ReservationInput } from '../types';
import { brl, formatLongDate, mmss } from '../lib/format';

interface Props {
  open: boolean;
  slug?: string;
  data: ReservationInput | null;
  pixPayload?: {
    copia_cola: string;
    qr_code?: string | null;
    reserva_id?: number;
    expira_em_minutos?: number;
    expira_em_segundos?: number;
  } | null;
  onClose: () => void;
  onCancelPending?: () => void;
}

import { BACKEND_URL } from '../lib/backendUrl';
const PIX_DURATION = 15 * 60;


function buildPixCodeFallback(data: ReservationInput): string {
  const id = `${data.courtId}${data.dateISO.replace(/-/g, '')}${data.start.replace(':', '')}`;
  return `00020126360012BR.GOV.BCB.PIX0111arena@beachclub.com.br5204000053039865802BR5913ARENA BEACH6009FORTALEZA62${pad(
    id.length
  )}${id}6304ABCD`;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function qrMatrix(seed: string, size = 25): boolean[][] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rng = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  const m: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) row.push(rng() > 0.5);
    m.push(row);
  }
  const placeFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        m[oy + y][ox + x] = edge || inner;
      }
    }
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const ix = ox + x, iy = oy + y;
        if (ix < size && iy < size && (x === 7 || y === 7)) m[iy][ix] = false;
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(size - 7, 0);
  placeFinder(0, size - 7);
  return m;
}

export default function PixModal({ open, slug = 'felp-arena', data, pixPayload, onClose, onCancelPending }: Props) {
  const [remaining, setRemaining] = useState(PIX_DURATION);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'pending' | 'confirmed'>('pending');
  const [simulating, setSimulating] = useState(false);

  const pixCode = useMemo(() => {
    if (pixPayload?.copia_cola) return pixPayload.copia_cola;
    return data ? buildPixCodeFallback(data) : '';
  }, [data, pixPayload]);

  const matrix = useMemo(() => (data ? qrMatrix(pixCode) : []), [pixCode, data]);

  useEffect(() => {
    if (!open) return;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [open]);

  // Contagem regressiva do Pix baseada no tempo real restante
  useEffect(() => {
    if (!open) return;
    let initialSeconds = PIX_DURATION;
    if (pixPayload?.expira_em_segundos !== undefined) {
      initialSeconds = Math.max(0, Math.min(PIX_DURATION, pixPayload.expira_em_segundos));
    } else if (pixPayload?.expira_em_minutos !== undefined) {
      initialSeconds = Math.max(0, Math.min(15, pixPayload.expira_em_minutos)) * 60;
    }
    setRemaining(initialSeconds);
    setStatus('pending');
    setCopied(false);
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (onCancelPending) onCancelPending();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [open, pixPayload]);

  // Polling para checar confirmação automática do Pix
  useEffect(() => {
    if (!open || status === 'confirmed' || !pixPayload?.reserva_id) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/public/tenant/${slug}/status-reserva/${pixPayload.reserva_id}`);
        if (res.ok) {
          const json = await res.json();
          if (json.status_pagamento === 'Pago') {
            setStatus('confirmed');
          } else if (json.status_pagamento === 'Expirado' || json.status === 'Cancelada') {
            setRemaining(0);
          }
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [open, status, pixPayload, slug]);

  if (!open || !data) return null;

  const handleCloseModal = () => {
    if (status === 'pending' && onCancelPending) {
      onCancelPending();
    }
    onClose();
  };

  const copy = async () => {
    let success = false;

    // 1. Tentar Clipboard API nativa (HTTPS/Localhost moderno)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(pixCode);
        success = true;
      } catch (e) {
        console.warn('Clipboard API bloqueada ou falhou, ativando fallback:', e);
      }
    }

    // 2. Fallback universal DOM para celulares iOS/Android em HTTP/IP local
    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = pixCode;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, 999999);
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (err) {
        console.error('Erro no fallback de cópia:', err);
      }
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Simular confirmação de pagamento Pix (Útil para testes no front)
  const handleSimularPagamento = async () => {
    if (pixPayload?.reserva_id) {
      setSimulating(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/public/tenant/${slug}/simular-pagamento`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reserva_id: pixPayload.reserva_id })
        });
        if (res.ok) {
          setStatus('confirmed');
        }
      } catch {}
      setSimulating(false);
    } else {
      setStatus('confirmed');
    }
  };

  const expired = remaining === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-charcoal/50 animate-fadeIn" onClick={handleCloseModal} />
      <div className="relative w-full max-w-sm bg-card rounded-3xl shadow-sheet animate-scaleIn overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-pending-bg flex items-center justify-center text-pending-text font-bold text-xs">
              PIX
            </span>
            <h2 className="text-base font-bold text-charcoal">Pagamento Pix</h2>
          </div>
          <button
            onClick={handleCloseModal}
            className="tap -mr-2 flex items-center justify-center rounded-full text-muted active:bg-surface"
            aria-label="Fechar"
          >
            <X size={22} />
          </button>
        </div>

        <div className="px-5 pb-5">
          {/* Timer */}
          <div
            className={`rounded-2xl px-4 py-3 mb-4 flex items-center gap-2.5 ${
              status === 'confirmed'
                ? 'bg-available-bg text-available-text'
                : expired
                ? 'bg-error-bg text-error-text'
                : 'bg-pending-bg text-pending-text'
            }`}
          >
            <Clock size={18} />
            <p className="text-sm font-semibold">
              {status === 'confirmed'
                ? '🎉 Pagamento Confirmado com Sucesso!'
                : expired
                ? 'Tempo esgotado — A reserva foi cancelada e a vaga liberada'
                : `Pague em ${mmss(remaining)} para garantir sua vaga`}
            </p>
          </div>

          {/* Summary */}
          <div className="rounded-2xl bg-surface border border-edge p-3.5 mb-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">{data.courtName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{formatLongDate(data.dateISO)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">{data.start} às {data.end}</span>
              <span className="font-bold text-charcoal">{brl(data.price)}</span>
            </div>
          </div>

          {status === 'pending' ? (
            <>
              {/* QR Code */}
              <div className="flex flex-col items-center">
                <div className="p-3 bg-white rounded-2xl border border-edge shadow-soft">
                  {pixPayload?.qr_code ? (
                    <img
                      src={
                        pixPayload.qr_code.startsWith('http') || pixPayload.qr_code.startsWith('data:')
                          ? pixPayload.qr_code
                          : `data:image/png;base64,${pixPayload.qr_code}`
                      }
                      alt="QR Code Pix"
                      className="w-[180px] h-[180px] object-contain"
                    />
                  ) : (
                    <svg viewBox="0 0 25 25" width="180" height="180" shapeRendering="crispEdges">
                      <rect width="25" height="25" fill="#ffffff" />
                      {matrix.map((row, y) =>
                        row.map((on, x) =>
                          on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#1c1c1c" /> : null
                        )
                      )}
                    </svg>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted">Aponte a câmera do seu banco</p>
              </div>

              {/* Copia e cola */}
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted mb-1.5 ml-1">Copia e cola</p>
                <div className="flex items-center gap-2 rounded-2xl border border-edge bg-cream px-3 py-2.5">
                  <code className="flex-1 text-xs text-charcoal/80 truncate font-mono">{pixCode}</code>
                  <button
                    onClick={copy}
                    className="tap shrink-0 flex items-center gap-1.5 rounded-xl bg-charcoal text-white px-3 h-10 text-sm font-semibold active:scale-95 transition"
                  >
                    {copied ? <Check size={16} className="text-available-bg" /> : <Copy size={16} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Estado de Sucesso */
            <div className="py-6 flex flex-col items-center text-center space-y-3 animate-scaleUp">
              <div className="w-16 h-16 rounded-full bg-available-bg text-available-text flex items-center justify-center font-bold text-3xl shadow-soft">
                <ShieldCheck size={36} />
              </div>
              <h3 className="text-lg font-bold text-charcoal">Reserva Confirmada!</h3>
              <p className="text-xs text-muted max-w-xs">
                Seu pagamento Pix foi aprovado com sucesso. Sua vaga está garantida na arena!
              </p>
              <button
                onClick={onClose}
                className="w-full rounded-2xl bg-available-text text-white font-bold h-12 text-sm shadow-soft active:scale-95 transition mt-2"
              >
                Concluir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
