import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const instanceTools = createRequire(import.meta.url)('./homologacao_instance.cjs');
const instance = instanceTools.resolveInstance();
instanceTools.verifySnapshot(instance);
const config = JSON.parse(fs.readFileSync(path.join(instance, 'config.json'), 'utf8'));
// Existing source/config, isolated ports, cache and API; do not load real .env files.
for (const [folder, port] of [['frontend', 5183], ['tela cliente', 5186]]) {
  const project = path.join(instance, folder);
  const installedProject = path.join(root, folder);
  const projectRequire = createRequire(path.join(installedProject, 'package.json'));
  const { default: react } = await import(pathToFileURL(projectRequire.resolve('@vitejs/plugin-react')));
  const dependencies = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8')).dependencies;
  const { default: tailwindConfig } = await import(pathToFileURL(path.join(project, 'tailwind.config.js')));
  const isolatedTailwind = { ...tailwindConfig, content: tailwindConfig.content.map(pattern => path.resolve(project, pattern).replaceAll('\\', '/')) };
  const { createServer } = await import(pathToFileURL(path.join(installedProject, 'node_modules/vite/dist/node/index.js')));
  const server = await createServer({
    root: project, configFile: false, plugins: [react()],
    resolve: { alias: Object.keys(dependencies).map(name => ({ find: name, replacement: path.join(installedProject, 'node_modules', name) })) },
    envDir: instance, cacheDir: path.join(instance, 'vite-cache-' + port),
    css: { postcss: { plugins: [projectRequire('tailwindcss')(isolatedTailwind), projectRequire('autoprefixer')()] } },
    define: { 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(config.GOOGLE_CLIENT_ID), 'import.meta.env.VITE_API_URL': JSON.stringify('') },
    server: { host: '127.0.0.1', port, strictPort: true, open: false,
      proxy: { '/api': { target: 'http://127.0.0.1:' + config.PORT, changeOrigin: true }, '/uploads': { target: 'http://127.0.0.1:' + config.PORT, changeOrigin: true } } },
  });
  await server.listen();
  console.log(`Homologation ${folder}: http://localhost:${port}`);
}
