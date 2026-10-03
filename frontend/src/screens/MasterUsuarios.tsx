import type { SaaSArena, ManagedUser, AuditLog } from '../types/api';
import { MasterPageHeader as PageHeader } from '../components/MasterPageHeader';
import { apiFetch as fetch } from '../utils/apiFetch';
import { useMemo, useState, useEffect } from 'react';
import { KeyRound, Power, History, Download, Users } from 'lucide-react';
import { Card, Badge, Modal, ConfirmModal, Input, Select, EmptyState, Button } from '../components/ui';
import { MasterPagination } from '../components/MasterPagination';
import { exportMasterCsv } from '../utils/masterExport';
import { formatDateTime } from '../data/mock';

const PAGE_SIZE = 6;

export function MasterUsuarios() {
  const [search, setSearch] = useState('');
  const [arenaFilter, setArenaFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'desativado'>('all');
  const [page, setPage] = useState(1);
  
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [arenas, setArenas] = useState<SaaSArena[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [accessUser, setAccessUser] = useState<ManagedUser | null>(null);
  const [accessLogs, setAccessLogs] = useState<AuditLog[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  
  const [deactivateUser, setDeactivateUser] = useState<ManagedUser | null>(null);
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);

  const fetchUsuarios = async () => {
    try {
      const headers = {};
      
      const [usersRes, arenasRes] = await Promise.all([
        fetch('/api/saas/usuarios', { headers }).then(r => r.json()),
        fetch('/api/saas/arenas', { headers }).then(r => r.json())
      ]);

      const mappedUsers = (Array.isArray(usersRes) ? usersRes : []).map((u) => ({
        id: u.id,
        name: u.nome,
        email: u.email,
        role: u.role === 'Administrador' ? 'admin' : u.role === 'Gerente' ? 'gerente' : 'recepcionista',
        roleOriginal: u.role,
        status: u.ativo === 1 ? 'ativo' : 'desativado',
        arenaId: String(u.arenaId || ''),
        arenaName: u.arenaName || 'Master/SuperAdmin',
      }));

      setUsers(mappedUsers);
      setArenas(Array.isArray(arenasRes) ? arenasRes : []);
    } catch (e) {
      console.error('Erro ao buscar dados de usuários:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleOpenAccess = async (u: ManagedUser) => {
    setAccessUser(u);
    setLoadingAccess(true);
    setAccessLogs([]);
    try {
      const res = await fetch(`/api/saas/usuarios/${u.id}/acessos`, {
        headers: {}
      });
      const data = await res.json();
      setAccessLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAccess(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!deactivateUser) return;
    try {
      const res = await fetch(`/api/saas/usuarios/${deactivateUser.id}/status`, {
        method: 'PATCH',
        headers: {}
      });
      if (res.ok) {
        fetchUsuarios();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeactivateUser(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    try {
      const res = await fetch(`/api/saas/usuarios/${resetUser.id}/reset-senha`, {
        method: 'POST',
        headers: {}
      });
      if (res.ok) {
        alert('Link individual de redefinição enviado ao e-mail cadastrado.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setResetUser(null);
    }
  };

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (search && !`${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (arenaFilter !== 'all' && u.arenaId !== arenaFilter) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      return true;
    });
  }, [users, search, arenaFilter, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <div className="p-8 text-center text-charcoal animate-pulse">Carregando usuários...</div>;

  return (
    <div className="master-reference-page master-users-page">
      <PageHeader title="Usuários" description="Acessos e permissões de todas as arenas da plataforma" context={false} actions={<Button variant="ghost" onClick={() => exportMasterCsv('usuarios.csv', [['Nome', 'E-mail', 'Arena', 'Perfil', 'Status'], ...filtered.map(u => [u.name, u.email, u.arenaName, u.roleOriginal, u.status])])}><Download size={14} /> Exportar lista</Button>} />

      <section className="master-access-summary" aria-label="Resumo de usuários">
        <div className="master-access-total"><small><i /> REDE DE ACESSOS</small><strong>{users.length.toLocaleString('pt-BR')}</strong><span>usuários em {arenas.length} arenas</span></div>
        {[
          { label: 'ATIVOS', value: users.filter(u => u.status === 'ativo').length, note: (users.length ? (users.filter(u => u.status === 'ativo').length / users.length * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : 0) + '% da base' },
          { label: 'INATIVOS', value: users.filter(u => u.status !== 'ativo').length, note: (users.length ? (users.filter(u => u.status !== 'ativo').length / users.length * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : 0) + '% da base' },
          { label: 'GESTORES', value: users.filter(u => ['SuperAdmin', 'Administrador', 'Gerente'].includes(u.roleOriginal)).length, note: 'com acesso admin' },
          { label: 'ACESSOS HOJE', value: '—', note: 'Consulte os acessos na lista' },
        ].map(item => <div className="master-access-metric" key={item.label}><small>{item.label}</small><strong>{item.value.toLocaleString('pt-BR')}</strong><span>{item.note}</span></div>)}
      </section>
      <Card className="master-user-filters master-soft p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[250px]">
            <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div className="w-full sm:w-[170px]">
            <Select value={arenaFilter} onChange={(e) => { setArenaFilter(e.target.value); setPage(1); }}>
              <option value="all">Todas as arenas</option>
              {arenas.map((a) => <option key={a.id} value={String(a.id)}>{a.nome}</option>)}
            </Select>
          </div>
          <div className="w-full sm:w-[150px]">
            <Select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
              <option value="all">Todos os perfis</option>
              <option value="admin">Admin</option>
              <option value="gerente">Gerente</option>
              <option value="recepcionista">Recepcionista</option>
            </Select>
          </div>
          <div className="w-full sm:w-[150px]">
            <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value === 'ativo' ? 'ativo' : e.target.value === 'desativado' ? 'desativado' : 'all'); setPage(1); }}>
              <option value="all">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="desativado">Desativado</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="master-data-panel master-users-table overflow-hidden">
        <div className="master-table-heading"><strong><Users size={16} /> Todos os usuários <em>{filtered.length}</em></strong><span>Mostrando {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}</span></div>
        {pageItems.length === 0 ? (
          <EmptyState message="Nenhum usuário encontrado para os filtros aplicados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-cream/60 text-left text-xs text-muted uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Usuário</th>
                <th className="px-5 py-3 font-medium">Arena</th>
                <th className="px-5 py-3 font-medium">Perfil</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Último acesso</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr></thead>
              <tbody className="divide-y divide-border-passive">
                {pageItems.map((u) => (
                  <tr key={u.id} className="hover:bg-cream/50 transition-colors">
                    <td className="px-5 py-3"><div className="master-user-identity"><span className={`master-user-initials ${u.status !== 'ativo' ? 'is-inactive' : ''}`}>{u.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div><strong>{u.name}</strong><small>{u.email}</small></div></div></td>
                    <td className="px-5 py-3 text-muted">{u.arenaName}</td>
                    <td className="px-5 py-3"><span className="capitalize">{u.roleOriginal || u.role}</span></td>
                    <td className="px-5 py-3"><Badge status={u.status === 'ativo' ? 'ativo' : 'desativado'}>{u.status === 'ativo' ? '● Ativo' : '● Inativo'}</Badge></td>
                    <td className="px-5 py-3"><button className="master-access-link" onClick={() => handleOpenAccess(u)}>Consultar acessos</button></td>
                    <td className="px-5 py-3">
                      <div className="master-row-actions">
                        <button onClick={() => handleOpenAccess(u)} title="Últimos acessos" className="p-1.5 rounded-md text-muted hover:text-charcoal hover:bg-cream-surface transition-colors"><History size={15} /></button>
                        <button onClick={() => setResetUser(u)} title="Resetar senha" className="p-1.5 rounded-md text-muted hover:text-charcoal hover:bg-cream-surface transition-colors"><KeyRound size={15} /></button>
                        <button onClick={() => setDeactivateUser(u)} title={u.status === 'ativo' ? 'Desativar' : 'Ativar'} className={`p-1.5 rounded-md transition-colors ${u.status === 'ativo' ? 'text-warning hover:bg-warning-soft' : 'text-success hover:bg-success-soft'}`}><Power size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <MasterPagination page={page} totalPages={totalPages} onPage={setPage} label="6 usuários por página" />
      </Card>

      {/* Access history */}
      <Modal open={!!accessUser} onClose={() => setAccessUser(null)} title="Últimos acessos" description={accessUser?.email}>
        {loadingAccess ? (
          <div className="py-8 text-center text-charcoal animate-pulse">Carregando acessos...</div>
        ) : accessLogs.length === 0 ? (
          <EmptyState message="Nenhum log de acesso encontrado para este usuário." />
        ) : (
          <ol className="relative border-l border-border-passive ml-2 space-y-3">
            {accessLogs.map((l, i) => (
              <li key={i} className="pl-4">
                <span className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-charcoal/40 border-2 border-cream" />
                <div className="text-sm text-charcoal">{l.evento}</div>
                <div className="text-xs text-muted">{formatDateTime(l.criado_em)} · IP: {l.ip || 'Desconhecido'} {l.detalhes ? `· ${l.detalhes}` : ''}</div>
              </li>
            ))}
          </ol>
        )}
      </Modal>

      {/* Reset password */}
      <ConfirmModal open={!!resetUser} onClose={() => setResetUser(null)} onConfirm={handleResetPassword}
        title="Resetar senha do usuário" destructive confirmLabel="Gerar senha temporária"
        message={<>A senha de <strong>{resetUser?.name}</strong> será redefinida para o valor padrão <strong>arena123</strong>. O usuário poderá alterar após acessar.</>}
      />

      {/* Deactivate */}
      <ConfirmModal open={!!deactivateUser} onClose={() => setDeactivateUser(null)} onConfirm={handleToggleStatus}
        title={deactivateUser?.status === 'ativo' ? 'Desativar usuário?' : 'Reativar usuário?'}
        destructive={deactivateUser?.status === 'ativo'}
        confirmLabel={deactivateUser?.status === 'ativo' ? 'Desativar' : 'Reativar'}
        message={deactivateUser?.status === 'ativo'
          ? <>A conta de <strong>{deactivateUser.name}</strong> será desativada (sem exclusão). O usuário perde acesso imediato.</>
          : <>A conta de <strong>{deactivateUser?.name}</strong> será reativada.</>}
      />
    </div>
  );
}
