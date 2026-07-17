const bcrypt = require('bcrypt');
const db = require('../config/database');

const seed = async () => {
  const senha_hash = await bcrypt.hash('admin123', 12);
  
  // Garantir que a Arena 1 existe
  db.run('INSERT OR IGNORE INTO Arenas (id, nome) VALUES (1, "Arena Principal")', (err) => {
    if(err) console.error(err);
  });

  db.run(
    'UPDATE Usuarios SET tenant_id = ?, senha_hash = ?, perfil = ? WHERE email = ?',
    [1, senha_hash, 'Administrador', 'admin@courtmanager.com'],
    function(err) {
      if (err) {
        console.error('Erro ao atualizar user:', err.message);
      } else if (this.changes === 0) {
        // Se não existir, insere
        db.run(
          'INSERT INTO Usuarios (tenant_id, nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?, ?)',
          [1, 'Administrador Teste', 'admin@courtmanager.com', senha_hash, 'Administrador'],
          (err) => {
            if (err) console.error('Erro ao criar user:', err.message);
            else console.log('Admin user criado! (admin@courtmanager.com / admin123)');
          }
        );
      } else {
        console.log('Admin user atualizado com tenant_id = 1!');
      }
    }
  );
};

seed();
