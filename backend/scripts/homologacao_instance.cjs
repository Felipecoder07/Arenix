const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
function resolveInstance(args = process.argv.slice(2), projectRoot = root) {
  const name = args.find(arg => arg.startsWith('--instance='))?.slice(11) || 'instance';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name)) throw new Error('Invalid instance name.');
  const base = path.join(projectRoot, '.local-security', 'homologacao');
  const target = path.join(base, name);
  // Reject symlinks/junctions in every existing path component.
  for (let candidate = target; candidate !== path.dirname(candidate); candidate = path.dirname(candidate)) {
    if (fs.existsSync(candidate) && fs.lstatSync(candidate).isSymbolicLink()) throw new Error('Instance path cannot contain links.');
    if (candidate === projectRoot) break;
  }
  return target;
}
const directories = ['backend/src', 'backend/scripts', 'backend/tests', 'scripts', 'frontend/src', 'frontend/tests', 'frontend/public', 'tela cliente/src', 'tela cliente/public'];
const files = ['package.json','package-lock.json', ...['backend','frontend','tela cliente'].flatMap(project =>
  ['package.json','package-lock.json','index.html','vite.config.ts','vitest.config.ts','vitest.config.mjs','tailwind.config.js',
    'postcss.config.js','tsconfig.json','tsconfig.app.json','tsconfig.node.json','eslint.config.js'].map(file => `${project}/${file}`))];
function inventory(projectRoot = root) {
  const hashes = {};
  function visit(relative) {
    const file = path.join(projectRoot, relative);
    if (!fs.existsSync(file)) return;
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error('Source links are not supported in snapshots.');
    if (stat.isDirectory()) for (const entry of fs.readdirSync(file).sort()) visit(relative + '/' + entry);
    else hashes[relative] = digest(fs.readFileSync(file));
  }
  [...directories, ...files].sort().forEach(visit);
  return hashes;
}
function dependencies(projectRoot = root) {
  return Object.fromEntries(['backend','frontend','tela cliente'].map(project => {
    const installed = path.join(projectRoot, project, 'node_modules/.package-lock.json');
    return [project, fs.existsSync(installed) ? digest(fs.readFileSync(installed)) : null];
  }));
}
function prepareSnapshot(target, projectRoot = root) {
  if (fs.existsSync(target)) throw new Error('Instance already exists; preserved without overwriting.');
  const hashes = inventory(projectRoot);
  fs.mkdirSync(target, { recursive: true });
  for (const relative of Object.keys(hashes)) {
    const dest = path.join(target, relative);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(projectRoot, relative), dest);
  }
  const manifest = { version: 2, createdAt: new Date().toISOString(), node: process.version,
    hashes, dependencies: dependencies(projectRoot), digest: digest(JSON.stringify(hashes)) };
  fs.writeFileSync(path.join(target, 'source-manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}
function verifySnapshot(target, { current = true, projectRoot = root } = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(target, 'source-manifest.json'), 'utf8'));
  if (manifest.version !== 2) throw new Error('Legacy snapshot: prepare a new named instance.');
  if (manifest.node !== process.version) throw new Error('Node version differs from snapshot.');
  const expected = JSON.stringify(manifest.hashes);
  if (JSON.stringify(inventory(target)) !== expected) throw new Error('Snapshot sources differ from manifest.');
  if (current && JSON.stringify(inventory(projectRoot)) !== expected) throw new Error('Workspace changed; prepare a new snapshot.');
  if (JSON.stringify(dependencies(projectRoot)) !== JSON.stringify(manifest.dependencies)) throw new Error('Installed dependency manifest changed.');
  return manifest;
}
function config(target = resolveInstance()) { return JSON.parse(fs.readFileSync(path.join(target, 'config.json'), 'utf8')); }
function testBuyerEmail(settings) {
  const email = String(settings.MERCADO_PAGO_TEST_BUYER_EMAIL || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.toLowerCase() === 'comprador@example.com') {
    throw new Error('An explicit test buyer email is required for Pix homologation.');
  }
  return email;
}
module.exports = { root, resolveInstance, inventory, dependencies, prepareSnapshot, verifySnapshot, config, digest, testBuyerEmail };
