// Exercises the real React card component with the official hosted SDK fields.
// Only public TEST credentials and Mercado Pago's published synthetic card are used.
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function createCardBrowser(publicKey, diagnostic = () => {}, method = 'visa') {
  assert.ok(publicKey?.startsWith('TEST-'), 'Public TEST key required.');
  assert.ok(['visa', 'master'].includes(method));
  const root = path.resolve(__dirname, '../../../tela cliente');
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
  const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react', { paths: [root] })).href);
  let vite, browser;
  const server = http.createServer(async (req, res) => {
    if (req.url === '/sandbox-card') {
      const html = await vite.transformIndexHtml('/sandbox-card', '<html><body><div id="root"></div><script src="https://sdk.mercadopago.com/js/v2"></script><script type="module" src="/sandbox-entry.js"></script></body></html>');
      res.setHeader('Content-Type', 'text/html');
      res.end(html);
    } else vite.middlewares(req, res);
  });
  const close = async () => {
    await browser?.close();
    await vite?.close();
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  };
  try {
    vite = await createServer({ root, configFile: false, envFile: false, logLevel: 'error',
      plugins: [react(), {
        name: 'sandbox-card-entry',
        resolveId(id) { if (id === '/sandbox-entry.js') return '\0sandbox-entry.js'; },
        load(id) {
          if (id !== '\0sandbox-entry.js') return;
          return `import React from 'react';
            import {createRoot} from 'react-dom/client';
            import Card from '/src/components/MercadoPagoCardForm.tsx';
            createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,
              React.createElement(Card,{publicKey:window.__publicTestKey,amount:100,
                onBusyChange:()=>{},onSubmit:async(data)=>{window.__cardResult=data;}}),
              React.createElement('button',{type:'submit',form:'mercado-pago-card-form'},'Testar cartão')));`;
        },
      }],
      server: { middlewareMode: true, hmr: { server }, host: '127.0.0.1' },
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    return {
      close,
      async tokenize(scenario) {
        assert.ok(['APRO', 'OTHE'].includes(scenario));
        const context = await browser.newContext();
        let stage = 'initialize';
        try {
          await context.addInitScript(key => { window.__publicTestKey = key; }, publicKey);
          await context.route('**/*', route => {
            const url = new URL(route.request().url());
            const official = url.protocol === 'https:' && /(^|\.)(mercadopago\.com(?:\.br)?|mlstatic\.com|mercadolibre\.com(?:\.br)?)$/.test(url.hostname);
            return url.origin === origin || official ? route.continue() : route.abort();
          });
          const page = await context.newPage();
          page.setDefaultTimeout(20000);
          page.on('response', response => {
            const url = new URL(response.url());
            if (url.hostname === 'api.mercadopago.com') diagnostic({ browser: true, path: url.pathname, httpStatus: response.status() });
          });
          await page.goto(origin + '/sandbox-card', { timeout: 45000 });
          stage = 'card_number';
          await page.frameLocator('#mp-card-number iframe').locator('input:visible').fill(method === 'master' ? '5480832801033311' : '4235647728025682');
          stage = 'expiration';
          await page.frameLocator('#mp-card-expiration iframe').locator('input:visible').fill('11/30');
          stage = 'security_code';
          await page.frameLocator('#mp-card-security iframe').locator('input:visible').fill('123');
          stage = 'holder';
          await page.locator('#mp-cardholder-name').fill(scenario);
          stage = 'identification';
          await page.locator('#mp-card-id-type').selectOption('CPF');
          await page.locator('#mp-card-id-number').fill('12345678909');
          await page.locator('#mp-card-email').fill('comprador@example.com');
          stage = 'installments';
          await page.waitForFunction(() => document.querySelector('#mp-card-installments')?.options.length > 0);
          await page.locator('#mp-card-installments').selectOption('1');
          stage = 'submit';
          await page.getByRole('button', { name: 'Testar cartão' }).click();
          await page.waitForFunction(() => Boolean(window.__cardResult?.token));
          const data = await page.evaluate(() => window.__cardResult);
          diagnostic({ browser: true, scenario, cardFormTokenized: true });
          return { token: data.token, payment_method_id: data.payment_method_id, email: data.cardholderEmail,
            identification: { type: data.identificationType, number: data.identificationNumber },
            installments: data.installments, issuer_id: data.issuerId };
        } catch (error) {
          diagnostic({ browser: true, scenario, stage, failureType: error.name === 'TimeoutError' ? 'browser_timeout' : 'browser_error',
            strictLocator: error.message.includes('strict mode violation'),
            invalidInputType: error.message.includes('Cannot type text into input') });
          throw new Error('Browser sandbox tokenization failed.');
        } finally { await context.close(); }
      },
    };
  } catch (error) { await close(); throw error; }
}
module.exports = { createCardBrowser };
