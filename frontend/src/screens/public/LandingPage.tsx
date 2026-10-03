import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { enterpriseContactUrl } from '../../utils/commercialContact';
import '../../assets/css/landing-balls.css';

// Ícones inline
const IconPlay = () => (
  <svg viewBox="0 0 14 14" style={{ width: 14, height: 14, flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg">
    <path d="M3.75 1.2q-0.53 0.1-0.92 0.49-0.38 0.39-0.47 0.91-0.03 0.15-0.03 4.4 0 4.24 0.03 4.4 0.09 0.52 0.48 0.91 0.53 0.55 1.32 0.52 0.19-0.01 0.34-0.05 0.15-0.04 0.31-0.11 0.13-0.06 3.59-2.08 3.47-2.02 3.64-2.14 0.24-0.15 0.42-0.38 0.18-0.23 0.27-0.51 0.09-0.27 0.09-0.57 0-0.29-0.09-0.57-0.19-0.53-0.66-0.85-0.11-0.08-3.6-2.11-3.49-2.03-3.61-2.1-0.25-0.13-0.55-0.17-0.3-0.04-0.57 0.01z" fill="#F2F6F0"/>
  </svg>
);

const IconCheck = ({ color = '#C8F04B' }: { color?: string }) => (
  <svg viewBox="0 0 14 14" style={{ width: 14, height: 14, flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg">
    <path d="M11.48 2.95q-0.07 0.01-0.13 0.06-0.05 0.04-3.08 3.07l-3.02 3.01-1.29-1.29q-1.29-1.29-1.38-1.33-0.09-0.04-0.22-0.04-0.13 0-0.23 0.04-0.1 0.03-0.19 0.11-0.09 0.08-0.13 0.17-0.03 0.07-0.03 0.11-0.01 0.04-0.01 0.14l0 0.04q-0.01 0.11 0.04 0.2 0.07 0.11 0.37 0.4 0.19 0.21 0.97 0.98l1.5 1.48q0.28 0.27 0.39 0.34 0.07 0.05 0.18 0.04l0.1 0.01q0.07 0 0.14-0.03 0.09-0.07 0.32-0.29 0.24-0.22 0.8-0.76l2.28-2.28q2.09-2.1 2.7-2.71 0.62-0.62 0.65-0.69 0.04-0.09 0.04-0.24 0-0.1-0.01-0.14-0.01-0.04-0.03-0.11-0.04-0.08-0.14-0.16-0.09-0.09-0.18-0.12-0.09-0.04-0.21-0.04-0.12 0-0.19 0.03z" fill={color}/>
  </svg>
);

interface FeatureCard {
  label: string;
  title: string;
  description: string;
  badge: string;
  highlight?: boolean;
}

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  features: string[];
  ctaText: string;
  highlighted?: boolean;
}

const FEATURES: FeatureCard[] = [
  { label: 'AGENDA', title: 'Reservas e agenda', description: 'Organize horários, crie reservas e acompanhe a ocupação de cada quadra.', badge: 'Reservas 24 horas', highlight: true },
  { label: 'FINANCEIRO', title: 'Pagamentos', description: 'Registre recebimentos, valores pendentes e diferentes formas de pagamento.', badge: 'Pix, cartão e dinheiro' },
  { label: 'RELACIONAMENTO', title: 'Clientes', description: 'Centralize dados dos clientes e consulte o histórico de cada jogador.', badge: 'Histórico centralizado' },
  { label: 'DADOS', title: 'Relatórios', description: 'Acompanhe faturamento, ocupação e os principais indicadores da arena.', badge: 'Indicadores da operação' },
  { label: 'PLANO', title: 'Assinatura', description: 'Consulte seu plano, situação da assinatura e recursos disponíveis.', badge: 'Plano sempre visível' },
  { label: 'CONTROLE', title: 'Auditoria e ajustes', description: 'Visualize ações importantes e configure quadras, horários e permissões.', badge: 'Mais segurança e controle' },
];

const PLANS: PricingPlan[] = [
  { name: 'Básico', price: 'R$ 49,99', period: '/mês · até 3 quadras', features: ['Reservas e pagamentos', 'Painel de controle básico', '3 usuários internos', 'Lembretes via e-mail'], ctaText: 'Começar grátis' },
  { name: 'Pro', price: 'R$ 79,99', period: '/mês · até 10 quadras', features: ['Tudo do Básico', 'Relatórios completos', '10 usuários internos', 'Auditoria e logs', 'Gestão de mensalistas', 'Suporte prioritário'], ctaText: 'Começar grátis', highlighted: true },
  { name: 'Empresa', price: 'Sob consulta', period: 'por unidade', features: ['Tudo do Pro', 'Múltiplas arenas', 'Precificação dinâmica', 'Integrações via API', 'SLA dedicado'], ctaText: 'Falar com vendas' },
];

const CLUB_LOGOS = ['ARENA 7', 'CLUBE 300', 'RAQUETARIA', 'VIVA SPORT', 'BOLA NA REDE'];
const STATS = [
  { value: '+38%', label: 'em rendimento no primeiro mês' },
  { value: '12h', label: 'economizadas por semana' },
  { value: '4.9/5', label: 'avaliação de quem utiliza' },
];
const NAV_LINKS = ['Produto', 'Recursos', 'Preços', 'Clubes'];

// Mini preview da interface
function DashboardPreview() {
  const sidebarItems = ['Dashboard', 'Reservas', 'Pagamentos', 'Clientes', 'Relatórios', 'Assinatura', 'Configurações'];
  const summaryCards = [
    { label: 'FATURAMENTO DO DIA', value: 'R$ 0,00', note: 'hoje' },
    { label: 'FATURAMENTO PENDENTE', value: 'R$ 0,00', note: '0 reservas ativas' },
    { label: 'RESERVAS DO DIA', value: '0', note: 'no dia de hoje' },
    { label: 'TAXA DE OCUPAÇÃO', value: '0%', note: 'da capacidade hoje' },
  ];
  const hours = ['08h', '09h', '10h', '11h'];
  const courts = ['QUADRA 1', 'QUADRA 2', 'QUADRA 3', 'ADFD'];

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 1040,
        height: 440,
        display: 'flex',
        flexDirection: 'row',
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: '0 30px 80px -15px rgba(0,0,0,0.85), 0 0 50px -10px rgba(200, 240, 75, 0.12)',
        outline: '1px solid rgba(255, 255, 255, 0.12)',
        background: '#FAF7F2'
      }}
    >
      {/* Sidebar */}
      <div style={{ width: 154, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, background: '#071813', padding: '18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
          <div style={{ width: 22, height: 22, background: '#C8F04B', borderRadius: 6 }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: '#F7F2EA', fontFamily: 'Inter, sans-serif' }}>courtly</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
          {sidebarItems.map((item, i) => (
            <div key={item} style={{ width: '100%', height: 28, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', borderRadius: 7, background: i === 0 ? '#C8F04B' : 'transparent' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? '#071813' : '#768B80' }} />
              <span style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', color: i === 0 ? '#071813' : '#8A9D93', fontWeight: i === 0 ? 700 : 500 }}>{item}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#0F241E', borderRadius: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#C8F04B', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 9, color: '#F7F2EA', fontWeight: 700, lineHeight: '11px' }}>Teste Arena</span>
            <span style={{ fontSize: 8, color: '#8A9D93', lineHeight: '10px' }}>Arena Central</span>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: 14, background: '#F8F4EC' }}>
        {/* Top Header */}
        <div style={{ width: '100%', height: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 8, color: '#6F766F', fontWeight: 500 }}>Painel gestor / Visão geral</div>
            <div style={{ fontSize: 16, color: '#071915', fontWeight: 800 }}>Dashboard</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: '#071915', fontWeight: 700 }}>Olá, Teste</span>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#C8F04B' }} />
          </div>
        </div>

        {/* 4 Cards */}
        <div style={{ width: '100%', height: 70, display: 'flex', gap: 8 }}>
          {summaryCards.map((c) => (
            <div key={c.label} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: '8px 10px', borderRadius: 9, background: '#FAF7F2', outline: '1px solid #E5DFD5' }}>
              <span style={{ fontSize: 7, color: '#566059', fontWeight: 800 }}>{c.label}</span>
              <span style={{ fontSize: 15, color: '#071915', fontWeight: 800 }}>{c.value}</span>
              <span style={{ fontSize: 7, color: '#7E8A83' }}>{c.note}</span>
            </div>
          ))}
        </div>

        {/* Middle row */}
        <div style={{ width: '100%', height: 180, display: 'flex', gap: 8 }}>
          {/* Table */}
          <div style={{ flex: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 10, background: '#FAF7F2', outline: '1px solid #E5DFD5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#071915', fontWeight: 800 }}>Grade do Dia - Hoje</span>
              <span style={{ fontSize: 7, color: '#4F5550', fontWeight: 600, background: 'white', padding: '2px 6px', borderRadius: 5, outline: '1px solid #E0D9CE' }}>Ver agendamentos</span>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {[{ c: '#23A86B', l: 'Pago' }, { c: '#43B7FF', l: 'Confirmado' }, { c: '#FFB545', l: 'Pendente' }, { c: '#C9C1B6', l: 'Cancelado' }, { c: '#071915', l: 'Bloqueado' }].map((x) => (
                <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: x.c }} />
                  <span style={{ fontSize: 6, color: '#6F766F', fontWeight: 600 }}>{x.l}</span>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ height: 16, display: 'flex', gap: 3 }}>
                <div style={{ width: 28 }} />
                {courts.map((c) => (
                  <div key={c} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <span style={{ fontSize: 6, color: '#6F766F', fontWeight: 700 }}>{c}</span>
                  </div>
                ))}
              </div>
              {hours.map((h) => (
                <div key={h} style={{ flex: 1, display: 'flex', gap: 3 }}>
                  <div style={{ width: 28, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 4 }}>
                    <span style={{ fontSize: 6, color: '#6F766F', fontWeight: 600 }}>{h}</span>
                  </div>
                  {courts.map((c) => (
                    <div key={c} style={{ flex: 1, background: '#F8F4EC', borderRadius: 4, outline: '1px solid #E5DFD5' }} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ flex: 3, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 4, padding: 10, borderRadius: 10, background: '#FAF7F2', outline: '1px solid #E5DFD5', textAlign: 'center' }}>
              <span style={{ fontSize: 9, color: '#071915', fontWeight: 800 }}>Próximas Reservas</span>
              <span style={{ fontSize: 7, color: '#4F5550', fontWeight: 600 }}>Nenhuma reserva para hoje</span>
              <span style={{ fontSize: 6, color: '#6F766F' }}>Que tal criar uma nova reserva?</span>
              <div style={{ width: '90%', height: 22, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#071915', borderRadius: 5, marginTop: 4 }}>
                <span style={{ fontSize: 7, color: 'white', fontWeight: 700 }}>+ Nova Reserva</span>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '6px 8px', background: '#FFF9ED', borderRadius: 8, outline: '1px solid #FFB545' }}>
              <span style={{ fontSize: 7, color: '#8A4B00', fontWeight: 800 }}>Atenção</span>
              <span style={{ fontSize: 6, color: '#8A6A3B' }}>Nenhum alerta para hoje.</span>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ width: '100%', flex: 1, display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: '6px 10px', borderRadius: 8, background: '#FAF7F2', outline: '1px solid #E5DFD5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 7, color: '#071915', fontWeight: 800 }}>Faturamento do Mês</span>
              <span style={{ fontSize: 6, color: '#6F766F' }}>Atualizado</span>
            </div>
            <span style={{ fontSize: 13, color: '#071915', fontWeight: 800 }}>R$ 6.003,00</span>
            <span style={{ fontSize: 6, color: '#4F5550' }}>No mês vigente</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: '6px 10px', borderRadius: 8, background: '#FAF7F2', outline: '1px solid #E5DFD5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 7, color: '#071915', fontWeight: 800 }}>Inadimplência</span>
              <span style={{ fontSize: 6, color: '#6F766F' }}>Ver detalhes</span>
            </div>
            <span style={{ fontSize: 13, color: '#B32323', fontWeight: 800 }}>R$ 0,00</span>
            <span style={{ fontSize: 6, color: '#4F5550' }}>0 reservas em aberto</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, padding: '6px 10px', borderRadius: 8, background: '#FAF7F2', outline: '1px solid #E5DFD5' }}>
            <span style={{ fontSize: 7, color: '#071915', fontWeight: 800 }}>Status das Quadras</span>
            {['Quadra 1', 'Quadra 2', 'ADFD'].map((q) => (
              <div key={q} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 6, color: '#4F5550', fontWeight: 600 }}>{q}</span>
                <span style={{ fontSize: 6, color: '#397A20', fontWeight: 700, background: '#E7F7DB', padding: '1px 4px', borderRadius: 4 }}>Livre</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCardComp({ f }: { f: FeatureCard }) {
  if (f.highlight) {
    return (
      <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', gap: 14, padding: '28px 24px', background: '#C8F04B', outline: '1px solid #C8F04B', borderRadius: 20, boxShadow: '0px 10px 24px rgba(0,0,0,0.18)' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#071915', borderRadius: 12 }}>
            <div style={{ width: 18, height: 18, border: '2px solid #C8F04B', borderRadius: 4 }} />
          </div>
          <span style={{ fontSize: 10, color: '#2A3C17', fontWeight: 800, letterSpacing: '1.5px', fontFamily: 'Inter, sans-serif' }}>{f.label}</span>
        </div>
        <h3 style={{ fontSize: 24, lineHeight: '28px', color: '#071915', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>{f.title}</h3>
        <p style={{ fontSize: 14, lineHeight: '22px', color: '#243417', fontFamily: 'Inter, sans-serif', margin: 0, flex: 1 }}>{f.description}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', background: '#071915', borderRadius: 9999, width: 'fit-content' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C8F04B' }} />
          <span style={{ fontSize: 11, color: 'white', fontWeight: 700, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>{f.badge}</span>
        </div>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', gap: 14, padding: '28px 24px', background: '#11221A', outline: '1px solid #1E362A', borderRadius: 20, boxShadow: '0px 10px 24px rgba(0,0,0,0.22)' }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1C3528', borderRadius: 12 }}>
          <div style={{ width: 18, height: 18, border: '2px solid #C8F04B', borderRadius: 4 }} />
        </div>
        <span style={{ fontSize: 10, color: '#6A8073', fontWeight: 800, letterSpacing: '1.5px', fontFamily: 'Inter, sans-serif' }}>{f.label}</span>
      </div>
      <h3 style={{ fontSize: 24, lineHeight: '28px', color: '#F2F6F0', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>{f.title}</h3>
      <p style={{ fontSize: 14, lineHeight: '22px', color: '#97A99E', fontFamily: 'Inter, sans-serif', margin: 0, flex: 1 }}>{f.description}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', background: '#193125', borderRadius: 9999, width: 'fit-content' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C8F04B' }} />
        <span style={{ fontSize: 11, color: '#C8F04B', fontWeight: 700, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>{f.badge}</span>
      </div>
    </div>
  );
}

function PricingCard({ plan, annual, onAction }: { plan: PricingPlan; annual: boolean; onAction: () => void }) {
  const hi = plan.highlighted;
  const price = () => {
    if (plan.price === 'Sob consulta') return plan.price;
    if (!annual) return plan.price;
    const v = parseFloat(plan.price.replace('R$ ', '').replace(',', '.')) * 0.8;
    return `R$ ${v.toFixed(2).replace('.', ',')}`;
  };
  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '34px 28px',
        borderRadius: 20,
        background: hi ? '#162A1F' : '#111F18',
        outline: hi ? '2px solid #C8F04B' : '1px solid #1E3327',
        boxShadow: hi ? '0px 16px 36px rgba(0,0,0,0.45)' : '0px 8px 24px rgba(0,0,0,0.2)'
      }}
    >
      {hi && (
        <div style={{ padding: '5px 12px', background: '#C8F04B', borderRadius: 9999, width: 'fit-content', marginBottom: 2 }}>
          <span style={{ fontSize: 9, color: '#0E1512', fontWeight: 800, fontFamily: 'Inter, sans-serif', letterSpacing: '0.5px' }}>MAIS POPULAR</span>
        </div>
      )}
      <span style={{ fontSize: 14, color: hi ? '#C8F04B' : '#8E9F94', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>{plan.name}</span>
      <span style={{ fontSize: plan.price === 'Sob consulta' ? 36 : 42, color: '#F2F6F0', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{price()}</span>
      <span style={{ fontSize: 13, color: '#8E9F94', fontFamily: 'Inter, sans-serif' }}>{annual && plan.price !== 'Sob consulta' ? plan.period + ' (anual)' : plan.period}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        {plan.features.map((feat) => (
          <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconCheck />
            <span style={{ fontSize: 13, color: '#A0B2A7', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>{feat}</span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <button
        onClick={onAction}
        style={{
          width: '100%',
          height: 48,
          borderRadius: 12,
          background: hi ? '#C8F04B' : '#1B2E24',
          color: hi ? '#0E1512' : '#F2F6F0',
          fontSize: 14,
          fontWeight: 800,
          fontFamily: 'Inter, sans-serif',
          border: hi ? 'none' : '1px solid #284434',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        {plan.ctaText}
      </button>
    </div>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);

  return (
    <div style={{ background: '#0B130F', minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif', overflowX: 'hidden', position: 'relative' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Space+Grotesk:wght@300..700&display=swap');`}</style>

      {/* Navbar */}
      <nav style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '24px 32px', position: 'relative', zIndex: 30 }}>
        <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/')}>
            <div style={{ width: 28, height: 28, background: '#C8F04B', borderRadius: 8 }} />
            <span style={{ fontSize: 20, color: '#F2F6F0', fontWeight: 700, fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>CourtManager</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
            {NAV_LINKS.map((l) => (
              <span key={l} style={{ fontSize: 15, color: '#8E9F94', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>{l}</span>
            ))}
            <button onClick={() => navigate('/login')} style={{ padding: '10px 18px', background: 'transparent', color: '#8E9F94', fontSize: 14, fontWeight: 500, borderRadius: 9999, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>
              Entrar
            </button>
            <button onClick={() => navigate('/cadastro')} style={{ padding: '12px 24px', background: '#C8F04B', color: '#0E1512', fontSize: 14, fontWeight: 700, borderRadius: 9999, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>
              Começar grátis
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 32px 76px', backgroundImage: 'radial-gradient(ellipse 65% 55% at 50% -10%, #1A3828 0%, #0B130F 100%)', position: 'relative', zIndex: 10 }}>
        {/* Futebol: metade visível na lateral do hero. */}
        <img
          className="landing-ball landing-ball--soccer"
          src="/images/ball-soccer.png"
          alt=""
          aria-hidden="true"
        />

        <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, position: 'relative', zIndex: 5 }}>
          <h1 style={{ fontSize: 72, lineHeight: '76px', color: '#F2F6F0', fontWeight: 700, fontFamily: "'Space Grotesk', system-ui, sans-serif", textAlign: 'center', maxWidth: 880, margin: 0 }}>
            Gestão de quadras sem complicação.
          </h1>
          <p style={{ fontSize: 19, lineHeight: '30px', color: '#8E9F94', textAlign: 'center', maxWidth: 650, margin: 0, fontFamily: 'Inter, sans-serif' }}>
            Reservas, pagamentos e alunos em um só lugar. O CourtManager cuida da burocracia para você focar no jogo.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/cadastro')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 34px', background: '#C8F04B', color: '#0E1512', fontSize: 16, fontWeight: 700, borderRadius: 12, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>
              Testar 14 dias grátis
            </button>
            <button onClick={() => navigate('/login')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 34px', background: 'transparent', color: '#F2F6F0', fontSize: 16, fontWeight: 600, borderRadius: 12, outline: '1px solid #203B2B', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>
              <IconPlay />
              Ver demonstração
            </button>
          </div>
          <span style={{ fontSize: 13, color: '#8E9F94', fontFamily: 'Inter, sans-serif', marginTop: -6 }}>Sem cartão de crédito · Cancele quando quiser</span>
          
          <div style={{ marginTop: 12, width: '100%', display: 'flex', justifyContent: 'center' }}>
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '44px 32px', borderTop: '1px solid #1A2E22', borderBottom: '1px solid #1A2E22', position: 'relative', zIndex: 12, background: '#0B130F' }}>
        <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <span style={{ fontSize: 13, color: '#7E9185', fontFamily: 'Inter, sans-serif' }}>A escolha de quem leva o esporte a sério</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 54, flexWrap: 'wrap', justifyContent: 'center' }}>
            {CLUB_LOGOS.map((l) => (
              <span key={l} style={{ fontSize: 15, color: '#566E60', fontWeight: 600, letterSpacing: '1.2px', fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap' }}>{l}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '96px 32px 108px', background: '#0B130F', position: 'relative', zIndex: 13 }}>
        {/* Vôlei: sobrepõe a divisão entre clubes e recursos. */}
        <img
          className="landing-ball landing-ball--volleyball"
          src="/images/ball-volleyball.png"
          alt=""
          aria-hidden="true"
        />

        <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 48, position: 'relative', zIndex: 5 }}>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ fontSize: 12, color: '#C8F04B', fontWeight: 700, letterSpacing: '2px', fontFamily: 'Inter, sans-serif' }}>TUDO NO CONTROLE</span>
              <h2 style={{ fontSize: 48, lineHeight: '52px', color: '#F2F6F0', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", maxWidth: 660, margin: 0 }}>Tudo que sua arena precisa, em um só lugar.</h2>
              <p style={{ fontSize: 16, lineHeight: '24px', color: '#8E9F94', maxWidth: 520, margin: 0, fontFamily: 'Inter, sans-serif' }}>Recursos que já fazem parte do CourtManager e acompanham a operação do início ao fim.</p>
            </div>
            <span style={{ fontSize: 14, color: '#C8F04B', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Do agendamento ao relatório &rarr;</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ width: '100%', height: 240, display: 'flex', flexDirection: 'row', gap: 20 }}>
              {FEATURES.slice(0, 3).map((f) => <FeatureCardComp key={f.title} f={f} />)}
            </div>
            <div style={{ width: '100%', height: 240, display: 'flex', flexDirection: 'row', gap: 20 }}>
              {FEATURES.slice(3, 6).map((f) => <FeatureCardComp key={f.title} f={f} />)}
            </div>
          </div>
        </div>
      </section>

      {/* Stats — faixa verde-limão */}
      <section style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '64px 32px', background: '#C8F04B', position: 'relative', zIndex: 14 }}>
        <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 50, color: '#0E1512', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap', lineHeight: 1 }}>{s.value}</span>
              <span style={{ fontSize: 14, color: '#273815', fontWeight: 500, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing — com bola de basquete sangrando e sobrepondo a faixa verde de estatísticas */}
      <section style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '96px 32px 104px', background: '#0B130F', position: 'relative', zIndex: 15 }}>
        {/* Basquete: pequena sobreposição na faixa verde, antes dos planos. */}
        <img
          className="landing-ball landing-ball--basketball"
          src="/images/ball-basketball.png"
          alt=""
          aria-hidden="true"
        />

        <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, position: 'relative', zIndex: 5 }}>
          <span style={{ fontSize: 11, color: '#C8F04B', fontWeight: 700, letterSpacing: '2px', fontFamily: 'Inter, sans-serif' }}>PLANOS</span>
          <h2 style={{ fontSize: 48, color: '#F2F6F0', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap', margin: 0 }}>Simples e transparente</h2>
          <p style={{ fontSize: 16, lineHeight: '24px', color: '#8E9F94', textAlign: 'center', maxWidth: 560, margin: 0, fontFamily: 'Inter, sans-serif' }}>Sem taxas por reserva. Sem surpresas. Cancele quando quiser.</p>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4, background: '#122019', outline: '1px solid #1E3327', borderRadius: 9999, marginTop: 8 }}>
            <button onClick={() => setAnnual(false)} style={{ height: 36, padding: '0 20px', borderRadius: 9999, background: !annual ? '#C8F04B' : 'transparent', color: !annual ? '#0E1512' : '#8E9F94', fontSize: 13, fontWeight: 800, fontFamily: 'Inter, sans-serif', border: 'none', cursor: 'pointer' }}>Mensal</button>
            <button onClick={() => setAnnual(true)} style={{ height: 36, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 7, borderRadius: 9999, background: annual ? '#C8F04B' : 'transparent', color: annual ? '#0E1512' : '#8E9F94', fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif', border: 'none', cursor: 'pointer' }}>
              Anual
              <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', background: annual ? '#0E1512' : '#1D3B2C', color: '#C8F04B', borderRadius: 9999 }}>-20%</span>
            </button>
          </div>
          <div style={{ width: '100%', height: 500, display: 'flex', flexDirection: 'row', gap: 20, marginTop: 16 }}>
            {PLANS.map((p) => (
              <PricingCard
                key={p.name}
                plan={p}
                annual={annual}
                onAction={() => {
                  if (p.name === 'Empresa') {
                    window.open(enterpriseContactUrl, '_blank');
                  } else {
                    navigate('/cadastro');
                  }
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: 13, color: '#8E9F94', textAlign: 'center', margin: '24px 0 0', fontFamily: 'Inter, sans-serif' }}>
            Todos os planos incluem 14 dias grátis. Sem fidelidade. Cancele direto pelo painel.
          </p>
        </div>
      </section>

      {/* CTA Section — Pronto para organizar sua arena? */}
      <section style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '110px 32px 120px', background: '#080E0B', backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 120%, #163323 0%, #080E0B 100%)', position: 'relative', zIndex: 16 }}>
        {/* Tênis: sobrepõe o início da chamada final. */}
        <img
          className="landing-ball landing-ball--tennis"
          src="/images/ball-tennis.png"
          alt=""
          aria-hidden="true"
        />

        <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20, position: 'relative', zIndex: 5 }}>
          <span style={{ fontSize: 11, color: '#C8F04B', fontWeight: 700, letterSpacing: '2px', fontFamily: 'Inter, sans-serif' }}>
            COMECE AGORA
          </span>
          <h2 style={{ fontSize: 50, lineHeight: '54px', color: '#F2F6F0', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", maxWidth: 680, margin: 0 }}>
            Pronto para organizar sua arena?
          </h2>
          <p style={{ fontSize: 17, lineHeight: '28px', color: '#8E9F94', maxWidth: 540, margin: 0, fontFamily: 'Inter, sans-serif' }}>
            Cadastre-se em 2 minutos e experimente gratuitamente por 14 dias. Sem cartão de crédito.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}>
            <button onClick={() => navigate('/cadastro')} style={{ padding: '16px 36px', background: '#C8F04B', color: '#0E1512', fontSize: 15, fontWeight: 700, borderRadius: 12, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>
              Criar conta grátis
            </button>
            <button onClick={() => window.open(enterpriseContactUrl, '_blank')} style={{ padding: '16px 36px', background: 'transparent', color: '#F2F6F0', fontSize: 15, fontWeight: 600, borderRadius: 12, outline: '1px solid #203B2B', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>
              Falar com vendas
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '64px 32px 40px', background: '#050907', borderTop: '1px solid #16261D', position: 'relative', zIndex: 17 }}>
        <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 48 }}>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Brand */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 280 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 26, height: 26, background: '#C8F04B', borderRadius: 7 }} />
                <span style={{ fontSize: 19, color: '#F2F6F0', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>CourtManager</span>
              </div>
              <p style={{ fontSize: 13, lineHeight: '20px', color: '#6A7D72', margin: 0, fontFamily: 'Inter, sans-serif' }}>
                Gestão completa de quadras esportivas. Do agendamento ao recebimento.
              </p>
            </div>

            {/* Links 1 - Produto */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#F2F6F0', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>Produto</span>
              {['Funcionalidades', 'Preços', 'Entrar como Arena', 'Criar conta'].map((l) => (
                <span key={l} onClick={() => { if (l === 'Entrar como Arena') navigate('/login'); if (l === 'Criar conta') navigate('/cadastro'); }} style={{ fontSize: 13, color: '#6A7D72', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{l}</span>
              ))}
            </div>

            {/* Links 2 - Contato */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#F2F6F0', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>Contato</span>
              <span onClick={() => window.open(enterpriseContactUrl, '_blank')} style={{ fontSize: 13, color: '#6A7D72', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Suporte técnico</span>
              <span onClick={() => window.open(enterpriseContactUrl, '_blank')} style={{ fontSize: 13, color: '#6A7D72', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Vendas</span>
              <span style={{ fontSize: 13, color: '#6A7D72', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Central de Ajuda</span>
            </div>

            {/* Links 3 - Legal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#F2F6F0', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>Legal</span>
              {['Termos de Uso', 'Política de Privacidade', 'LGPD'].map((l) => (
                <span key={l} style={{ fontSize: 13, color: '#6A7D72', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{l}</span>
              ))}
            </div>
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, borderTop: '1px solid #111D16' }}>
            <span style={{ fontSize: 12, color: '#4E6055', fontFamily: 'Inter, sans-serif' }}>
              CourtManager &copy; {new Date().getFullYear()} — Todos os direitos reservados
            </span>
            <span style={{ fontSize: 12, color: '#4E6055', fontFamily: 'Inter, sans-serif' }}>
              Feito para arenas brasileiras 🏐
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
