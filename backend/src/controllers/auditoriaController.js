const db = require('../config/database');

const listarLogs = async (req, res) => {
  try {
    const { data_inicio, data_fim, busca, evento, pagina = 1, exportar } = req.query;
    
    let baseQuery = `
      FROM LogsAuditoria l
      LEFT JOIN Usuarios u ON l.usuario_id = u.id
      WHERE l.tenant_id = ?
    `;
    const params = [req.user.tenant_id];

    if (data_inicio) {
      baseQuery += ` AND DATE(l.criado_em) >= ?`;
      params.push(data_inicio);
    }
    if (data_fim) {
      baseQuery += ` AND DATE(l.criado_em) <= ?`;
      params.push(data_fim);
    }
    if (evento) {
      baseQuery += ` AND l.evento = ?`;
      params.push(evento);
    }
    if (busca) {
      baseQuery += ` AND (u.nome LIKE ? OR l.detalhes LIKE ?)`;
      params.push(`%${busca}%`, `%${busca}%`);
    }

    if (exportar === 'true') {
      // Exportação total (limitada a 10.000 para segurança de memória)
      let dataQuery = `SELECT l.*, u.nome as usuario_nome ${baseQuery} ORDER BY l.criado_em DESC LIMIT 10000`;
      const logs = await db.allAsync(dataQuery, params);
      return res.json(logs); // Retorna array direto
    }

    // Fluxo normal de Paginação
    const limit = 20;
    const offset = (Math.max(1, parseInt(pagina)) - 1) * limit;

    const countResult = await db.getAsync(`SELECT COUNT(*) as total ${baseQuery}`, params);
    const totalRegistros = countResult.total || 0;
    const totalPaginas = Math.ceil(totalRegistros / limit);

    let dataQuery = `SELECT l.*, u.nome as usuario_nome ${baseQuery} ORDER BY l.criado_em DESC LIMIT ? OFFSET ?`;
    const logs = await db.allAsync(dataQuery, [...params, limit, offset]);

    res.json({
      logs,
      totalRegistros,
      totalPaginas,
      paginaAtual: parseInt(pagina)
    });
  } catch (error) {
    console.error('Erro ao listar logs de auditoria:', error);
    res.status(500).json({ error: 'Erro interno ao buscar logs.' });
  }
};

module.exports = { listarLogs };
