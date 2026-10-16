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
    let failCourts;
    const pendingCourts = new Promise(resolve => { failCourts = resolve; });
    await page.route('**/api/**', async route => {
      if (new URL(route.request().url()).pathname === '/api/quadras') {
        await pendingCourts;
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      }
      const url = new URL(route.request().url());
      const court = { id: 1, nome: 'Quadra A', tipo: 'Areia', status: 'Ativa', hora_abertura: '08:00', hora_fechamento: '22:00', modalidades: [], preco_base: 100 };
      const data = url.pathname === '/api/usuarios' ? [{ id: 1, nome: 'Gestor real', email: 'real@example.test', perfil: 'Administrador' }] : url.pathname === '/api/usuarios/atividades' ? [{id: 1, usuario_nome: 'Gestor real', evento: 'Login bem-sucedido', criado_em: '2026-10-14 12:00:00'}] : url.pathname === '/api/auth/me' ? { usuario: user }
        : url.pathname === '/api/arenas/minha' ? { slug: 'arena-teste', nome: 'Arena teste' }
        : url.pathname.includes('/reservas/grade') ? { quadras: [court], reservas: [], bloqueios: [] }
        : url.pathname === '/api/quadras' ? [court] : [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto('http://127.0.0.1:5173/admin/configuracoes?aba=quadras');
    await page.getByRole('button', { name: /Nova quadra/i }).click();
    await page.locator('div.fixed.inset-0').filter({has:page.locator('form')}).last().waitFor();
    failCourts();
    const toast=page.locator('[data-toast-layer]');
    await toast.waitFor();
    const result=await toast.evaluate(layer=>{
      const message=layer.firstElementChild;
      const rect=message.getBoundingClientRect();
      const top=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);
      return {above:message.contains(top),parent:layer.parentElement.tagName,layer:getComputedStyle(layer).zIndex};
    });
    if(!result.above || result.parent!=='BODY')throw Error(JSON.stringify(result));
    await page.screenshot({path:'artifacts/calendar/toast-above-modal.png'});
    if(errors.length)throw Error(errors.join('\n'));
    console.log('Toast is above the open modal backdrop:',result);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
