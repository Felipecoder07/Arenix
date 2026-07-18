import { useState } from 'react';
import { Ban, CheckCircle, Pencil, Trash2, ShieldAlert, FileText, Wallet, Users, History, ArrowLeft } from 'lucide-react';
import { Card, Badge, Button, PageHeader, ConfirmModal, Field, Input, Select, EmptyState } from '../components/ui';
import { ARENAS, USERS, INVOICES, AUDIT, formatDate, formatBRL, formatDateTime, relativeTime, type Arena } from '../data/mock';

interface Props { onNavigate: (id: string) => void; }

type Tab = 'dados' | 'financeiro' | 'usuarios' | 'logs';
const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'dados', label: 'Dados cadastrais', icon: FileText },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
  { id: 'usuarios', label: 'Usuários da arena', icon: Users },
  { id: 'logs', label: 'Logs de auditoria', icon: History },
];

export function MasterArenaDetalhe({ onNavigate }: Props) {
  const arena: Arena = ARENAS[1];
  const [tab, setTab] = useState<Tab>('dados');
  const [blockOpen, setBlockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const arenaUsers = USERS.filter((u) => u.arenaId === arena.id);
  const arenaInvoices = INVOICES.filter((i) => i.arenaId === arena.id);
  const arenaLogs = AUDIT.filter((l) => l.arenaId === arena.id);

  const statusLabel = { ativa: 'Ativa', bloqueada: 'Bloqueada', trial: 'Trial' }[arena.status];

  return (
    <div>
      <button onClick={() => onNavigate('arenas')} className="inline-flex items-center gap-1 text-sm text-muted hover:text-charcoal mb-3 transition-colors">
        <ArrowLeft size={14} /> Voltar para arenas
      </button>

      <PageHeader
        title={arena.name}
        description={`${arena.city}/${arena.state} · cadastrada em ${formatDate(arena.createdAt)}`}
        actions={
          <>
            <Badge status={arena.status}>{statusLabel}</Badge>
            <Badge status="neutral">Plano {arena.plan}</Badge>
            <Button variant="secondary" onClick={() => setEditing((e) => !e)}><Pencil size={14} /> {editing ? 'Concluir' : 'Editar'}</Button>
            {arena.status === 'bloqueada' ? (
              <Button variant="primary" onClick={() => setBlockOpen(true)}><CheckCircle size={14} /> Desbloquear</Button>
            ) : (
              <Button variant="warning" onClick={() => setBlockOpen(true)}><Ban size={14} /> Bloquear</Button>
            )}
            <Button variant="danger" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Excluir</Button>
          </>
        }
      />

      {/* Inspection warning */}
      <div className="flex items-start gap-2.5 px-4 py-3 mb-5 rounded-xl bg-warning-soft border border-warning/20 text-sm">
        <ShieldAlert size={16} className="text-warning shrink-0 mt-0.5" />
        <div>
          <span className="font-medium text-warning">Modo inspeção ativo.</span>{' '}
          <span className="text-charcoal/80">Toda visualização desta arena pelo master fica registrada nos logs de auditoria da plataforma.</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border-passive overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t.id ? 'border-charcoal text-charcoal' : 'border-transparent text-muted hover:text-charcoal'
              }`}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'dados' && (
        <Card className="p-6 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Nome da arena"><Input defaultValue={arena.name} disabled={!editing} /></Field>
            <Field label="E-mail"><Input defaultValue={arena.email} disabled={!editing} /></Field>
            <Field label="Telefone"><Input defaultValue={arena.phone} disabled={!editing} /></Field>
            <Field label="Cidade / Estado"><Input defaultValue={`${arena.city} / ${arena.state}`} disabled={!editing} /></Field>
            <Field label="Endereço"><Input defaultValue={arena.address} disabled={!editing} /></Field>
            <Field label="Plano">
              <Select disabled={!editing} defaultValue={arena.plan}>
                <option>Basic</option><option>Pro</option><option>Enterprise</option>
              </Select>
            </Field>
            <Field label="Admin responsável"><Input defaultValue={arena.adminName} disabled /></Field>
            <Field label="Quadras cadastradas"><Input defaultValue={String(arena.courts)} disabled /></Field>
          </div>
          {editing && (
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border-passive">
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button variant="primary" onClick={() => setEditing(false)}>Salvar alterações</Button>
            </div>
          )}
        </Card>
      )}

      {tab === 'financeiro' && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-border-passive flex items-center justify-between">
            <h3 className="text-sm font-semibold">Histórico de pagamentos</h3>
            <Badge status={arena.finance}>{arena.finance}</Badge>
          </div>
          {arenaInvoices.length === 0 ? <EmptyState message="Sem faturas registradas." /> : (
            <table className="w-full text-sm">
              <thead><tr className="bg-cream/60 text-left text-xs text-muted uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Fatura</th>
                <th className="px-5 py-3 font-medium">Referência</th>
                <th className="px-5 py-3 font-medium">Valor</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Pago em</th>
                <th className="px-5 py-3 font-medium">Método</th>
              </tr></thead>
              <tbody className="divide-y divide-border-passive">
                {arenaInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-cream/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-muted">{inv.id}</td>
                    <td className="px-5 py-3 tabular">{inv.month}</td>
                    <td className="px-5 py-3 font-medium tabular">{formatBRL(inv.amount)}</td>
                    <td className="px-5 py-3"><Badge status={inv.status}>{inv.status}</Badge></td>
                    <td className="px-5 py-3 text-muted tabular">{formatDate(inv.paidAt)}</td>
                    <td className="px-5 py-3 text-muted">{inv.method || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'usuarios' && (
        <Card className="overflow-hidden">
          {arenaUsers.length === 0 ? <EmptyState message="Nenhum usuário vinculado a esta arena." /> : (
            <table className="w-full text-sm">
              <thead><tr className="bg-cream/60 text-left text-xs text-muted uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">E-mail</th>
                <th className="px-5 py-3 font-medium">Perfil</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Último acesso</th>
              </tr></thead>
              <tbody className="divide-y divide-border-passive">
                {arenaUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-cream/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-charcoal">{u.name}</td>
                    <td className="px-5 py-3 text-muted">{u.email}</td>
                    <td className="px-5 py-3"><span className="capitalize">{u.role}</span></td>
                    <td className="px-5 py-3"><Badge status={u.status}>{u.status}</Badge></td>
                    <td className="px-5 py-3 text-muted">{relativeTime(u.lastAccess)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'logs' && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Últimos acessos e ações nesta arena</h3>
          {arenaLogs.length === 0 ? <EmptyState message="Nenhum log registrado para esta arena." /> : (
            <ol className="relative border-l border-border-passive ml-2 space-y-4">
              {arenaLogs.map((l) => (
                <li key={l.id} className="pl-4">
                  <span className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-charcoal/40 border-2 border-cream" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-charcoal">{l.action}</span>
                    <span className="text-xs text-muted tabular">{formatDateTime(l.at)}</span>
                  </div>
                  <div className="text-xs text-muted mt-0.5">por {l.actor} · {l.ip}</div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

      <ConfirmModal open={blockOpen} onClose={() => setBlockOpen(false)} onConfirm={() => setBlockOpen(false)}
        title={arena.status === 'bloqueada' ? 'Desbloquear arena?' : 'Bloquear arena?'}
        destructive={arena.status !== 'bloqueada'}
        requirePassword
        confirmLabel={arena.status === 'bloqueada' ? 'Desbloquear' : 'Bloquear'}
        message={arena.status === 'bloqueada'
          ? `Os usuários de "${arena.name}" voltam a ter acesso ao painel.`
          : `Bloquear "${arena.name}" impede o acesso de todos os seus usuários até o desbloqueio.`}
      />
      <ConfirmModal open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={() => setDeleteOpen(false)}
        title="Excluir arena" destructive requirePassword confirmLabel="Excluir"
        message={<>Exclusão lógica de <strong>{arena.name}</strong>. Os dados são preservados; a arena deixa de aparecer na plataforma.</>}
      />
    </div>
  );
}
