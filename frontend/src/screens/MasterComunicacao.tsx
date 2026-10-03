import { useCallback } from 'react';
import type { SaaSArena, Announcement } from '../types/api';
import { MasterPageHeader as PageHeader } from '../components/MasterPageHeader';
import { apiFetch as fetch } from '../utils/apiFetch';
import { useState, useEffect } from 'react';
import { Send, Megaphone, Trash2, Calendar, Bell, Mail, History } from 'lucide-react';
import { Card, Badge, Button, Field, Input, Select, Textarea, ConfirmModal, EmptyState, Modal } from '../components/ui';
import { formatDate } from '../data/mock';

export function MasterComunicacao() {
  const [arenas, setArenas] = useState<SaaSArena[]>([]);
  const [banners, setBanners] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Notificação individual
  const [targetArena, setTargetArena] = useState('');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<'email' | 'alerta'>('alerta');
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Broadcast
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastChannel, setBroadcastChannel] = useState<'email' | 'alerta'>('email');
  const [broadcastWhen, setBroadcastWhen] = useState<'now' | 'later'>('now');
  const [broadcastAt, setBroadcastAt] = useState('');
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [broadcastErrorMsg, setBroadcastErrorMsg] = useState('');

  // Remoção
  const [historyOpen, setHistoryOpen] = useState(false);
  const [removeBanner, setRemoveBanner] = useState<number | null>(null);

  const fetchDados = useCallback(async () => {
    try {
      const headers = {};

      const [arenasRes, BannersRes] = await Promise.all([
        fetch('/api/saas/arenas', { headers }).then(r => r.json()),
        fetch('/api/saas/comunicados', { headers }).then(r => r.json())
      ]);

      setArenas(Array.isArray(arenasRes) ? arenasRes : []);
      setBanners(Array.isArray(BannersRes) ? BannersRes : []);

      if (Array.isArray(arenasRes) && arenasRes.length > 0) {
        setTargetArena(current => current || String(arenasRes[0].id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [] );

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  const handleSendIndividual = async () => {
    if (!message.trim() || !targetArena) return;
    setErrorMsg('');
    setSent(false);
    try {
      const res = await fetch('/api/saas/comunicados', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          audience: targetArena,
          channel
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSent(true);
        setMessage('');
        fetchDados();
        setTimeout(() => setSent(false), 2500);
      } else {
        setErrorMsg(data.error || 'Erro ao enviar notificação.');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Falha de rede ao conectar com o servidor.');
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setBroadcastErrorMsg('');
    setBroadcastSent(false);
    try {
      
      // Define a data de expiração (se for agendado para depois, expira 7 dias após o agendamento)
      let expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      if (broadcastWhen === 'later' && broadcastAt) {
        expiresAt = new Date(new Date(broadcastAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      const res = await fetch('/api/saas/comunicados', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: broadcastMsg,
          audience: 'all',
          channel: broadcastChannel,
          expiresAt
        })
      });

      const data = await res.json();
      if (res.ok) {
        setBroadcastSent(true);
        setBroadcastMsg('');
        setBroadcastAt('');
        fetchDados();
        setTimeout(() => setBroadcastSent(false), 2500);
      } else {
        setBroadcastErrorMsg(data.error || 'Erro ao enviar broadcast.');
      }
    } catch (e) {
      console.error(e);
      setBroadcastErrorMsg('Falha de rede ao conectar com o servidor.');
    }
  };

  const handleRemoveBanner = async () => {
    if (!removeBanner) return;
    try {
      const res = await fetch(`/api/saas/comunicados/${removeBanner}`, {
        method: 'DELETE',
        headers: {}
      });
      if (res.ok) {
        fetchDados();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRemoveBanner(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-charcoal animate-pulse">Carregando painel de comunicação...</div>;

  return (
    <div className="master-reference-page master-communication-page">
      <PageHeader title="Comunicação" description="Envie alertas, e-mails e comunicados para toda a rede" context={false} actions={<Button variant="ghost" onClick={() => setHistoryOpen(true)}><History size={14} /> Histórico de envios</Button>} />
      <div className="master-composers">
        <section className="master-composer master-dark">
          <header><span className="master-composer-icon"><Send size={16} /></span><div><h3>Enviar para uma arena</h3><p>Alerta interno ou e-mail direcionado</p></div><small>DIRECIONADO</small></header>
          {errorMsg && <p role="alert" className="master-login-error">{errorMsg}</p>}
          <Field label="ARENA DE DESTINO"><Select aria-label="Arena de destino" value={targetArena} onChange={e => { setTargetArena(e.target.value); setErrorMsg(''); }}>{arenas.map(a => <option key={a.id} value={String(a.id)}>{a.nome}</option>)}</Select></Field>
          <div className="master-channel-options" role="group" aria-label="Canal da mensagem"><Button variant={channel === 'alerta' ? 'primary' : 'ghost'} aria-pressed={channel === 'alerta'} onClick={() => setChannel('alerta')}><Bell size={13} /> Alerta no sistema</Button><Button variant={channel === 'email' ? 'primary' : 'ghost'} aria-pressed={channel === 'email'} onClick={() => setChannel('email')}><Mail size={13} /> E-mail</Button></div>
          <Field label="MENSAGEM"><Textarea maxLength={500} value={message} onChange={e => { setMessage(e.target.value); setErrorMsg(''); }} placeholder="Digite a mensagem que a arena verá..." /></Field>
          <footer><span>{sent ? 'Mensagem enviada.' : message.length + ' / 500 caracteres'}</span><Button variant="primary" disabled={!message.trim() || !targetArena} onClick={handleSendIndividual}><Send size={14} /> Enviar agora</Button></footer>
        </section>
        <section className="master-composer master-broadcast">
          <header><span className="master-composer-icon"><Megaphone size={16} /></span><div><h3>Comunicado para toda a rede</h3><p>Entrega simultânea para todas as arenas</p></div><small>{arenas.length} ARENAS</small></header>
          {broadcastErrorMsg && <p role="alert" className="text-danger">{broadcastErrorMsg}</p>}
          <div className="master-broadcast-controls"><span>CANAL E ENVIO</span><div><Select aria-label="Canal do comunicado" value={broadcastChannel} onChange={e => setBroadcastChannel(e.target.value === 'email' ? 'email' : 'alerta')}><option value="email">E-mail</option><option value="alerta">Alerta no sistema</option></Select><Select aria-label="Quando enviar" value={broadcastWhen} onChange={e => setBroadcastWhen(e.target.value === 'later' ? 'later' : 'now')}><option value="now">Disparar imediatamente</option><option value="later">Agendar para depois</option></Select></div></div>
          {broadcastWhen === 'later' && <Field label="DATA E HORA DO ENVIO"><Input type="datetime-local" value={broadcastAt} onChange={e => setBroadcastAt(e.target.value)} /></Field>}
          <Field label="MENSAGEM"><Textarea maxLength={1000} value={broadcastMsg} onChange={e => { setBroadcastMsg(e.target.value); setBroadcastErrorMsg(''); }} placeholder="Escreva o comunicado que todas as arenas receberão..." /></Field>
          <footer><span>{broadcastSent ? 'Comunicado enviado.' : broadcastMsg.length + ' / 1000 caracteres'}</span><Button variant="primary" disabled={!broadcastMsg.trim()} onClick={handleSendBroadcast}><Megaphone size={14} /> {broadcastWhen === 'now' ? 'Enviar para ' + arenas.length + ' arenas' : 'Agendar envio'}</Button></footer>
        </section>
      </div>
      <Card className="master-data-panel master-announcements">
        <div className="master-table-heading"><strong><Calendar size={15} /> Banners e avisos ativos <em>{banners.length} ativos</em></strong><span>Conteúdos visíveis agora na plataforma</span></div>
        {banners.length === 0 ? <EmptyState message="Nenhum banner ativo no momento." /> : <ul>{banners.map(b => <li key={b.id}><span className={'master-announcement-icon ' + (b.channel === 'email' ? 'is-email' : '')}>{b.channel === 'email' ? <Mail size={16} /> : <Bell size={16} />}</span><div className="master-announcement-body"><p>{b.message}</p><div><span>{b.audienceLabel}</span><span>{b.channel === 'email' ? 'E-mail' : 'Alerta'}</span>{b.expiresAt && <span>Expira em {formatDate(b.expiresAt)}</span>}</div></div><Badge status="ativo">● Ativo</Badge><button className="master-announcement-remove" onClick={() => setRemoveBanner(b.id)} aria-label={'Remover comunicado: ' + b.message}><Trash2 size={14} /></button></li>)}</ul>}
      </Card>
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Histórico de envios" description="Comunicados disponíveis no sistema">
        {banners.length === 0 ? <EmptyState message="Nenhum comunicado disponível." /> : <ul className="space-y-4">{banners.map(b => <li key={b.id}><p>{b.message}</p><small>{b.audienceLabel} · {formatDate(b.createdAt)} · {b.channel === 'email' ? 'E-mail' : 'Alerta'}</small></li>)}</ul>}
      </Modal>

      <ConfirmModal open={!!removeBanner} onClose={() => setRemoveBanner(null)} onConfirm={handleRemoveBanner}
        title="Remover banner" destructive confirmLabel="Remover agora"
        message="O banner será removido imediatamente, antes da expiração programada."
      />
    </div>
  );
}
