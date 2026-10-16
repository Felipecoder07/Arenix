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
        : url.pathname.includes('/reservas/grade') ? { quadras: [court], reservas: [], bloqueios: [] }
        : url.pathname === '/api/quadras' ? [court] : [];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto('http://127.0.0.1:5173/admin/reservas');
    const input = page.locator('#main-date-picker');
    await input.click();
    const popup = page.getByRole('dialog', { name: 'Escolher data', exact: true });
    await popup.waitFor();
    await page.screenshot({ path: 'artifacts/calendar/desktop.png' });
    await popup.screenshot({ path: 'artifacts/calendar/calendar.png' });
    const first = await input.inputValue();
    const target = new Date(first + 'T12:00:00');
    target.setDate(target.getDate() + 1);
    await popup.getByRole('button', { name: target.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }), exact: true }).click();
    if (await input.inputValue() === first) throw new Error('Calendar did not change the date');
    await page.getByRole('button', { name: /Bloquear quadra/i }).click();
    await page.locator('#bq-data').click();
    await popup.waitFor();
    await page.screenshot({ path: 'artifacts/calendar/block-modal.png' });
    await page.keyboard.press('Escape');
    if (!(await page.locator('#bq-data').isVisible())) throw new Error('Escape closed the parent modal');
    await page.reload();
    await page.setViewportSize({ width: 390, height: 844 });
    await input.click();
    await popup.waitFor();
    const box = await popup.boundingBox();
    if (!box || box.x < 0 || box.x + box.width > 390 || box.y < 0 || box.y + box.height > 844) throw new Error('Popup outside mobile viewport');
    await page.screenshot({ path: 'artifacts/calendar/mobile.png' });
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Desktop/mobile calendar, date selection and nested Escape passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
