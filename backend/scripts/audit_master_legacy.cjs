// Read-only inspection: does not load application startup, migrations or jobs.
const sqlite = require('sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const source = path.resolve(__dirname, '../data/courtmanager.sqlite');
const target = path.resolve(__dirname, '../../artifacts/master-final/legacy-audit.json');
const digest = () => crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
(async () => {
  const before = digest();
  const db = await new Promise((resolve,reject) => { const connection = new sqlite.Database(source,sqlite.OPEN_READONLY,error=>error ? reject(error) : resolve(connection)); });
  const all = (sql, args=[]) => new Promise((resolve,reject)=>db.all(sql,args,(error,rows)=>error ? reject(error) : resolve(rows)));
  try {
    await all('PRAGMA query_only=ON');
    const columns = {};
    for (const table of ['Arenas','FaturasSaaS','ComunicadosSaaS','Usuarios']) columns[table] = (await all(`PRAGMA table_info(${table})`)).map(c=>c.name);
    const required = {Arenas:['motivo_bloqueio','fatura_plano_pendente_id'],FaturasSaaS:['periodo_fim','gateway_estornado_ref'],ComunicadosSaaS:['agendado_em','estado']};
    const missing = Object.entries(required).flatMap(([table,names])=>names.filter(n=>!columns[table].includes(n)).map(n=>table+'.'+n));
    const optional = (table,column) => columns[table].includes(column) ? column : `NULL AS ${column}`;
    const arenas = await all(`SELECT id,status,plano_id,dia_vencimento,${optional('Arenas','motivo_bloqueio')},${optional('Arenas','fatura_plano_pendente_id')} FROM Arenas`);
    const faturas = await all(`SELECT id,tenant_id,plano_id,status,data_vencimento,${optional('FaturasSaaS','periodo_fim')} FROM FaturasSaaS`);
    const logs = await all('SELECT id,tenant_id,evento,detalhes,criado_em FROM LogsAuditoria ORDER BY id');
    const testConfirmation = logs.find(log=>log.evento==='SaaS: Classificação local de dados de teste' && log.tenant_id===1);
    const blocked = arenas.filter(a=>a.status===0&&!a.motivo_bloqueio).map(a=>({arena_id:a.id,acao:'Revisar motivo antes de liberar acesso; pagamento não desbloqueia automaticamente.'}));
    const pending = faturas.filter(f=>['Pendente','Atrasada'].includes(f.status)).flatMap(f=>{
      const a=arenas.find(a=>a.id===f.tenant_id);
      return a && Number(a.plano_id)!==Number(f.plano_id) && a.fatura_plano_pendente_id!==f.id
        ? [{arena_id:a.id,fatura_id:f.id,plano_arena:a.plano_id,plano_fatura:f.plano_id,
          classificacao:testConfirmation && a.id===1 && f.id===24?'teste confirmado pelo responsável':'não conciliada',
          acao:testConfirmation && a.id===1 && f.id===24?'Preservado como histórico local de teste; não importar como contratação real.':'Conciliar contratação; não inferir plano atual de fatura antiga.'}] : [];
    });
    const contexts = [];
    for (const id of new Set([...blocked.map(a=>a.arena_id),...pending.map(a=>a.arena_id)])) {
      const arena = await all('SELECT id,nome,status,criado_em,trial_expira_em,plano_id FROM Arenas WHERE id=?',[id]);
      const financial = await all(`SELECT id,plano_id,valor,status,data_vencimento,data_pagamento,metodo_pagamento,
        CASE WHEN gateway_ref IS NULL OR gateway_ref='' THEN 0 ELSE 1 END AS has_gateway_ref
        FROM FaturasSaaS WHERE tenant_id=? ORDER BY id`,[id]);
      const matching = logs.filter(log => /SaaS|Bloqueio.*Arena|Desbloqueio.*Arena|Plano.*Arena/i.test(log.evento)).filter(log => log.tenant_id === id ||
        new RegExp(`Arena[^\\n]*?ID:\\s*${id}\\b`, 'i').test(String(log.detalhes || '')) ||
        (arena[0]?.nome && String(log.detalhes || '').includes(arena[0].nome)));
      // Keep only IDs, timestamps and event labels. Descriptions may contain personal data.
      contexts.push({arena_id:id,status:arena[0]?.status,created:arena[0]?.criado_em,
        trial_end:arena[0]?.trial_expira_em,plan_id:arena[0]?.plano_id,invoices:financial,
        audit_candidates:matching.map(log=>({id:log.id,event:log.evento,created:log.criado_em,
          explicit_arena_id:Number(String(log.detalhes || '').match(/Arena[^\n]*?ID:\s*(\d+)\b/i)?.[1]) || null,
          invoice_id:Number(String(log.detalhes || '').match(/fatura\s*#(\d+)/i)?.[1]) || null,
          match:log.tenant_id===id?'tenant_id':'description_heuristic'})),
        note:'Candidatos por descrição exigem conferência; não comprovam vínculo ou intenção por si só.'});
    }
    const report = {generated_at:new Date().toISOString(),source,mode:'read-only',
      totals:{arenas:arenas.length,faturas:faturas.length},missing_schema:missing,
      blocked_without_reason:blocked,pending_plan_without_link:pending,
      confirmed_test_data:testConfirmation?{arena_id:1,invoice_ids:[18,19,20,21,22,23,24],audit_log_id:testConfirmation.id,application_reports_exclude_tests:false}:null,
      invalid_due_days:arenas.filter(a=>!Number.isInteger(a.dia_vencimento)||a.dia_vencimento<1||a.dia_vencimento>31).map(a=>({arena_id:a.id,dia:a.dia_vencimento})),
      invoices_without_period_end:faturas.filter(f=>!f.periodo_fim).map(f=>f.id),
      legacy_context:contexts,
      note:'Ausência de vínculo não permite reconstruir intenção de contratação. Não foram executadas migrações, cobranças, envios ou alterações.'};
    await new Promise((resolve,reject)=>db.close(error=>error?reject(error):resolve()));
    report.database_unchanged = before === digest();
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  } catch(error) { db.close();throw error; }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
