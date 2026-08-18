const db = require('../config/database');

// Listar quadras filtrando pelo tenant do usuário logado
const listarQuadras = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const quadras = await db.allAsync('SELECT * FROM Quadras WHERE tenant_id = ? ORDER BY nome ASC', [tenant_id]);
    
    const formatted = quadras.map(q => {
      let modalidades = [];
      if (q.modalidades) {
        try {
          modalidades = typeof q.modalidades === 'string' ? JSON.parse(q.modalidades) : q.modalidades;
        } catch {
          modalidades = [{ nome: q.tipo || 'Beach Tennis', preco: q.preco_base || 80 }];
        }
      } else if (q.tipo) {
        modalidades = q.tipo === 'Areia' 
          ? [
              { nome: 'Beach Tennis', preco: q.preco_base || 80 },
              { nome: 'Vôlei de Praia', preco: q.preco_base || 80 },
              { nome: 'Futevôlei', preco: q.preco_base || 80 }
            ]
          : [{ nome: q.tipo, preco: q.preco_base || 80 }];
      }

      const normalizedModalidades = (Array.isArray(modalidades) ? modalidades : []).map(m => {
        if (typeof m === 'string') {
          return { nome: m, preco: q.preco_base || 80 };
        }
        return { nome: m.nome, preco: Number(m.preco != null ? m.preco : q.preco_base || 80) };
      });

      return { ...q, modalidades: normalizedModalidades };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Erro ao buscar quadras:', error);
    res.status(500).json({ error: 'Erro ao buscar quadras.' });
  }
};

// Criar nova quadra
const criarQuadra = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const { nome, tipo, modalidades, preco_base, hora_abertura, hora_fechamento } = req.body;

    if (!nome || !tipo) {
      return res.status(400).json({ error: 'Nome e tipo de quadra são obrigatórios.' });
    }

    const basePrice = preco_base != null ? Number(preco_base) : 80;

    let modalList = [];
    if (Array.isArray(modalidades) && modalidades.length > 0) {
      modalList = modalidades.map(m => {
        if (typeof m === 'string') return { nome: m, preco: basePrice };
        return { nome: m.nome, preco: Number(m.preco != null ? m.preco : basePrice) };
      });
    } else {
      modalList = tipo === 'Areia'
        ? [
            { nome: 'Beach Tennis', preco: basePrice },
            { nome: 'Vôlei de Praia', preco: basePrice },
            { nome: 'Futevôlei', preco: basePrice }
          ]
        : [{ nome: tipo, preco: basePrice }];
    }

    const modalJson = JSON.stringify(modalList);

    const insert = await db.runAsync(
      `INSERT INTO Quadras (tenant_id, nome, tipo, modalidades, preco_base, hora_abertura, hora_fechamento, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Ativa')`,
      [
        tenant_id, 
        nome, 
        tipo, 
        modalJson,
        basePrice, 
        hora_abertura || '07:00', 
        hora_fechamento || '22:00'
      ]
    );

    res.status(201).json({ 
      id: insert.lastID, 
      nome, 
      tipo, 
      modalidades: modalList,
      preco_base: basePrice, 
      hora_abertura,
      hora_fechamento,
      status: 'Ativa' 
    });
  } catch (error) {
    console.error('Erro ao criar quadra:', error);
    res.status(500).json({ error: 'Erro ao criar quadra.' });
  }
};

// Atualizar quadra
const atualizarQuadra = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const quadraId = req.params.id;
    const { nome, tipo, modalidades, preco_base, hora_abertura, hora_fechamento, status } = req.body;

    // Verificar se a quadra existe e pertence ao tenant
    const quadra = await db.getAsync('SELECT id FROM Quadras WHERE id = ? AND tenant_id = ?', [quadraId, tenant_id]);
    if (!quadra) {
      return res.status(404).json({ error: 'Quadra não encontrada.' });
    }

    const basePrice = preco_base != null ? Number(preco_base) : 80;

    let modalList = [];
    if (Array.isArray(modalidades) && modalidades.length > 0) {
      modalList = modalidades.map(m => {
        if (typeof m === 'string') return { nome: m, preco: basePrice };
        return { nome: m.nome, preco: Number(m.preco != null ? m.preco : basePrice) };
      });
    } else {
      modalList = tipo === 'Areia'
        ? [
            { nome: 'Beach Tennis', preco: basePrice },
            { nome: 'Vôlei de Praia', preco: basePrice },
            { nome: 'Futevôlei', preco: basePrice }
          ]
        : [{ nome: tipo || 'Beach Tennis', preco: basePrice }];
    }

    const modalJson = JSON.stringify(modalList);

    await db.runAsync(
      `UPDATE Quadras 
       SET nome = ?, tipo = ?, modalidades = ?, preco_base = ?, hora_abertura = ?, hora_fechamento = ?, status = ?
       WHERE id = ?`,
      [nome, tipo, modalJson, basePrice, hora_abertura, hora_fechamento, status, quadraId]
    );

    res.json({ message: 'Quadra atualizada com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar quadra:', error);
    res.status(500).json({ error: 'Erro ao atualizar quadra.' });
  }
};

// Alternar status da quadra (Ativar/Desativar em vez de excluir)
const alterarStatusQuadra = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const quadraId = req.params.id;
    const { status } = req.body;

    const quadra = await db.getAsync('SELECT id FROM Quadras WHERE id = ? AND tenant_id = ?', [quadraId, tenant_id]);
    if (!quadra) {
      return res.status(404).json({ error: 'Quadra não encontrada.' });
    }

    await db.runAsync('UPDATE Quadras SET status = ? WHERE id = ?', [status, quadraId]);
    res.json({ message: `Quadra marcada como ${status}` });
  } catch (error) {
    console.error('Erro ao alterar status:', error);
    res.status(500).json({ error: 'Erro interno ao alterar status.' });
  }
};

// Criar Bloqueio
const criarBloqueio = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const { quadra_id, data_bloqueio, hora_inicio, hora_fim, motivo } = req.body;

    // TODO: checar se quadra pertence ao tenant

    const insert = await db.runAsync(`
      INSERT INTO Bloqueios (quadra_id, data_bloqueio, hora_inicio, hora_fim, motivo, criado_por)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [quadra_id, data_bloqueio, hora_inicio, hora_fim, motivo, req.user.id]);

    res.status(201).json({ message: 'Bloqueio criado com sucesso', id: insert.lastID });
  } catch (error) {
    console.error('Erro ao criar bloqueio:', error);
    res.status(500).json({ error: 'Erro interno ao criar bloqueio.' });
  }
};

// Excluir Quadra
const deletarQuadra = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const quadraId = req.params.id;

    const quadra = await db.getAsync('SELECT id FROM Quadras WHERE id = ? AND tenant_id = ?', [quadraId, tenant_id]);
    if (!quadra) {
      return res.status(404).json({ error: 'Quadra não encontrada.' });
    }

    // Trava de segurança: verificar se há reservas
    const reservas = await db.getAsync('SELECT COUNT(*) as count FROM Reservas WHERE quadra_id = ?', [quadraId]);
    if (reservas && reservas.count > 0) {
      return res.status(400).json({ error: 'Não é possível excluir esta quadra pois ela possui histórico de reservas. Por favor, utilize a opção "Desativar".' });
    }

    await db.runAsync('DELETE FROM Quadras WHERE id = ?', [quadraId]);
    res.json({ message: 'Quadra excluída com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir quadra:', error);
    res.status(500).json({ error: 'Erro interno ao excluir quadra.' });
  }
};

module.exports = { listarQuadras, criarQuadra, atualizarQuadra, alterarStatusQuadra, criarBloqueio, deletarQuadra };
