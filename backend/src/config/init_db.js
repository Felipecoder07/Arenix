const db = require('./database');

const initDb = () => {
  db.serialize(() => {
    // Tabela Arenas (Empresas/Locais)
    db.run(`
      CREATE TABLE IF NOT EXISTS Arenas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        endereco TEXT,
        telefone TEXT,
        email TEXT,
        notif_reserva_email INTEGER DEFAULT 1,
        notif_reserva_whatsapp INTEGER DEFAULT 0,
        notif_cancelamento_email INTEGER DEFAULT 1,
        notif_pagamento_email INTEGER DEFAULT 1,
        alerta_pagamento_minutos INTEGER DEFAULT 30,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela Usuarios (Admin, Gerente, Recepcionista)
    db.run(`
      CREATE TABLE IF NOT EXISTS Usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        cliente_id INTEGER,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha_hash TEXT NOT NULL,
        perfil TEXT CHECK(perfil IN ('Administrador', 'Gerente', 'Recepcionista', 'Cliente')) NOT NULL,
        ativo INTEGER DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES Arenas(id),
        FOREIGN KEY (cliente_id) REFERENCES Clientes(id)
      )
    `);

    // Tabela Clientes
    db.run(`
      CREATE TABLE IF NOT EXISTS Clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL DEFAULT 1,
        nome TEXT NOT NULL,
        telefone TEXT,
        email TEXT UNIQUE,
        cpf TEXT UNIQUE,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES Arenas (id)
      )
    `);

    // Tabela Quadras
    db.run(`
      CREATE TABLE IF NOT EXISTS Quadras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER DEFAULT 1,
        nome TEXT NOT NULL,
        tipo TEXT,
        preco_base REAL NOT NULL,
        hora_abertura TIME DEFAULT '07:00',
        hora_fechamento TIME DEFAULT '22:00',
        status TEXT DEFAULT 'Ativa',
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela Reservas
    db.run(`
      CREATE TABLE IF NOT EXISTS Reservas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER DEFAULT 1,
        cliente_id INTEGER NOT NULL,
        quadra_id INTEGER NOT NULL,
        data_reserva DATE NOT NULL,
        hora_inicio TIME NOT NULL,
        hora_fim TIME NOT NULL,
        valor_total REAL NOT NULL,
        status TEXT DEFAULT 'Confirmada', 
        status_pagamento TEXT DEFAULT 'Pendente',
        motivo_cancelamento_id INTEGER,
        observacoes_cancelamento TEXT,
        criado_por INTEGER,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES Clientes (id),
        FOREIGN KEY (quadra_id) REFERENCES Quadras (id),
        FOREIGN KEY (criado_por) REFERENCES Usuarios (id)
      )
    `);

    // Tabela Pagamentos
    db.run(`
      CREATE TABLE IF NOT EXISTS Pagamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reserva_id INTEGER NOT NULL,
        valor REAL NOT NULL,
        metodo TEXT NOT NULL,
        registrado_por INTEGER,
        registrado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reserva_id) REFERENCES Reservas (id),
        FOREIGN KEY (registrado_por) REFERENCES Usuarios (id)
      )
    `);

    // Tabela Bloqueios
    db.run(`
      CREATE TABLE IF NOT EXISTS Bloqueios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quadra_id INTEGER NOT NULL,
        data_bloqueio DATE NOT NULL,
        hora_inicio TIME NOT NULL,
        hora_fim TIME NOT NULL,
        motivo TEXT NOT NULL,
        criado_por INTEGER,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quadra_id) REFERENCES Quadras (id),
        FOREIGN KEY (criado_por) REFERENCES Usuarios (id)
      )
    `);

    // Tabela Motivos de Cancelamento
    db.run(`
      CREATE TABLE IF NOT EXISTS MotivosCancelamento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        motivo TEXT NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES Arenas (id)
      )
    `);

    // Logs Auditoria (Imutáveis)
    db.run(`
      CREATE TABLE IF NOT EXISTS LogsAuditoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        usuario_id INTEGER,
        evento TEXT NOT NULL,
        detalhes TEXT,
        ip TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES Arenas (id)
      )
    `);
    
    console.log('Tabelas base criadas com sucesso!');
  });
};

module.exports = initDb;
