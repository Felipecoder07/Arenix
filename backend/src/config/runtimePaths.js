const path = require('node:path');

function directory(value, fallback) {
  if (!value) return fallback;
  if (!path.isAbsolute(value)) throw new Error('Diretorio persistente deve usar caminho absoluto.');
  return path.resolve(value);
}

const dataDir = () => directory(process.env.APP_DATA_DIR, path.resolve(__dirname, '../../data'));
const uploadsDir = () => directory(process.env.UPLOADS_DIR, path.resolve(__dirname, '../../uploads'));

module.exports = { dataDir, uploadsDir };
