const fs=require('fs');
function edit(file,callback){const path='frontend/src/screens/'+file;let s=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');const r=(a,b)=>{if(!s.includes(a))throw new Error(file+': '+a.slice(0,70));s=s.replace(a,b);};callback(r,()=>s);fs.writeFileSync(path,s);}
edit('MasterComunicacao.tsx',(r,get)=>{
 r('Send, Megaphone, Trash2, Calendar','Send, Megaphone, Trash2, Calendar, Bell, Mail, History');
 r('ConfirmModal, EmptyState','ConfirmModal, EmptyState, Modal');
 r("  const [removeBanner, setRemoveBanner]", "  const [historyOpen, setHistoryOpen] = useState(false);\n  const [removeBanner, setRemoveBanner]");
 const start=get().indexOf('  return (\n    <div className="space-y-6">');
 const end=get().indexOf('      <ConfirmModal open={!!removeBanner}',start);
 r(get().slice(start,end),`  return (
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

`);
});
edit('MasterFinanceiro.tsx',(r,get)=>{
 r('Pencil, Wallet, Clock, CheckCircle','Pencil, Wallet, Clock, CheckCircle, Download, Plus, TrendingUp');
 r("import { MetricCard } from '../components/MetricCard';", "import { exportMasterCsv } from '../utils/masterExport';");
 r('<div className="space-y-6">','<div className="master-reference-page master-finance-page">');
 r('description="Gestão de planos, faturamento e inadimplência da plataforma."',`description="Planos, faturamento e inadimplência de toda a plataforma" context={false}
        actions={<><Button variant="ghost" onClick={() => exportMasterCsv('faturas.csv', [['Arena', 'Fatura', 'Vencimento', 'Valor', 'Status'], ...faturasFiltradas.map(f => [f.arena_nome, f.id, f.data_vencimento, f.valor, f.status])])}><Download size={13} /> Exportar</Button><Button variant="primary" onClick={() => document.getElementById('master-invoices')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Plus size={14} /> Registrar pagamento</Button></>}`);
 const start=get().indexOf('        <MetricCard'), end=get().indexOf('        <Card className="master-soft',start);
 r(get().slice(start,end),`        <section className="master-finance-mrr"><header><span>MRR DA PLATAFORMA</span><TrendingUp size={18} /></header><strong>{formatBRL(metrics.mrr)}</strong><p><span>{metrics.mrrVariacao >= 0 ? '↗' : '↘'} {metrics.mrrVariacao.toLocaleString('pt-BR')}%</span> vs. mês anterior</p><footer><span>Receita recorrente mensal</span><span>ARR · {formatBRL(metrics.mrr * 12)}</span></footer></section>
`);
 r('className="master-finance-summary grid grid-cols-1 lg:grid-cols-3 gap-4"','className="master-finance-summary"');
 r('className="master-soft lg:col-span-2 p-5"','className="master-finance-history master-soft"');
 r('height={160}','height={145}');
 r('      <div>\n        <h3 className="text-sm font-semibold text-charcoal mb-3">Planos</h3>', '      <div className="master-plans-section">\n        <header><h3>Planos da plataforma</h3><span>Edite preços e limites por plano</span></header>');
 const descStart=get().indexOf('            const description ='),descEnd=get().indexOf('            return (',descStart);r(get().slice(descStart,descEnd),'');
 r('                <p className="text-xs text-muted mt-2">{description}</p>\n','');
 const limitsStart=get().indexOf('                <div className="mt-4 space-y-1.5 text-sm">'),limitsEnd=get().indexOf('              </Card>',limitsStart);
 r(get().slice(limitsStart,limitsEnd),`                <div className="master-plan-limits"><span>{p.max_quadras > 0 ? p.max_quadras : 'Ilimitado'} quadras</span><span>{p.max_usuarios > 0 ? p.max_usuarios : 'Ilimitado'} usuários</span></div>
`);
 r('      <Card className="overflow-hidden">','      <div id="master-invoices"><Card className="master-invoices overflow-hidden">');
 r('Histórico de Faturas Globais','Faturas globais');
 r('      {/* Edit plan modal */}', '      </div>\n\n      {/* Edit plan modal */}');
 r('⚡ Pix Online', 'Pix Online');r('👤 Manual', 'Manual');
});
