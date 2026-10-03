const { chromium } = require('C:/Users/Mateus/Downloads/mapa-calouro-main/node_modules/playwright-core');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const today = url.searchParams.get('data_fim') || '2026-10-02';
    const rows = ['Luiz Felipe', 'Ana Beatriz', 'Felipe Costa', 'Mateus Silva'].map((nome, index) => ({
      id: 52 - index, cliente_nome: nome, cliente_contato: '(11) 99990-1200', quadra_nome: ['Areia', 'Quadra 2', 'Quadra 1', 'Areia'][index],
      data_reserva: today, hora_inicio: '18:00', hora_fim: '19:00', valor_total: [120, 160, 180, 220][index], total_pago: [0, 160, 180, 80][index],
      saldo_devedor: [120, 0, 0, 140][index], status: ['Cancelada', 'Confirmada', 'Confirmada', 'Pendente'][index],
      status_pagamento: ['Pendente', 'Pago', 'Pago', 'Parcial'][index], operador_nome: 'Mateus', metodos: ['Pix', 'Cartão', 'Pix', 'Dinheiro'][index],
    }));
    let data = [];
    if (url.pathname === '/api/auth/me') data = { usuario: { id: 1, nome: 'Mateus', perfil: 'Administrador', arena_status: 1 } };
    if (url.pathname === '/api/auth/manutencao') data = { ativa: false };
    if (url.pathname === '/api/arenas/minha') data = { nome: 'Arena Central', slug: 'arena-central' };
    if (url.pathname === '/api/quadras') data = [{ id: 1, nome: 'Areia', tipo: 'Areia' }, { id: 2, nome: 'Quadra 2', tipo: 'Areia' }];
    const paginacao = { pagina: 1, total: 4, totalPaginas: 1 };
    if (url.pathname.endsWith('/faturamento')) data = { reservas: rows, totais: { bruto: 680, pago: 420, pendente: 260 }, paginacao };
    if (url.pathname.endsWith('/ocupacao')) data = {
      quadras: ['Areia', 'Quadra 2', 'Quadra 1', 'Quadra 4'].map((nome, index) => ({quadra_nome: nome, totalReservas: [18,12,9,3][index], minutosReservados: [1080,720,540,180][index], minutosBloqueados: 0, totalMinutosDisp: 1680, taxa: [64,43,32,11][index]})),
      taxaGeral: 38, periodo: { dias: 2 }
    };
    if (url.pathname.endsWith('/reservas')) data = { reservas: rows, totais: { total: 4, confirmadas: 2, canceladas: 1, pendentes: 1 }, paginacao };
    if (url.pathname.endsWith('/inadimplencia')) data = { inadimplentes: rows.filter(row => row.saldo_devedor > 0), totalDevido: 260, totalDevedores: 2, primeiraReservaPendente: today, maiorSaldoQuadra: { quadra_nome: 'Areia', total_devido: 260 }, paginacao: { ...paginacao, total: 2 } };
    await route.fulfill({ json: data });
  });
  try {
    for (const tab of ['faturamento', 'ocupacao', 'reservas', 'inadimplencia']) {
      await page.goto('http://127.0.0.1:5183/admin/relatorios?aba=' + tab);
      await page.locator('.report-analysis').waitFor();
      await page.screenshot({ path: 'artifacts/relatorios-' + tab + '.png', fullPage: true });
      console.log(tab, await page.locator('.table-card').boundingBox());
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'artifacts/relatorios-mobile.png', fullPage: true });
    console.log('mobile width', await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth })));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
