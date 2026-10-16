const { chromium } = require('../backend/node_modules/playwright');
const fs = require('node:fs');

(async () => {
  fs.mkdirSync('artifacts/calendar', { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const user = { id: 1, perfil: 'Administrador', tenant_id: 1, nome: 'Gestor', arena_slug: 'arena-teste', arena_nome: 'Arena teste', arena_status: 1 };
    await page.addInitScript(user => localStorage.setItem('courtmanager_user', JSON.stringify(user)), user);
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url());
      const court = { id: 1, nome: 'Quadra A', tipo: 'Areia', status: 'Ativa', hora_abertura: '08:00', hora_fechamento: '22:00', modalidades: [], preco_base: 100 };
      const data = url.pathname === '/api/auth/me' ? { usuario: user }
        : url.pathname === '/api/arenas/minha' ? { slug: 'arena-teste', nome: 'Arena teste' }
        : url.pathname.includes('/reservas/grade') ? { quadras: [court], reservas: [{ id: 1, quadra_id: 1, data_reserva: url.searchParams.get('data_inicio'), hora_inicio: '15:00', hora_fim: '16:00', cliente_nome: 'Cliente visual', status: 'Confirmada', status_pagamento: 'Pendente', valor_total: 100, valor_pago: 0 }], bloqueios: [] }
        : url.pathname === '/api/quadras' ? [court] : [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto('http://127.0.0.1:5173/admin/reservas');

    async function checkLayer(selector, filename) {
      await page.locator(selector).waitFor({state:'visible'});
      const result=await page.evaluate(selector=>{
        const overlay=document.querySelector(selector);
        const side=document.querySelector('aside').getBoundingClientRect();
        const hit=document.elementFromPoint(side.x+side.width/2,side.y+side.height/2);
        return {covered:overlay.contains(hit),blur:getComputedStyle(overlay).backdropFilter};
      },selector);
      if(!result.covered || !result.blur.includes('blur(4px)')) throw new Error(JSON.stringify(result));
      await page.screenshot({path:'artifacts/calendar/'+filename+'.png'});
      console.log(filename+': sidebar covered; '+result.blur);
    }
    await page.getByRole('button',{name:'Nova reserva',exact:true}).click();
    await checkLayer('[role="dialog"][aria-labelledby="modal-nova-reserva-title"]','sidebar-new-reservation');
    await page.reload();
    await page.getByRole('button',{name:/Bloquear quadra/i}).click();
    await checkLayer('[role="dialog"][aria-labelledby="modal-bloquear-quadra-title"]','sidebar-block');
    await page.reload();
    await page.getByTitle(/Cliente visual/).click();
    await checkLayer('.modal-overlay.open','sidebar-reservation-details');
    if(errors.length) throw new Error(errors.join('\n'));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
