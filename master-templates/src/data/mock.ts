// Mock data for the CourtManager Master Panel. Rich enough to exercise filters,
// pagination, modals, and empty states across all screens.

export type ArenaStatus = 'ativa' | 'bloqueada' | 'trial';
export type FinanceStatus = 'pago' | 'pendente' | 'atrasado';
export type Plan = 'Basic' | 'Pro' | 'Enterprise';
export type UserRole = 'admin' | 'gerente' | 'recepcionista';

export interface Arena {
  id: string;
  name: string;
  city: string;
  state: string;
  plan: Plan;
  status: ArenaStatus;
  createdAt: string; // ISO
  finance: FinanceStatus;
  courts: number;
  users: number;
  mrr: number;
  email: string;
  phone: string;
  address: string;
  adminName: string;
  trialEndsAt?: string;
  lastLogin?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  arenaId: string;
  arenaName: string;
  role: UserRole;
  status: 'ativo' | 'desativado';
  lastAccess?: string;
}

export interface Invoice {
  id: string;
  arenaId: string;
  month: string; // '2026-06'
  amount: number;
  status: 'pago' | 'pendente' | 'atrasado';
  paidAt?: string;
  method?: 'cartao' | 'boleto' | 'pix' | 'manual';
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  arenaId?: string;
  arenaName?: string;
  at: string;
  ip: string;
}

export interface Banner {
  id: string;
  message: string;
  audience: 'all' | string; // arenaId or 'all'
  audienceLabel: string;
  channel: 'email' | 'alerta';
  createdAt: string;
  expiresAt: string;
  scheduledAt?: string;
  active: boolean;
}

export interface PlanDef {
  id: Plan;
  courtLimit: number;
  userLimit: number;
  price: number;
  description: string;
}

export const PLANS: PlanDef[] = [
  { id: 'Basic', courtLimit: 3, userLimit: 5, price: 199, description: 'Para arenas pequenas começando no digital.' },
  { id: 'Pro', courtLimit: 10, userLimit: 15, price: 499, description: 'O mais popular. Operação completa de reservas.' },
  { id: 'Enterprise', courtLimit: 40, userLimit: 50, price: 1299, description: 'Para redes e arenas com alta volumetria.' },
];

const cities: [string, string][] = [
  ['São Paulo', 'SP'], ['Rio de Janeiro', 'RJ'], ['Belo Horizonte', 'MG'],
  ['Curitiba', 'PR'], ['Porto Alegre', 'RS'], ['Recife', 'PE'],
  ['Fortaleza', 'CE'], ['Brasília', 'DF'], ['Salvador', 'BA'],
  ['Florianópolis', 'SC'], ['Campinas', 'SP'], ['Goiânia', 'GO'],
];

const arenaNames = [
  'Arena Vôlei Sul', 'Quadra Top SP', 'Play Sports Center', 'Arena Saquarema',
  'Vôlei Praia Club', 'Centro Esportivo Norte', 'Arena Litoral', 'Quadras do Otto',
  'Sports Hub BH', 'Arena Horizonte', 'Maringá Tênis', 'Arena Bela Vista',
  'Court Master', 'Arena Central', 'Vila Mariana Sports', 'Arena Pinheiros',
  'Tennis Club POA', 'Arena Sul Brasil', 'Norte Esporte', 'Arena Pampulha',
  'Centro Olímpico Recife', 'Arena Boa Viagem', 'Quadra do Tatu', 'Arena Cerrado',
  'Sports Square', 'Arena Laguna', 'Costa Esportiva', 'Arena Maré',
];

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const r = rand(42);

function pick<T>(arr: T[]): T { return arr[Math.floor(r() * arr.length)]; }
function isoDaysAgo(days: number) { return new Date(Date.now() - days * 86400000).toISOString(); }
function isoDaysFromNow(days: number) { return new Date(Date.now() + days * 86400000).toISOString(); }
function monthLabel(offset: number) {
  const d = new Date(Date.now() + offset * 30 * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const ARENAS: Arena[] = arenaNames.map((name, i) => {
  const [city, state] = pick(cities);
  const plan = pick<Plan>(['Basic', 'Pro', 'Pro', 'Enterprise']);
  const status = pick<ArenaStatus>(['ativa', 'ativa', 'ativa', 'trial', 'bloqueada']);
  const finance: FinanceStatus =
    status === 'bloqueada' ? 'atrasado' : pick<FinanceStatus>(['pago', 'pago', 'pago', 'pendente', 'atrasado']);
  const courts = plan === 'Basic' ? 1 + Math.floor(r() * 3) : plan === 'Pro' ? 4 + Math.floor(r() * 7) : 12 + Math.floor(r() * 28);
  const users = 2 + Math.floor(r() * (plan === 'Basic' ? 5 : plan === 'Pro' ? 15 : 50));
  const mrr = plan === 'Basic' ? 199 : plan === 'Pro' ? 499 : 1299;
  return {
    id: `arn_${String(i + 1).padStart(3, '0')}`,
    name,
    city,
    state,
    plan,
    status,
    createdAt: isoDaysAgo(Math.floor(r() * 720) + 5),
    finance,
    courts,
    users,
    mrr,
    email: `contato@${name.toLowerCase().replace(/[^a-z]/g, '')}.com.br`,
    phone: `(1${1 + Math.floor(r() * 8)}) 9${1000 + Math.floor(r() * 8999)}-${1000 + Math.floor(r() * 8999)}`,
    address: `Rua ${pick(['das', 'dos', 'do'])} ${pick(['Pinheiros', 'Seringueiros', 'Ipês', 'Goiás', 'Maracanã', 'Palmas'])}, ${10 + Math.floor(r() * 900)}`,
    adminName: pick(['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Reis', 'Elisa Nogueira', 'Felipe Mota']),
    trialEndsAt: status === 'trial' ? isoDaysFromNow(Math.floor(r() * 14) + 1) : undefined,
    lastLogin: isoDaysAgo(Math.floor(r() * 30)),
  };
});

export const USERS: User[] = ARENAS.flatMap((a, ai) => {
  const roles: UserRole[] = ['admin', 'gerente', 'recepcionista'];
  const count = 2 + Math.floor(r() * 4);
  return Array.from({ length: count }, (_, i) => {
    const role = i === 0 ? 'admin' : pick(roles);
    return {
      id: `usr_${ai}_${i}`,
      name: pick(['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Reis', 'Elisa Nogueira', 'Felipe Mota', 'Gisele Prado', 'Hugo Tavares', 'Iara Brito', 'João Peixoto']),
      email: `usuario${i}@${a.name.toLowerCase().replace(/[^a-z]/g, '')}.com.br`,
      arenaId: a.id,
      arenaName: a.name,
      role,
      status: r() > 0.12 ? 'ativo' : 'desativado',
      lastAccess: isoDaysAgo(Math.floor(r() * 60)),
    };
  });
});

export const INVOICES: Invoice[] = ARENAS.flatMap((a) =>
  Array.from({ length: 6 }, (_, i) => {
    const offset = -i;
    const status: Invoice['status'] =
      i === 0 ? a.finance : pick<Invoice['status']>(['pago', 'pago', 'pago', 'pendente']);
    return {
      id: `inv_${a.id}_${offset}`,
      arenaId: a.id,
      month: monthLabel(offset),
      amount: a.mrr,
      status,
      paidAt: status === 'pago' ? isoDaysAgo(i * 28 + Math.floor(r() * 10)) : undefined,
      method: status === 'pago' ? pick(['cartao', 'boleto', 'pix', 'manual']) : undefined,
    };
  }),
);

export const AUDIT: AuditEntry[] = [
  { id: 'a1', actor: 'master@courtmanager.com', action: 'Bloqueou arena', target: a(0), arenaId: ARENAS[0].id, arenaName: ARENAS[0].name, at: isoDaysAgo(0.02), ip: '200.143.0.10' },
  { id: 'a2', actor: 'master@courtmanager.com', action: 'Editou plano Pro', target: 'Pro', at: isoDaysAgo(0.3), ip: '200.143.0.10' },
  { id: 'a3', actor: 'master@courtmanager.com', action: 'Resetou senha de usuário', target: USERS[2].email, arenaId: USERS[2].arenaId, arenaName: USERS[2].arenaName, at: isoDaysAgo(1.2), ip: '200.143.0.10' },
  { id: 'a4', actor: 'master@courtmanager.com', action: 'Ativou modo manutenção', target: 'global', at: isoDaysAgo(3), ip: '200.143.0.10' },
  { id: 'a5', actor: 'master@courtmanager.com', action: 'Inspecionou arena', target: a(1), arenaId: ARENAS[1].id, arenaName: ARENAS[1].name, at: isoDaysAgo(4.5), ip: '200.143.0.10' },
  { id: 'a6', actor: 'master@courtmanager.com', action: 'Cadastrou arena manualmente', target: a(2), arenaId: ARENAS[2].id, arenaName: ARENAS[2].name, at: isoDaysAgo(6), ip: '200.143.0.10' },
  { id: 'a7', actor: 'master@courtmanager.com', action: 'Enviou broadcast', target: 'Todas as arenas', at: isoDaysAgo(9), ip: '200.143.0.10' },
  { id: 'a8', actor: 'master@courtmanager.com', action: 'Registrou pagamento manual', target: a(3), arenaId: ARENAS[3].id, arenaName: ARENAS[3].name, at: isoDaysAgo(12), ip: '200.143.0.10' },
];
function a(i: number) { return ARENAS[i].name; }

export const BANNERS: Banner[] = [
  { id: 'b1', message: 'Manutenção programada neste sábado das 02h às 04h.', audience: 'all', audienceLabel: 'Todas as arenas', channel: 'alerta', createdAt: isoDaysAgo(2), expiresAt: isoDaysFromNow(3), active: true },
  { id: 'b2', message: 'Novo relatório de ocupação disponível no painel.', audience: ARENAS[1].id, audienceLabel: ARENAS[1].name, channel: 'email', createdAt: isoDaysAgo(5), expiresAt: isoDaysFromNow(9), active: true },
];

// Monthly new arenas for the growth chart (last 12 months)
export const GROWTH: { month: string; count: number }[] = (() => {
  const out: { month: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.now() - i * 30 * 86400000);
    out.push({ month: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`, count: 3 + Math.floor((12 - i) / 2) + Math.floor(r() * 4) });
  }
  return out;
})();

// Simplified billing history (last 6 months revenue)
export const REVENUE_HISTORY: { month: string; mrr: number }[] = (() => {
  const out: { month: string; mrr: number }[] = [];
  let base = 28000;
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.now() - i * 30 * 86400000);
    base = Math.round(base * (1.04 + r() * 0.05));
    out.push({ month: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`, mrr: base });
  }
  return out;
})();

export const ACTIVE_SESSIONS: { arenaId: string; arenaName: string; users: number; since: string }[] = ARENAS
  .filter(() => r() > 0.5)
  .slice(0, 8)
  .map((a) => ({ arenaId: a.id, arenaName: a.name, users: 1 + Math.floor(r() * 4), since: isoDaysAgo(r() * 0.2) }));

export const CANCELLATION_REASONS = [
  'Mudança para outra plataforma',
  'Custo elevado',
  'Encerramento da atividade',
  'Insatisfação com o produto',
  'Não utilizou após o trial',
  'Outro',
];

export const SYSTEM_VERSION = 'v3.4.2 — build 2026.07.18';

export function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
export function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function formatDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function relativeTime(iso?: string) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}
