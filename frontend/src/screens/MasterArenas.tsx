import { getArenaPortalUrl } from '../utils/arenaPortal';
import { DatePicker } from '../components/ui/date-picker';
import { useCallback } from 'react';
import type { SaaSArena, SaaSPlan } from '../types/api';
import { MasterPageHeader as PageHeader } from '../components/MasterPageHeader';
import { apiFetch as fetch } from '../utils/apiFetch';
import { useMemo, useState, useEffect } from 'react';
import { Plus, Eye, Search, Bell, RotateCcw, Ban, CheckCircle, Trash2, Filter, ChevronDown, Globe } from 'lucide-react';
import { Card, Badge, Button, Modal, ConfirmModal, Field, Input, Select, EmptyState } from '../components/ui';
import { MasterPagination } from '../components/MasterPagination';
import { formatDate, formatBRL } from '../data/mock';

interface Props { onNavigate: (id: string) => void; }

const PAGE_SIZE = 7;

export function MasterArenas({ onNavigate }: Readonly<Props>) {
  const [arenas, setArenas] = useState<SaaSArena[]>([]);
  const [planosSaaS, setPlanosSaaS] = useState<SaaSPlan[]>([]);
  const [, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [trialFilter, setTrialFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState<'all' | string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newArena, setNewArena] = useState({
    nome: '',
    email: '',
    telefone: '',
    endereco: '',
    plano_id: ''
  });

  const [deleteTarget, setDeleteTarget] = useState<SaaSArena | null>(null);
  const [blockTarget, setBlockTarget] = useState<SaaSArena | null>(null);

  const fetchArenas = useCallback(async () => {
    try {
      setLoading(true);
      const [resArenas, resPlanos] = await Promise.all([
        fetch('/api/saas/arenas', { headers: {} }),
        fetch('/api/saas/planos', { headers: {} })
      ]);
      const dataArenas = await resArenas.json();
      const dataPlanos = await resPlanos.json();
      setArenas(dataArenas);
      setPlanosSaaS(dataPlanos);
      if (dataPlanos.length > 0) {
        setNewArena(prev => ({ ...prev, plano_id: prev.plano_id || String(dataPlanos[0].id) }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [] );

  useEffect(() => {
    fetchArenas();
  }, [fetchArenas]);

  const handleCreateArena = async () => {
    if (!newArena.nome || !newArena.email) {
      alert('Nome da arena e e-mail do responsável são obrigatórios.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/saas/arenas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newArena)
      });
      if (res.ok) {
        const cadastro = await res.json();
        if (cadastro.email_enviado === false) {
          alert('Arena cadastrada, mas o convite não foi enviado. O responsável pode solicitar um novo link em “Esqueci minha senha” na tela de acesso. Não é necessário cadastrar novamente.');
        }
        setCreateOpen(false);
        setNewArena({
          nome: '',
          email: '',
          telefone: '',
          endereco: '',
          plano_id: planosSaaS[0] ? String(planosSaaS[0].id) : '1'
        });
        fetchArenas();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error || 'Erro ao cadastrar arena.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao cadastrar arena.');
    } finally {
      setCreating(false);
    }
  };

  const filtered = useMemo(() => {
    return arenas.filter((a) => {
      if (search && !`${a.nome} ${a.email}`.toLowerCase().includes(search.toLowerCase())) return false;
      const st = a.status === 1 ? 'ativa' : a.status === 0 ? 'bloqueada' : 'excluida';
      if (statusFilter === 'trial' ? !a.em_trial : statusFilter !== 'all' && st !== statusFilter) return false;
      if (trialFilter !== 'all' && Boolean(a.em_trial) !== (trialFilter === 'trial')) return false;
      if (planFilter !== 'all' && String(a.plano_id) !== planFilter) return false;
      if (dateFrom && new Date(a.criado_em) < new Date(dateFrom)) return false;
      if (dateTo && new Date(a.criado_em) > new Date(dateTo)) return false;
      return true;
    });
  }, [arenas, search, statusFilter, trialFilter, planFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="master-reference-page master-arenas-page">
      <PageHeader
        title="Arenas"
        description="Gerencie cada operação da rede em um só lugar" context={false}
        actions={
          <><button className="master-header-icon" aria-label="Abrir comunicação" onClick={() => onNavigate('comunicacao')}><Bell size={16} /></button><span className="master-context"><i /> Gestão de arenas</span><Button variant="primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> Cadastrar arena</Button></>
        }
      />

      <section className="master-arena-search">
        <div className="master-search-row"><label className="master-search-box"><Search size={18} /><span><input aria-label="Buscar arena por nome ou e-mail" placeholder="Buscar por nome ou e-mail" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></span></label><Button variant="primary" onClick={() => setShowFilters(s => !s)} aria-expanded={showFilters}><Filter size={14} /> Filtros</Button></div>
        <div className="master-arena-filter-row">
          <Select aria-label="Status da arena" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}><option value="all">Todos os status</option><option value="ativa">Ativa</option><option value="bloqueada">Bloqueada</option></Select>
          <Select aria-label="Período de teste" value={trialFilter} onChange={e => { setTrialFilter(e.target.value); setPage(1); }}><option value="all">Período de teste</option><option value="trial">Em teste</option><option value="regular">Fora do teste</option></Select>
          <Select aria-label="Plano da arena" value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }}><option value="all">Todos os planos</option>{planosSaaS.map(p => <option key={p.id} value={String(p.id)}>{p.nome}</option>)}</Select>
          <button className="master-date-filter" onClick={() => setShowFilters(s => !s)} aria-expanded={showFilters}>Data de cadastro <ChevronDown size={12} /></button>
          <button className="master-clear-filter" onClick={() => { setSearch(''); setStatusFilter('all'); setTrialFilter('all'); setPlanFilter('all'); setDateFrom(''); setDateTo(''); setPage(1); }}><RotateCcw size={13} /> Limpar</button>
        </div>
        {showFilters && <div className="master-date-range"><Field label="Criada de"><DatePicker className="input" value={dateFrom} onValueChange={value => { setDateFrom(value); setPage(1); }} /></Field><Field label="Criada até"><DatePicker className="input" value={dateTo} onValueChange={value => { setDateTo(value); setPage(1); }} /></Field></div>}
      </section>

      {/* Table */}
      <Card className="master-data-panel master-arena-table overflow-hidden">
        <div className="master-table-heading"><strong>Todas as arenas <em>{filtered.length}</em></strong><span>Mostrando {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}</span></div>
        {pageItems.length === 0 ? (
          <EmptyState message="Nenhuma arena encontrada para os filtros aplicados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream/60 text-left text-xs text-muted uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Arena</th>
                  <th className="px-4 py-3 font-medium">Responsável</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Datas</th>
                  <th className="px-4 py-3 font-medium">Saúde</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-passive">
                {pageItems.map((a) => {
                  const st = a.status === 1 ? (a.em_trial ? 'trial' : 'ativa') : a.status === 0 ? 'bloqueada' : 'excluida';
                  const fin = a.faturas_atrasadas > 0 ? 'atrasado' : 'pago';
                  const financeLabel: Record<string, string> = { pago: 'Em dia', pendente: 'Pendente', atrasado: 'Atrasado' };
                  const statusLabel: Record<string, string> = { ativa: 'Ativa', trial: 'Em teste', bloqueada: 'Bloqueada', excluida: 'Excluída' };
                  return (
                  <tr key={a.id} className="hover:bg-cream/50 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => onNavigate('arena-detalhe?id=' + a.id)} className="text-left">
                        <div className="font-medium text-charcoal hover:underline">{a.nome}</div>
                        <div className="text-xs text-muted">{a.endereco || 'Endereço não informado'}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted"><span>{a.email}</span></td>
                    <td className="px-4 py-3"><span className="text-charcoal font-medium">{a.plano_nome || 'Basic'}</span></td>
                    <td className="px-4 py-3"><Badge status={st === 'excluida' ? 'desativado' : st}>{statusLabel[st]}</Badge></td>
                    <td className="px-4 py-3 text-muted tabular"><div>Cadastro · {formatDate(a.criado_em)}</div><small>Vencimento · dia {a.dia_vencimento || '—'}</small></td>
                    <td className="px-4 py-3"><span className={`master-health ${fin === 'atrasado' ? 'is-overdue' : ''}`} title={a.gateway_conectado ? 'Mercado Pago conectado' : 'Mercado Pago pendente'}><i />{financeLabel[fin]}</span></td>
                    <td className="px-4 py-3">
                      <div className="master-row-actions">
                        {a.slug && (
                          <a href={getArenaPortalUrl(a.slug)} target="_blank" rel="noreferrer" title="Abrir portal da arena" className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors">
                            <Globe size={15} />
                          </a>
                        )}
                        <button onClick={() => onNavigate('arena-detalhe?id=' + a.id)} title="Ver detalhes" className="p-1.5 rounded-md text-muted hover:text-charcoal hover:bg-cream-surface transition-colors"><Eye size={15} /></button>
                        {a.status === 0 ? (
                          <button onClick={() => setBlockTarget(a)} title="Desbloquear" className="p-1.5 rounded-md text-success hover:bg-success-soft transition-colors"><CheckCircle size={15} /></button>
                        ) : (
                          <button onClick={() => setBlockTarget(a)} title="Bloquear" className="p-1.5 rounded-md text-warning hover:bg-warning-soft transition-colors"><Ban size={15} /></button>
                        )}
                        <button onClick={() => setDeleteTarget(a)} title="Excluir" className="p-1.5 rounded-md text-danger hover:bg-danger-soft transition-colors"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
        <MasterPagination page={page} totalPages={totalPages} onPage={setPage} label="7 arenas por página" />
      </Card>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Cadastrar nova arena" description="Cadastro manual sem passar pelo fluxo público."
        size="lg"
        footer={<><Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button variant="primary" disabled={creating} onClick={handleCreateArena}>{creating ? 'Cadastrando...' : 'Cadastrar arena'}</Button></>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome da arena *">
            <Input placeholder="Ex.: Arena Vôlei Sul" value={newArena.nome} onChange={(e) => setNewArena(prev => ({ ...prev, nome: e.target.value }))} />
          </Field>
          <Field label="E-mail do responsável *">
            <Input type="email" placeholder="contato@arena.com.br" value={newArena.email} onChange={(e) => setNewArena(prev => ({ ...prev, email: e.target.value }))} />
          </Field>
          <Field label="Telefone">
            <Input placeholder="(11) 90000-0000" value={newArena.telefone} onChange={(e) => setNewArena(prev => ({ ...prev, telefone: e.target.value }))} />
          </Field>
          <Field label="Endereço / Cidade">
            <Input placeholder="Rua, número, bairro, cidade" value={newArena.endereco} onChange={(e) => setNewArena(prev => ({ ...prev, endereco: e.target.value }))} />
          </Field>
          <Field label="Plano inicial *">
            <Select value={newArena.plano_id} onChange={(e) => setNewArena(prev => ({ ...prev, plano_id: e.target.value }))}>
              {planosSaaS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} — {p.valor_mensal > 0 ? `${formatBRL(p.valor_mensal)}/mês` : 'Sob consulta'} (Até {p.max_quadras} quadras)
                </option>
              ))}
            </Select>
          </Field>
          <p>O administrador receberá um convite por e-mail para ativar a conta e definir sua senha.</p>
          <p>O período de teste segue as configurações globais. A assinatura começa ao final do teste, com um ciclo completo e renovação no mesmo dia do mês.</p>
        </div>
      </Modal>

      {/* Block / unblock */}
      <ConfirmModal
        open={!!blockTarget}
        onClose={() => setBlockTarget(null)}
        onConfirm={async (password) => {
          if (!blockTarget) return;
          const res = await fetch(`/api/saas/arenas/${blockTarget.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: blockTarget.status === 0 ? 1 : 0, senha: password })
          });
          if (res.ok) {
            setBlockTarget(null);
            fetchArenas();
          } else {
            alert('Falha ao alterar status (senha incorreta?)');
          }
        }}
        title={blockTarget?.status === 0 ? 'Desbloquear arena?' : 'Bloquear arena?'}
        destructive={blockTarget?.status !== 0}
        message={blockTarget?.status === 0
          ? `A arena "${blockTarget?.nome}" voltará a funcionar normalmente. Os usuários poderão acessar o painel.`
          : `Ao bloquear "${blockTarget?.nome}", os usuários da arena percem acesso imediato ao painel até o desbloqueio.`}
        confirmLabel={blockTarget?.status === 0 ? 'Desbloquear' : 'Bloquear'}
        requirePassword
      />

      {/* Delete (soft) */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async (password) => {
          if (!deleteTarget) return;
          const res = await fetch(`/api/saas/arenas/${deleteTarget.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senha_master: password })
          });
          if (res.ok) {
            setDeleteTarget(null);
            fetchArenas();
          } else {
            alert('Falha ao excluir arena (senha incorreta?)');
          }
        }}
        title="Excluir arena"
        destructive
        requirePassword
        confirmLabel="Excluir"
        message={<>Você está prestes a excluir <strong>{deleteTarget?.nome}</strong>. Esta é uma exclusão lógica (soft-delete): os dados são preservados mas a arena deixa de aparecer na plataforma. Esta ação fica registrada em auditoria.</>}
      />
    </div>
  );
}
