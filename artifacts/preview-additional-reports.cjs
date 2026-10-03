const { chromium } = require('../backend/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const requests = [];
  let empty = false;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get('data_fim') || '2026-10-02';
    const rows = ['Ana Beatriz', 'Luiz Felipe', 'Mateus Silva'].map((nome, index) => ({
      id: index + 1, cliente_nome: nome, quadra_nome: 'Areia', data_reserva: date,
      hora_inicio: '18:00', hora_fim: '19:00', valor_total: 120, total_pago: 0,
      status_pagamento: 'Cancelado', operador_nome: 'Mateus', motivo_cancelamento: 'Desistência do Cliente',
    }));
    let data = [];
    if (url.pathname === '/api/auth/me') data = { usuario: { id: 1, nome: 'Mateus', perfil: 'Administrador', arena_status: 1 } };
    if (url.pathname === '/api/auth/manutencao') data = { ativa: false };
    if (url.pathname === '/api/arenas/minha') data = { nome: 'Arena Central', slug: 'arena-central' };
    if (url.pathname === '/api/quadras') data = [{ id: 1, nome: 'Areia', tipo: 'Areia' }];
    if (url.pathname.startsWith('/api/relatorios/')) {
      requests.push(url);
      const paginacao = { pagina: Number(url.searchParams.get('pagina')), total: 3, totalPaginas: 1 };
      if (url.pathname.endsWith('/cancelamentos')) data = { cancelamentos: empty ? [] : rows, totalReservas: empty ? 0 : 32, totais: { total: empty ? 0 : 3, valorPerdido: empty ? 0 : 360, estornados: 0 }, paginacao: { ...paginacao, total: empty ? 0 : 3 } };
      if (url.pathname.endsWith('/top-clientes')) data = {
        clientes: empty ? [] : rows.map((row, i) => ({ nome: row.cliente_nome, posicao: i + 1, total_reservas: 6 - i, ultima_reserva: date, valor_total_gerado: 720 - i * 120, ticket_medio: 120, saldo_devedor: 0 })),
        clienteMaisFrequente: empty ? null : { nome: 'Ana Beatriz', total_reservas: 6 }, totalFaturado: empty ? 0 : 1800, paginacao,
      };
      if (url.pathname.endsWith('/horarios-pico')) data = {
        porHora: empty ? [] : [8, 14, 7, 3, 1, 2].map((total, i) => ({ hora: 16 + i, total })),
        porDiaSemana: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, i) => ({ dia, total: empty ? 0 : [3, 2, 4, 7, 3, 3, 2][i] })), totalReservas: empty ? 0 : 24,
      };
      if (url.pathname.endsWith('/formas-pagamento')) data = {
        porMetodo: empty ? [] : ['pix', 'credito', 'dinheiro', 'pix_online', 'cartao_maquina'].map((metodo, i) => ({ metodo, total_transacoes: 5 - i, total_valor: [700, 120, 90, 60, 60][i], percentual: [68, 12, 9, 6, 6][i] })),
        transacoes: empty ? [] : rows.map(row => ({ ...row, data_pagamento: date, hora_pagamento: '19:09:00', metodo: 'pix', valor: 120 })), totalGeral: empty ? 0 : 1030, paginacao,
      };
    }
    await route.fulfill({ json: data });
  });
  try {
    for (const tab of ['cancelamentos', 'formas-pagamento', 'horarios-pico', 'top-clientes']) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto('http://127.0.0.1:5183/admin/relatorios?aba=' + tab);
      await page.locator('.report-metrics').waitFor();
      await page.screenshot({ path: 'artifacts/relatorios-' + tab + '.png', fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: 'artifacts/relatorios-' + tab + '-mobile.png', fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, tab + ' mobile overflow');
      await page.locator('#rel-inicio').fill('2026-09-01');
      await page.locator('#rel-fim').fill('2026-09-30');
      await page.locator('#rel-quadra').selectOption('1');
      await page.getByRole('button', { name: 'Gerar Relatório', exact: true }).click();
      await page.locator('.report-metrics').waitFor();
      assert.equal(requests.at(-1).searchParams.get('data_inicio'), '2026-09-01');
      assert.equal(requests.at(-1).searchParams.get('data_fim'), '2026-09-30');
      assert.equal(requests.at(-1).searchParams.get('quadra_id'), '1');
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Exportar relatório', exact: true }).click();
      const download = await downloaded;
      assert.equal(download.suggestedFilename(), `relatorio_${tab}_2026-09-01_2026-09-30.csv`);
      const csv = await fs.readFile(await download.path(), 'utf8');
      assert.ok(csv.includes(tab === 'horarios-pico' ? '17:00' : 'Ana Beatriz'));
      empty = true;
      await page.getByRole('button', { name: 'Gerar Relatório', exact: true }).click();
      await page.locator('.report-metrics').waitFor();
      assert.equal(await page.locator('body').innerText().then(text => /NaN|Infinity/.test(text)), false);
      if (tab === 'horarios-pico') assert.equal(await page.locator('.report-chart-badge').count(), 0);
      empty = false;
      console.log('PASS: ' + tab + ' desktop, mobile, filters, CSV and empty state');
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
