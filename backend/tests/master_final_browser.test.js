const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const fixture = require('./helpers/securityFixture.cjs');
const { db } = fixture;
vi.spyOn(require('../src/services/emailService'),'sendEmail').mockResolvedValue(true);
let server, vite, browser, context, page, origin;

beforeAll(async () => {
  await fixture.initialize();
  const frontend = path.resolve(__dirname, '../../frontend');
  const { createServer } = await import(pathToFileURL(path.join(frontend,'node_modules/vite/dist/node/index.js')).href);
  const { default: react } = await import(pathToFileURL(path.join(frontend,'node_modules/@vitejs/plugin-react/dist/index.js')).href);
  const { default: tailwindConfig } = await import(pathToFileURL(path.join(frontend,'tailwind.config.js')).href);
  const tailwind = require(path.join(frontend,'node_modules/tailwindcss'));
  const autoprefixer = require(path.join(frontend,'node_modules/autoprefixer'));
  vite = await createServer({root:frontend,configFile:false,envFile:false,plugins:[react()],
    css:{postcss:{plugins:[tailwind({...tailwindConfig,content:[path.join(frontend,'index.html'),path.join(frontend,'src/**/*.{js,ts,jsx,tsx}').replaceAll('\\','/')]}),autoprefixer()]}},
    server:{middlewareMode:true,hmr:false,host:'127.0.0.1'},logLevel:'error'});
  let app;
  server = http.createServer((req,res) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) app(req,res);
    else vite.middlewares(req,res);
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  origin = 'http://127.0.0.1:'+server.address().port;
  process.env.CORS_ALLOWED_ORIGINS = origin;
  app = require('../src/app');
  // Use the installed Edge on Windows; CI can install Chromium via Playwright.
  const channel = process.env.SECURITY_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
  browser = await chromium.launch({headless:true,...(channel ? {channel} : {})});
}, 60000);
beforeEach(async () => {
  await db.runAsync('DELETE FROM FaturasSaaS');
  await fixture.seed();
  context = await browser.newContext();
  // No third-party fonts, analytics, identity or payment traffic from tests.
  await context.route('**/*',route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const response = await context.request.post(origin+'/api/auth/login',{data:{email:'u5@example.test',senha:fixture.PASSWORD}});
  expect(response.status()).toBe(200);
  const user = (await response.json()).usuario;
  await context.addInitScript(user => {
    localStorage.setItem('courtmanager_token','session');
    localStorage.setItem('courtmanager_user',encodeURIComponent(JSON.stringify(user)));
    window.__securityXss = 0;
  },user);
  page = await context.newPage();
});
afterEach(async () => { await context?.close(); });
afterAll(async () => {
  await browser?.close();
  await vite?.close();
  if (server?.listening) await new Promise((resolve,reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
  await fixture.close();
},30000);

it('valida cadastro, edição, pagamento, comunicação e recuperação no navegador real', async () => {
  const output = path.resolve(__dirname,'../../artifacts/master-final');
  await fs.mkdir(output,{recursive:true});
  await page.setViewportSize({width:1440,height:1000});
  const errors = [], dialogs = [];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept();});
  const screenshot = async name => {
    await page.evaluate(() => Promise.all(document.getAnimations()
      .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
      .map(animation => animation.finished.catch(() => {}))));
    return page.screenshot({path:path.join(output,name+'.png'),fullPage:true,animations:'disabled'});
  };
  await page.goto(origin+'/master/arenas');
  await page.getByRole('button',{name:'Cadastrar arena',exact:true}).click();
  await page.getByPlaceholder('Ex.: Arena Vôlei Sul').fill('Arena Revisão Visual');
  await page.getByPlaceholder('contato@arena.com.br').fill('visual@example.test');
  await screenshot('01-cadastro');
  const created = page.waitForResponse(r=>r.url().endsWith('/api/saas/arenas')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Cadastrar arena',exact:true}).last().click();
  const response = await created;
  expect(response.status()).toBe(201);
  const id = (await response.json()).id;
  await page.getByRole('button',{name:/Arena Revisão Visual/}).click();
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  await page.locator('input[value="Arena Revisão Visual"]').fill('Arena Revisada');
  const saved = page.waitForResponse(r=>r.url().endsWith('/api/saas/arenas/'+id)&&r.request().method()==='PUT');
  await page.getByRole('button',{name:'Salvar alterações'}).click();
  expect((await saved).status()).toBe(200);
  await page.getByRole('button',{name:'Editar',exact:true}).waitFor();
  await screenshot('02-edicao');
  expect((await db.getAsync('SELECT nome,email FROM Arenas WHERE id=?',[id]))).toMatchObject({nome:'Arena Revisada',email:'visual@example.test'});

  await db.runAsync("INSERT INTO FaturasSaaS(tenant_id,plano_id,valor,status,data_vencimento) VALUES (?,1,10000,'Pendente','2099-10-10')",[id]);
  await page.goto(origin+'/master/financeiro');
  await page.getByRole('button',{name:'Ver faturas para pagamento'}).click();
  await page.getByRole('button',{name:'Registrar pagamento',exact:true}).click();
  await screenshot('03-pagamento');
  const paid = page.waitForResponse(r=>r.url().includes('/pagar')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Confirmar pagamento'}).click();
  expect((await paid).status()).toBe(200);
  expect((await db.getAsync('SELECT status FROM FaturasSaaS WHERE tenant_id=?',[id])).status).toBe('Paga');

  await page.goto(origin+'/master/comunicacao');
  await page.getByLabel('Quando enviar').selectOption('later');
  await page.getByPlaceholder('Escreva o comunicado que todas as arenas receberão...').fill('Comunicado de revisão visual');
  await page.getByRole('button',{name:'Agendar envio'}).click();
  await page.getByRole('alert').getByText('Escolha uma data e hora futuras para o envio.').waitFor();
  await screenshot('04-erro-agendamento');
  await page.getByLabel('Data e hora do envio (horário local)').fill('2099-10-10T14:30');
  const scheduled = page.waitForResponse(r=>r.url().endsWith('/api/saas/comunicados')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Agendar envio'}).click();
  expect((await scheduled).status()).toBe(200);
  await page.getByText('Agendado',{exact:true}).waitFor();
  await screenshot('05-comunicado');
  await page.setViewportSize({width:390,height:844});
  const mobileMenu = page.getByRole('button',{name:'Alternar menu'});
  if (await mobileMenu.getAttribute('aria-expanded') === 'true') await mobileMenu.click();
  await screenshot('06-comunicado-mobile');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.setViewportSize({width:1440,height:1000});

  await page.goto(origin+'/master/usuarios');
  await page.getByTitle('Últimos acessos').first().click();
  await page.getByText('Nenhum log de acesso encontrado para este usuário.').waitFor();
  await screenshot('07-acessos');
  await page.keyboard.press('Escape');
  // Modal close is available even when the page does not implement Escape.
  const close = page.getByRole('button',{name:'Fechar',exact:true});
  if (await close.count()) await close.last().click();
  await page.getByTitle('Resetar senha').first().click();
  await page.getByRole('button',{name:'Enviar link por e-mail'}).waitFor();
  await screenshot('08-recuperacao');
  expect(await page.locator('body').innerText()).not.toContain('arena123');
  expect(errors).toEqual([]);
  await fs.writeFile(path.join(output,'browser-report.json'),JSON.stringify({browser:'Edge headless',viewports:['1440x1000','390x844'],passed:true,screenshots:8,pageErrors:errors,dialogs,externalTraffic:'blocked',database:':memory:',email:'mocked'},null,2));
},120000);
