const { chromium } = require('C:/Users/Mateus/Downloads/mapa-calouro-main/node_modules/playwright-core');
const fs = require('fs');
const names = ['Arena Set Point', 'Beach House', 'Arena Central', 'Match Point Club', 'Quadra 12', 'Vila Beach Sports', 'Arena Norte'];
const people = ['Marina Costa', 'Rafael Lima', 'Luana Alves', 'Diego Nunes', 'Ana Ribeiro', 'Caio Moura', 'Bruno Sales'];
const arenas = names.map((nome, i) => ({ id: i + 1, nome, email: ['marina@setpoint.com', 'rafael@beach.com', 'luana@central.com', 'diego@match.com', 'ana@quadra12.com', 'caio@vilabeach.com', 'bruno@arenanorte.com'][i], endereco: ['Campinas, SP', 'Recife, PE', 'Goiânia, GO', 'Curitiba, PR', 'São Paulo, SP', 'Fortaleza, CE', 'Manaus, AM'][i], status: i === 2 ? 0 : 1, em_trial: i === 1 || i === 5, plano_nome: i % 2 ? 'Basic' : 'Pro', plano_id: i % 2 + 1, dia_vencimento: 10, criado_em: '2026-09-12', faturas_atrasadas: i === 2 ? 1 : 0, gateway_conectado: 1, slug: 'arena-' + i }));
const plans = ['Basic', 'Pro', 'Enterprise'].map((nome, i) => ({ id: i + 1, nome, valor_mensal: [49.99, 79.99, 499.9][i], valor_anual: [39.99, 63.99, 399.9][i], max_quadras: [2,5,0][i], max_usuarios: [3,10,0][i] }));
const invoices = arenas.slice(0,3).map((a,i)=>({id:1048-i,tenant_id:a.id,arena_nome:a.nome,plano_nome:a.plano_nome,data_vencimento:'2026-10-10',valor:489,status:['Pendente','Paga','Atrasada'][i],metodo_pagamento:'Pix Online',data_pagamento:'2026-10-01'}));
const banners = ['Manutenção programada neste sábado', 'Novo relatório de ocupação disponível', 'Atualização nos termos de uso'].map((message,i)=>({id:i+1,message,audience:'all',audienceLabel:i===1?'Arena Set Point':'Todas as arenas',channel:i===1?'email':'alerta',createdAt:'2026-09-28',expiresAt:'2026-10-12'}));
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(route.request().method()!=='GET'){await route.fulfill({status:403,json:{error:'Preview is read only'}});return;}
  let data=[];
  if(path==='/api/auth/me')data={usuario:{id:1,nome:'Marina Souza',email:'master@courtly.com',perfil:'SuperAdmin'}};
  if(path==='/api/saas/arenas')data=arenas;
  if(path==='/api/saas/planos')data=plans;
  if(path==='/api/saas/faturas')data=invoices;
  if(path==='/api/saas/comunicados')data=banners;
  if(path==='/api/saas/usuarios')data=people.map((nome,i)=>({id:i+1,nome,email:arenas[i].email,role:i===0?'SuperAdmin':'Administrador',ativo:i===2?0:1,arenaId:i+1,arenaName:arenas[i].nome}));
  if(path==='/api/saas/metrics')data={totalReceitaSaaS:286400,mrrVariacao:9.8,totalQuadras:642,totalClientes:18420,arenasBloqueadas:1,churnRate:2.8,reservasHoje:1248,reservasSemana:8734,reservasMes:31960,reservasVariacao:12.6,growthChart:[5,6,7,8,9,10].map((m,i)=>({month:'2026-'+String(m).padStart(2,'0'),count:10+i*2})),faturamentoHistorico:[5,6,7,8,9,10].map((m,i)=>({month:'2026-'+String(m).padStart(2,'0'),total:190000+i*19000}))};
  await route.fulfill({json:data});
 });
 fs.mkdirSync('artifacts/master-current',{recursive:true});
 for(const name of ['master-login','dashboard','arenas','financeiro','usuarios','comunicacao']){
  await page.goto('http://127.0.0.1:5187/'+(name==='master-login'?name:'master/'+name),{waitUntil:'domcontentloaded'});
  await page.locator(name==='master-login'?'.master-login-card':name==='dashboard'?'.master-dashboard':'.master-reference-page').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:'artifacts/master-current/'+name+'.png'});
  console.log(name,await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight})));
 }
 await page.setViewportSize({width:390,height:844});
 for(const name of ['arenas','financeiro','usuarios','comunicacao']){
  await page.goto('http://127.0.0.1:5187/master/'+name,{waitUntil:'domcontentloaded'});
  await page.locator('.master-reference-page').waitFor();
  await page.screenshot({path:'artifacts/master-current/'+name+'-mobile.png'});
  console.log(name+' mobile',await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,main:document.querySelector('.master-main').clientWidth,content:document.querySelector('.master-main').scrollWidth})));
 }
 console.log('PAGE ERRORS',errors);
 await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
