import { MapPin, MessageCircle, Clock, Star, CalendarCheck, User } from 'lucide-react';
import type { ArenaInfo } from '../types';

interface Props {
  arena: ArenaInfo;
  athlete?: { name: string; email: string; phone: string } | null;
  onMyReservations: () => void;
  onMyProfile?: () => void;
  onLogin?: () => void;
}

export default function ArenaHeader({ arena, athlete, onMyReservations, onMyProfile, onLogin }: Props) {
  return (
    <header className="relative">
      <div className="relative h-56 w-full overflow-hidden">
        <img
          src={arena.cover}
          alt={arena.name}
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal/30 via-charcoal/20 to-charcoal/70" />

        <div className="absolute top-4 right-4 flex items-center gap-2">
          {athlete ? (
            <>
              {onMyProfile && (
                <button
                  onClick={onMyProfile}
                  className="flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-sm px-3 h-9 text-xs font-bold text-charcoal shadow-soft active:scale-95 transition"
                >
                  <User size={14} className="text-available-text" />
                  Meu Perfil
                </button>
              )}

              <button
                onClick={onMyReservations}
                className="flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-sm px-3 h-9 text-xs font-bold text-charcoal shadow-soft active:scale-95 transition"
              >
                <CalendarCheck size={14} className="text-available-text" />
                Minhas Reservas
              </button>
            </>
          ) : (
            onLogin && (
              <button
                onClick={onLogin}
                className="rounded-full bg-white/90 backdrop-blur-sm px-5 h-9 text-[13px] font-semibold tracking-wide text-charcoal shadow-soft active:scale-95 transition hover:bg-white"
                style={{ fontFamily: "'Inter', 'Outfit', system-ui, sans-serif", letterSpacing: '0.02em' }}
              >
                Entrar
              </button>
            )
          )}
        </div>

        <div className="absolute bottom-4 left-4 right-4 text-white">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-semibold">
              <Star size={12} className="fill-white" /> {arena.rating.toFixed(1)} · {arena.reviews} avaliações
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight drop-shadow-sm">{arena.name}</h1>
        </div>
      </div>

      <div className="bg-card border-b border-edge px-4 py-3.5 space-y-2">
        <div className="flex items-start gap-2.5 text-sm">
          <MapPin size={18} className="text-muted shrink-0 mt-0.5" />
          <span className="text-charcoal/90 leading-snug">{arena.address}</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm">
          <Clock size={18} className="text-available-text shrink-0" />
          <span className="font-medium text-charcoal">{arena.hoursToday}</span>
        </div>
        <a
          href={`https://wa.me/${arena.whatsapp.replace(/\D/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 text-sm text-available-text font-medium active:opacity-70"
        >
          <MessageCircle size={18} className="shrink-0" />
          {arena.whatsapp} · Falar no WhatsApp
        </a>
      </div>
    </header>
  );
}
