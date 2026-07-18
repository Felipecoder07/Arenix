import { useState } from 'react';
import { Send, Megaphone, Trash2, Calendar } from 'lucide-react';
import { Card, Badge, Button, PageHeader, Field, Input, Select, Textarea, ConfirmModal, EmptyState } from '../components/ui';
import { ARENAS, BANNERS, formatDate } from '../data/mock';

export function MasterComunicacao() {
  const [targetArena, setTargetArena] = useState(ARENAS[0].id);
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<'email' | 'alerta'>('alerta');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastChannel, setBroadcastChannel] = useState<'email' | 'alerta'>('email');
  const [broadcastWhen, setBroadcastWhen] = useState<'now' | 'later'>('now');
  const [broadcastAt, setBroadcastAt] = useState('');
  const [sent, setSent] = useState(false);
  const [removeBanner, setRemoveBanner] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Comunicação" description="Envie notificações e broadcasts para as arenas da plataforma." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Single arena */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Send size={15} className="text-muted" />
            <h3 className="text-sm font-semibold">Notificação para uma arena</h3>
          </div>
          <div className="space-y-4">
            <Field label="Arena de destino">
              <Select value={targetArena} onChange={(e) => setTargetArena(e.target.value)}>
                {ARENAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Canal">
              <Select value={channel} onChange={(e) => setChannel(e.target.value as any)}>
                <option value="alerta">Alerta interno no sistema</option>
                <option value="email">E-mail</option>
              </Select>
            </Field>
            <Field label="Mensagem">
              <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Digite a mensagem que a arena verá..." />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMessage('')}>Limpar</Button>
              <Button variant="primary" disabled={!message.trim()} onClick={() => { setSent(true); setMessage(''); setTimeout(() => setSent(false), 2500); }}>
                <Send size={14} /> Enviar
              </Button>
            </div>
            {sent && <p className="text-xs text-success text-right animate-fade-in">Notificação enviada.</p>}
          </div>
        </Card>

        {/* Broadcast */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone size={15} className="text-muted" />
            <h3 className="text-sm font-semibold">Broadcast para todas as arenas</h3>
          </div>
          <div className="space-y-4">
            <Field label="Canal">
              <Select value={broadcastChannel} onChange={(e) => setBroadcastChannel(e.target.value as any)}>
                <option value="email">E-mail</option>
                <option value="alerta">Alerta interno no sistema</option>
              </Select>
            </Field>
            <Field label="Quando enviar">
              <Select value={broadcastWhen} onChange={(e) => setBroadcastWhen(e.target.value as any)}>
                <option value="now">Disparar imediatamente</option>
                <option value="later">Agendar para depois</option>
              </Select>
            </Field>
            {broadcastWhen === 'later' && (
              <Field label="Data e hora do envio">
                <Input type="datetime-local" value={broadcastAt} onChange={(e) => setBroadcastAt(e.target.value)} />
              </Field>
            )}
            <Field label="Mensagem">
              <Textarea rows={4} value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} placeholder="Mensagem que todas as arenas verão..." />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setBroadcastMsg(''); setBroadcastAt(''); }}>Limpar</Button>
              <Button variant="primary" disabled={!broadcastMsg.trim()} onClick={() => { setBroadcastMsg(''); setBroadcastAt(''); }}>
                <Calendar size={14} /> {broadcastWhen === 'now' ? 'Disparar agora' : 'Agendar envio'}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Active banners */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border-passive flex items-center justify-between">
          <h3 className="text-sm font-semibold">Banners e avisos ativos</h3>
          <Badge status="neutral">{BANNERS.length} ativos</Badge>
        </div>
        {BANNERS.length === 0 ? (
          <EmptyState message="Nenhum banner ativo no momento." />
        ) : (
          <ul className="divide-y divide-border-passive">
            {BANNERS.map((b) => (
              <li key={b.id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-charcoal">{b.message}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted">
                    <span>Para: <strong className="text-charcoal/80">{b.audienceLabel}</strong></span>
                    <span>·</span>
                    <span>Canal: {b.channel}</span>
                    <span>·</span>
                    <span>Criado: {formatDate(b.createdAt)}</span>
                    <span>·</span>
                    <span>Expira: {formatDate(b.expiresAt)}</span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setRemoveBanner(b.id)} className="text-danger hover:bg-danger-soft shrink-0">
                  <Trash2 size={13} /> Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmModal open={!!removeBanner} onClose={() => setRemoveBanner(null)} onConfirm={() => setRemoveBanner(null)}
        title="Remover banner" destructive confirmLabel="Remover agora"
        message="O banner será removido imediatamente, antes da expiração programada."
      />
    </div>
  );
}
