import { useEffect, useMemo, useState } from 'react';
import type { Court, Slot, ReservationInput, ArenaInfo } from './types';
import ArenaHeader from './components/ArenaHeader';
import CourtSelector from './components/CourtSelector';
import DateCarousel from './components/DateCarousel';
import SlotGrid from './components/SlotGrid';
import CheckoutDrawer from './components/CheckoutDrawer';
import PixModal from './components/PixModal';
import MyReservations from './components/MyReservations';
import StepIndicator from './components/StepIndicator';
import LoginScreen from './components/LoginScreen';
import MyProfileModal from './components/MyProfileModal';
import { ArrowRight, ShoppingBag, ShieldCheck } from 'lucide-react';
import { brl, getLocalDateISO } from './lib/format';

const BACKEND_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
  ? `http://${window.location.hostname}:3000`
  : 'http://localhost:3000';

export default function App() {
  // 1. Extrair o Slug da URL (ex: /arena/felp-arena ou /felp-arena)
  const getSlugFromPath = () => {
    const path = window.location.pathname.replace(/^\/+/g, '');
    const parts = path.split('/');
    if (parts[0] === 'arena' && parts[1]) return parts[1];
    if (parts[0] && parts[0] !== 'index.html') return parts[0];
    return 'felp-arena'; // Slug padrão para testes
  };

  const [slug] = useState<string>(getSlugFromPath());
  const [arena, setArena] = useState<ArenaInfo | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [courtId, setCourtId] = useState<string>('');
  const [dateISO, setDateISO] = useState<string>(() => getLocalDateISO());
  const [slots, setSlots] = useState<Slot[]>([]);
  
  // Status da API
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  // Atleta Logado (Sessão do Atleta)
  const [athlete, setAthlete] = useState<{ name: string; email: string; phone: string } | null>(null);

  // Carrinho de Múltiplos Horários
  const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);

  // Modais e Drawers
  const [loginOpen, setLoginOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);
  const [reservation, setReservation] = useState<ReservationInput | null>(null);
  const [pixPayload, setPixPayload] = useState<{ copia_cola: string; qr_code?: string | null; reserva_id?: number } | null>(null);
  const [myResOpen, setMyResOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // 2. Carregar Dados Públicos do Tenant por Slug
  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/public/tenant/${slug}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (res.status === 403 && data.blocked) {
          setBlockedMsg(data.error || 'Agendamentos suspensos nesta arena.');
          return;
        }
        if (res.ok && data.arena) {
          const a = data.arena;
          setArena({
            name: a.nome,
            cover: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&q=80&w=800',
            address: a.endereco || 'Endereço não informado',
            whatsapp: a.telefone || '',
            hoursToday: a.horario_abertura && a.horario_fechamento ? `${a.horario_abertura} às ${a.horario_fechamento}` : '06:00 às 23:00',
            rating: 4.9,
            reviews: 128
          });
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  // 3. Carregar Quadras Ativas da Arena
  useEffect(() => {
    if (notFound || blockedMsg) return;
    fetch(`${BACKEND_URL}/api/public/tenant/${slug}/quadras`)
      .then(res => res.json())
      .then(data => {
        if (data.quadras && Array.isArray(data.quadras) && data.quadras.length > 0) {
          const mapped: Court[] = data.quadras.map((q: any) => ({
            id: String(q.id),
            name: q.nome,
            type: q.tipo === 'Areia' ? 'areia' : q.tipo === 'Coletiva' ? 'coberta' : 'society',
            pricePerHour: q.preco_base,
            surface: q.tipo || 'Areia'
          }));
          setCourts(mapped);
          setCourtId(mapped[0].id);
        }
      })
      .catch(err => console.error('Erro ao buscar quadras:', err));
  }, [slug, notFound, blockedMsg]);

  const [refreshCount, setRefreshCount] = useState(0);

  // 4. Carregar Matriz de Disponibilidade de Horários
  useEffect(() => {
    if (!courtId || notFound || blockedMsg) return;
    fetch(`${BACKEND_URL}/api/public/tenant/${slug}/disponibilidade?data=${dateISO}&quadra_id=${courtId}`)
      .then(res => res.json())
      .then(data => {
        if (data.quadras && data.quadras.length > 0) {
          const qData = data.quadras[0];
          const mappedSlots: Slot[] = qData.slots.map((s: any) => {
            const hInt = parseInt(s.hora_inicio.split(':')[0], 10);
            const block = hInt < 12 ? 'manha' : hInt < 18 ? 'tarde' : 'noite';
            return {
              id: `${courtId}-${dateISO}-${s.hora_inicio}`,
              courtId: String(courtId),
              dateISO,
              start: s.hora_inicio,
              end: s.hora_fim,
              price: s.preco,
              status: s.status === 'disponivel' ? 'free' : s.status === 'passado' ? 'past' : 'busy',
              block
            };
          });
          setSlots(mappedSlots);
        }
      })
      .catch(err => console.error('Erro ao buscar disponibilidade:', err));
  }, [slug, courtId, dateISO, notFound, blockedMsg, refreshCount]);

  // ─── BLOQUEIO DE SCROLL DE FUNDO QUANDO QUALQUER MODAL ESTIVER ABERTO ───
  useEffect(() => {
    const isAnyModalOpen = loginOpen || profileOpen || myResOpen || drawerOpen || pixOpen;
    if (isAnyModalOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [loginOpen, profileOpen, myResOpen, drawerOpen, pixOpen]);

  const court = useMemo(() => courts.find((c) => c.id === courtId) || courts[0], [courts, courtId]);

  const step = drawerOpen ? 2 : pixOpen ? 3 : selectedSlots.length > 0 ? 1 : 0;
  const totalPrice = useMemo(() => selectedSlots.reduce((acc, s) => acc + s.price, 0), [selectedSlots]);

  // Seleção Múltipla de Horários (Alternar entrada/saída do carrinho)
  const handleToggleSlot = (s: Slot) => {
    setSelectedSlots(prev => {
      const exists = prev.some(item => item.id === s.id);
      if (exists) {
        return prev.filter(item => item.id !== s.id);
      } else {
        return [...prev, s];
      }
    });
  };

  // Avançar para o Checkout
  const handleProceedCheckout = () => {
    if (selectedSlots.length === 0) return;
    if (!athlete) {
      setLoginOpen(true);
    } else {
      setDrawerOpen(true);
    }
  };

  const handleAuthed = (user: { name: string; email: string; phone: string }) => {
    setAthlete(user);
    setLoginOpen(false);
  };

  // Confirmar Agendamento de Múltiplos Horários via Backend Pix
  const handleConfirm = async (dataInput: { slots: Slot[]; name: string; phone: string; cpf: string }) => {
    try {
      const payloadItens = dataInput.slots.map(s => ({
        quadra_id: parseInt(s.courtId, 10),
        data_reserva: s.dateISO,
        hora_inicio: s.start,
        hora_fim: s.end,
        preco: s.price
      }));

      const res = await fetch(`${BACKEND_URL}/api/public/tenant/${slug}/agendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: dataInput.name,
          telefone: dataInput.phone,
          cpf: dataInput.cpf,
          email: athlete?.email || '',
          itens: payloadItens
        })
      });

      const resJson = await res.json();

      if (res.ok) {
        setPixPayload({
          copia_cola: resJson.copia_cola,
          qr_code: resJson.qr_code,
          reserva_id: resJson.reserva_id
        });

        const first = dataInput.slots[0];
        setReservation({
          courtId: first.courtId,
          courtName: court ? `${court.name} (${dataInput.slots.length} horários)` : 'Múltiplas Quadras',
          dateISO: first.dateISO,
          start: first.start,
          end: dataInput.slots[dataInput.slots.length - 1].end,
          price: resJson.valor_total,
          name: dataInput.name,
          phone: dataInput.phone,
          cpf: dataInput.cpf
        });

        setDrawerOpen(false);
        setPixOpen(true);
      } else {
        alert(resJson.error || 'Erro ao realizar agendamento.');
      }
    } catch {
      alert('Erro de conexão ao agendar. Tente novamente.');
    }
  };

  const handleCancelPending = async () => {
    if (pixPayload?.reserva_id) {
      try {
        await fetch(`${BACKEND_URL}/api/public/tenant/${slug}/cancelar-pendente`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reserva_id: pixPayload.reserva_id })
        });
      } catch {}
    }
  };

  const handlePixClose = () => {
    setPixOpen(false);
    setReservation(null);
    setSelectedSlots([]);
    setRefreshCount(c => c + 1);
  };

  const handlePayPending = async (reservaId: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/public/tenant/${slug}/reserva-pix/${reservaId}`);
      const data = await res.json();
      if (res.ok && data.reserva_id) {
        if (data.status_pagamento === 'Pago') {
          alert('Esta reserva já consta como Paga!');
          setRefreshCount(c => c + 1);
          return;
        }

        const formattedReservation: ReservationInput = {
          courtId: '0',
          courtName: data.quadra_nome || 'Quadra',
          dateISO: data.data_reserva,
          start: data.hora_inicio || '00:00',
          end: data.hora_fim || '00:00',
          price: data.valor_total || 0,
          name: athlete?.name || 'Atleta',
          phone: athlete?.phone || '',
          cpf: ''
        };

        setReservation(formattedReservation);
        setPixPayload({
          reserva_id: data.reserva_id,
          reservas_ids: [data.reserva_id],
          copia_cola: data.copia_cola,
          qr_code: data.qr_code,
          valor_total: data.valor_total,
          expira_em_minutos: data.expira_em_minutos || 15,
          expira_em_segundos: data.expira_em_segundos !== undefined ? data.expira_em_segundos : (data.expira_em_minutos || 15) * 60
        });
        setPixOpen(true);
      } else {
        alert(data.error || 'Não foi possível reabrir a cobrança Pix desta reserva.');
      }
    } catch {
      alert('Falha ao conectar com o servidor para consultar o Pix.');
    }
  };

  // ─── TELA 404 (SLUG INVÁLIDO OU ARENA NÃO ENCONTRADA) ───
  if (notFound) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">🏟️</div>
        <h1 className="text-xl font-bold text-charcoal mb-2">Arena Não Encontrada (404)</h1>
        <p className="text-sm text-muted max-w-xs mb-6">
          O link acessado não corresponde a nenhuma arena ativa em nossa plataforma. Verifique a URL e tente novamente.
        </p>
      </div>
    );
  }

  // ─── TELA DE BLOQUEIO (ARENA SUSPENSA) ───
  if (blockedMsg) {
    return (
      <div className="min-h-screen bg-[#18181b] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-3xl mb-4 text-red-500">🔒</div>
        <h2 className="text-xl font-bold mb-2 text-red-400">Agendamentos Suspensos</h2>
        <p className="text-sm text-gray-400 max-w-xs">{blockedMsg}</p>
      </div>
    );
  }

  if (loading || !arena) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-edge border-t-charcoal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream max-w-md mx-auto relative">
      <ArenaHeader
        arena={arena}
        athlete={athlete}
        onMyReservations={() => setMyResOpen(true)}
        onMyProfile={() => setProfileOpen(true)}
        onLogin={() => setLoginOpen(true)}
      />

      <StepIndicator total={4} current={step} />

      <main className={selectedSlots.length > 0 ? 'pb-28' : 'pb-4'}>
        {courts.length > 0 && (
          <CourtSelector courts={courts} selectedId={courtId} onSelect={setCourtId} />
        )}
        <DateCarousel selectedISO={dateISO} onSelect={setDateISO} />
        <SlotGrid
          slots={slots}
          selectedSlotIds={selectedSlots.map(s => s.id)}
          onSelect={handleToggleSlot}
        />

        {/* Rodapé Elegante com Selo da Plataforma */}
        <footer className="mt-6 pt-4 pb-2 border-t border-edge/60 text-center px-4">
          <p className="text-[11px] text-muted/80 font-medium flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} className="text-available-text shrink-0" />
            Agendamento garantido por <span className="font-bold text-charcoal">Arenix</span> · Sistema para Arenas
          </p>
        </footer>
      </main>

      {/* Barra Inferior Flutuante (Sticky Bottom Bar do Carrinho) */}
      {selectedSlots.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-edge p-4 max-w-md mx-auto shadow-sheet animate-slideUp">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-available-bg text-available-text flex items-center justify-center font-bold">
                <ShoppingBag size={20} />
              </div>
              <div>
                <span className="text-xs font-bold text-muted block">
                  {selectedSlots.length} {selectedSlots.length === 1 ? 'horário selecionado' : 'horários selecionados'}
                </span>
                <span className="text-base font-bold text-available-text">
                  {brl(totalPrice)}
                </span>
              </div>
            </div>

            <button
              onClick={handleProceedCheckout}
              className="tap flex items-center gap-2 bg-available-text text-white font-bold px-5 h-12 rounded-2xl shadow-soft active:scale-[0.98] transition text-sm"
            >
              Avançar
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}



      {/* Modal de Login / Cadastro do Atleta */}
      {loginOpen && (
        <LoginScreen
          arena={arena}
          slug={slug}
          onAuthed={handleAuthed}
          onClose={() => setLoginOpen(false)}
        />
      )}

      {/* Modal do Perfil do Atleta */}
      {athlete && (
        <MyProfileModal
          slug={slug}
          athlete={athlete}
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onUpdate={(updated) => {
            setAthlete(prev => prev ? { ...prev, name: updated.name, phone: updated.phone } : prev);
          }}
        />
      )}

      <CheckoutDrawer
        open={drawerOpen}
        slots={selectedSlots}
        court={court}
        initialName={athlete?.name || ''}
        initialPhone={athlete?.phone || ''}
        onClose={() => setDrawerOpen(false)}
        onConfirm={handleConfirm}
      />

      <PixModal
        open={pixOpen}
        slug={slug}
        data={reservation}
        pixPayload={pixPayload}
        onClose={handlePixClose}
        onCancelPending={handleCancelPending}
      />

      <MyReservations
        slug={slug}
        athlete={athlete}
        open={myResOpen}
        onClose={() => setMyResOpen(false)}
        onPayPending={handlePayPending}
      />
    </div>
  );
}
