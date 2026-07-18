import { useState, useEffect } from 'react';
import { ShieldCheck, Search, KeyRound, Activity, Lock } from 'lucide-react';
import { Card, Badge, Button, PageHeader, Field, Input, Select, EmptyState } from '../components/ui';
import { ACTIVE_SESSIONS, ARENAS, formatDateTime, relativeTime } from '../data/mock';

export function MasterAuditoria() {
  const [arenaSearch, setArenaSearch] = useState('');
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pw2fa, setPw2fa] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAuditoria = async () => {
      try {
        const token = localStorage.getItem('courtmanager_token');
        const res = await fetch('http://localhost:3000/api/saas/auditoria', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setAuditLogs(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAuditoria();
  }, []);

  const crossLogs = arenaSearch
    ? auditLogs.filter((l) => l.arena_nome?.toLowerCase().includes(arenaSearch.toLowerCase()))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Segurança & auditoria" description="Logs de ações do master, inspeção cruzada e sessões ativas." />

      {/* Master action log */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border-passive flex items-center gap-2">
          <ShieldCheck size={15} className="text-muted" />
          <h3 className="text-sm font-semibold">Log de ações do master</h3>
          <span className="text-xs text-muted ml-auto">Somente leitura · não editável</span>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-charcoal animate-pulse">Carregando logs...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-cream/90 backdrop-blur z-10 shadow-sm"><tr className="text-left text-xs text-muted uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Quando</th>
                <th className="px-5 py-3 font-medium">Ação</th>
                <th className="px-5 py-3 font-medium">Alvo (Detalhes)</th>
                <th className="px-5 py-3 font-medium">Arena</th>
                <th className="px-5 py-3 font-medium">IP</th>
                <th className="px-5 py-3 font-medium">Usuário (Admin)</th>
              </tr></thead>
              <tbody className="divide-y divide-border-passive">
                {auditLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-cream/50 transition-colors">
                    <td className="px-5 py-3 text-muted tabular">{formatDateTime(l.criado_em)}</td>
                    <td className="px-5 py-3 text-charcoal">{l.evento}</td>
                    <td className="px-5 py-3 text-muted">{l.detalhes}</td>
                    <td className="px-5 py-3 text-muted">{l.arena_nome || '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted">{l.ip}</td>
                    <td className="px-5 py-3 text-muted">{l.usuario_nome || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Cross inspection */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Search size={15} className="text-muted" />
          <h3 className="text-sm font-semibold">Inspeção cruzada — logs de uma arena</h3>
        </div>
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Input placeholder="Buscar pelo nome da arena..." value={arenaSearch} onChange={(e) => setArenaSearch(e.target.value)} />
          </div>
          <Select className="w-auto">
            <option value="">Todas as arenas</option>
            {ARENAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        {arenaSearch && crossLogs.length === 0 ? (
          <EmptyState message="Nenhum log encontrado para esta arena." />
        ) : arenaSearch ? (
          <ul className="divide-y divide-border-passive max-h-60 overflow-y-auto pr-2">
            {crossLogs.map((l) => (
              <li key={l.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm text-charcoal">{l.evento}</span>
                  <span className="text-xs text-muted ml-2">{l.detalhes}</span>
                </div>
                <span className="text-xs text-muted tabular">{relativeTime(l.criado_em)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Digite o nome de uma arena para consultar seus logs.</p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active sessions */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={15} className="text-muted" />
            <h3 className="text-sm font-semibold">Sessões ativas</h3>
            <Badge status="success">{ACTIVE_SESSIONS.length} arenas</Badge>
          </div>
          {ACTIVE_SESSIONS.length === 0 ? (
            <EmptyState message="Nenhuma sessão ativa no momento." />
          ) : (
            <ul className="space-y-2">
              {ACTIVE_SESSIONS.map((s) => (
                <li key={s.arenaId} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-cream/40 border border-border-passive">
                  <div>
                    <div className="text-sm font-medium text-charcoal">{s.arenaName}</div>
                    <div className="text-xs text-muted">{s.users} usuário(s) logado(s) · {relativeTime(s.since)}</div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-success pulse-dot" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Change own password */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound size={15} className="text-muted" />
            <h3 className="text-sm font-semibold">Alterar minha senha master</h3>
          </div>
          <div className="space-y-4">
            <Field label="Senha atual"><Input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} placeholder="••••••••" /></Field>
            <Field label="Nova senha"><Input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="••••••••" /></Field>
            <Field label="Segundo fator (código 2FA)" hint="Informe o código de 6 dígitos do app autenticador.">
              <Input type="text" inputMode="numeric" maxLength={6} value={pw2fa} onChange={(e) => setPw2fa(e.target.value)} placeholder="000000" className="font-mono tracking-widest" />
            </Field>
            <div className="flex justify-end">
              <Button variant="primary" disabled={!pwCurrent || !pwNew || pw2fa.length !== 6}>
                <Lock size={14} /> Confirmar alteração
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
