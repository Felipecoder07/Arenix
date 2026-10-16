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
      const data = url.pathname === '/api/usuarios' ? [{ id: 1, nome: 'Gestor real', email: 'real@example.test', perfil: 'Administrador' }] : url.pathname === '/api/usuarios/atividades' ? [{id: 1, usuario_nome: 'Gestor real', evento: 'Login bem-sucedido', criado_em: '2026-10-14 12:00:00'}] : url.pathname === '/api/auth/me' ? { usuario: user }
        : url.pathname === '/api/arenas/minha' ? { slug: 'arena-teste', nome: 'Arena teste' }
        : url.pathname.includes('/reservas/grade') ? { quadras: [court], reservas: [], bloqueios: [] }
        : url.pathname === '/api/quadras' ? [court] : [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto('http://127.0.0.1:5173/admin/configuracoes?aba=usuarios');

    await page.getByText('Gestor real', {exact:true}).waitFor();
    await page.getByText('Gestor real \u00b7 Login bem-sucedido',{exact:true}).waitFor();
    const menu=page.locator('[data-pencil-name^="Menu Interno"]');
    for(const tab of ['Quadras','Usu\u00e1rios','Pagamentos','Notifica\u00e7\u00f5es','Cancelamentos','Arena']) {
      await menu.getByRole('button',{name:tab,exact:true}).click();
      if(!(await menu.isVisible()))throw Error('Settings disappeared on '+tab);
    }
    await menu.getByRole('button',{name:'Usu\u00e1rios',exact:true}).click();
    await page.screenshot({path:'artifacts/calendar/real-team-activity.png'});
    if(errors.length)throw Error(errors.join('\n'));
    console.log('All six settings tabs render; real activity row is displayed.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
