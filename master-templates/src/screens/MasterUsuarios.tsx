import { useMemo, useState } from 'react';
import { KeyRound, Power, History } from 'lucide-react';
import { Card, Badge, PageHeader, Modal, ConfirmModal, Input, Select, EmptyState, Pagination } from '../components/ui';
import { USERS, ARENAS, formatDateTime, type UserRole } from '../data/mock';

const PAGE_SIZE = 10;

export function MasterUsuarios() {
  const [search, setSearch] = useState('');
  const [arenaFilter, setArenaFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'desativado'>('all');
  const [page, setPage] = useState(1);
  const [accessUser, setAccessUser] = useState<typeof USERS[number] | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<typeof USERS[number] | null>(null);
  const [resetUser, setResetUser] = useState<typeof USERS[number] | null>(null);

  const filtered = useMemo(() => {
    return USERS.filter((u) => {
      if (search && !`${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (arenaFilter !== 'all' && u.arenaId !== arenaFilter) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      return true;
    });
  }, [search, arenaFilter, roleFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <PageHeader title="Usuários" description="Todos os usuários de todas as arenas da plataforma." />

      <Card className="p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={arenaFilter} onChange={(e) => { setArenaFilter(e.target.value); setPage(1); }} className="w-auto min-w-[160px]">
            <option value="all">Todas as arenas</option>
            {ARENAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value as any); setPage(1); }} className="w-auto min-w-[130px]">
            <option value="all">Todos os perfis</option>
            <option value="admin">Admin</option>
            <option value="gerente">Gerente</option>
            <option value="recepcionista">Recepcionista</option>
          </Select>
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }} className="w-auto min-w-[130px]">
            <option value="all">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="desativado">Desativado</option>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {pageItems.length === 0 ? (
          <EmptyState message="Nenhum usuário encontrado para os filtros aplicados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-cream/60 text-left text-xs text-muted uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">E-mail</th>
                <th className="px-5 py-3 font-medium">Arena</th>
                <th className="px-5 py-3 font-medium">Perfil</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr></thead>
              <tbody className="divide-y divide-border-passive">
                {pageItems.map((u) => (
                  <tr key={u.id} className="hover:bg-cream/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-charcoal">{u.name}</td>
                    <td className="px-5 py-3 text-muted">{u.email}</td>
                    <td className="px-5 py-3 text-muted">{u.arenaName}</td>
                    <td className="px-5 py-3"><span className="capitalize">{u.role}</span></td>
                    <td className="px-5 py-3"><Badge status={u.status}>{u.status}</Badge></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => setAccessUser(u)} title="Últimos acessos" className="p-1.5 rounded-md text-muted hover:text-charcoal hover:bg-cream-surface transition-colors"><History size={15} /></button>
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
        <div className="p-3 border-t border-border-passive">
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </div>
      </Card>

      {/* Access history */}
      <Modal open={!!accessUser} onClose={() => setAccessUser(null)} title="Últimos acessos" description={accessUser?.email}>
        <ol className="relative border-l border-border-passive ml-2 space-y-3">
          {accessUser && Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="pl-4">
              <span className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-charcoal/40 border-2 border-cream" />
              <div className="text-sm text-charcoal">Login bem-sucedido</div>
              <div className="text-xs text-muted">{formatDateTime(accessUser.lastAccess)} · 200.143.0.{10 + i}</div>
            </li>
          ))}
        </ol>
      </Modal>

      {/* Reset password */}
      <ConfirmModal open={!!resetUser} onClose={() => setResetUser(null)} onConfirm={() => setResetUser(null)}
        title="Resetar senha do usuário" destructive confirmLabel="Gerar senha temporária"
        message={<>Será gerada uma senha temporária para <strong>{resetUser?.name}</strong> e enviada por e-mail. O usuário precisará redefini-la no próximo acesso.</>}
      />

      {/* Deactivate */}
      <ConfirmModal open={!!deactivateUser} onClose={() => setDeactivateUser(null)} onConfirm={() => setDeactivateUser(null)}
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
