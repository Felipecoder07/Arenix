const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.resolve(__dirname, 'data/courtmanager.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Iniciando recuperação de emergência do Master Admin...');

db.serialize(async () => {
  try {
    // 1. Gera o hash da senha padrão 'admin123'
    const defaultPassword = 'admin123';
    const hash = await bcrypt.hash(defaultPassword, 12);
    const defaultSecret = 'JBSWY3DPEHPK3PXP';

    // 2. Atualiza a conta do SuperAdmin no banco
    db.run(
      "UPDATE Usuarios SET senha_hash = ?, two_factor_secret = ? WHERE perfil = 'SuperAdmin'",
      [hash, defaultSecret],
      function (err) {
        if (err) {
          console.error('❌ Erro ao atualizar o banco de dados:', err.message);
          process.exit(1);
        }
        
        if (this.changes === 0) {
          console.warn('⚠️ Nenhuma conta de SuperAdmin encontrada no banco de dados.');
        } else {
          console.log('✅ CONTA MASTER RECUPERADA COM SUCESSO!');
          console.log('--------------------------------------------------');
          console.log('E-mail: master@courtmanager.com');
          console.log(`Senha redefinida para: ${defaultPassword}`);
          console.log(`Chave 2FA redefinida para: ${defaultSecret}`);
          console.log('--------------------------------------------------');
        }
        db.close();
        process.exit(0);
      }
    );
  } catch (err) {
    console.error('❌ Erro inesperado:', err);
    db.close();
    process.exit(1);
  }
});
