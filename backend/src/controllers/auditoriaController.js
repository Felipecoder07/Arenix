const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');

const listarLogs = async (req, res) => {
  try {
    const { data_inicio, data_fim, busca, evento, pagina = 1, exportar } = req.query;
    const tenant_id = req.user.tenant_id;
    
    let baseQuery = `
      FROM LogsAuditoria l
      LEFT JOIN Usuarios u ON l.usuario_id = u.id
      WHERE l.tenant_id = ?
    `;
    const params = [tenant_id];

    if (data_inicio) {
      baseQuery += ` AND DATE(l.criado_em) >= ?`;
      params.push(data_inicio);
    }
    if (data_fim) {
      baseQuery += ` AND DATE(l.criado_em) <= ?`;
      params.push(data_fim);
    }
    if (evento) {
      if (evento === 'Login') {
        baseQuery += ` AND (l.evento = 'Login bem-sucedido' OR l.evento = 'Tentativa de login falha')`;
      } else if (evento === 'Logout') {
        baseQuery += ` AND l.evento = 'Logout'`;
      } else if (evento === 'Criação de reserva') {
        baseQuery += ` AND l.evento = 'Criação de reserva'`;
      } else if (evento === 'Alteração de reserva') {
        baseQuery += ` AND (l.evento = 'Alteração de reserva' OR l.evento = 'Reagendamento de Reserva')`;
      } else if (evento === 'Cancelamento de reserva') {
        baseQuery += ` AND l.evento = 'Cancelamento de reserva'`;
      } else if (evento === 'Registro de pagamento') {
        baseQuery += ` AND l.evento = 'Pagamento Registrado'`;
      } else if (evento === 'Aplicação de desconto') {
        baseQuery += ` AND l.evento = 'Desconto Aplicado'`;
      } else if (evento === 'Estorno de pagamento') {
        baseQuery += ` AND l.evento = 'Estorno Realizado'`;
      } else if (evento === 'Gestão de Quadras' || evento === 'Alteração de preço') {
        baseQuery += ` AND (l.evento = 'Criação de Quadra' OR l.evento = 'Edição de Quadra' OR l.evento = 'Status de Quadra' OR l.evento = 'Exclusão de Quadra' OR l.evento = 'Alteração de Preço')`;
      } else if (evento === 'Bloqueio de quadra') {
        baseQuery += ` AND (l.evento = 'Criação de bloqueio' OR l.evento = 'Remoção de bloqueio' OR l.evento = 'Desbloqueio Parcial')`;
      } else if (evento === 'Gestão de Usuários' || evento === 'Alteração de permissões') {
        baseQuery += ` AND (l.evento = 'Criação de Usuário' OR l.evento = 'Edição de Usuário' OR l.evento = 'Exclusão de Usuário')`;
      } else if (evento === 'Gestão de Clientes') {
        baseQuery += ` AND (l.evento = 'Criação de Cliente' OR l.evento = 'Edição de Cliente' OR l.evento = 'Arquivamento de Cliente' OR l.evento = 'Reativação de Cliente' OR l.evento = 'Exclusão de Cliente')`;
      } else if (evento === 'Exclusão de cadastro') {
        baseQuery += ` AND (l.evento = 'Exclusão de Usuário' OR l.evento = 'Exclusão de Cliente' OR l.evento = 'Arquivamento de Cliente' OR l.evento = 'Exclusão de Quadra')`;
      } else if (evento === 'Exportação de relatório') {
        baseQuery += ` AND l.evento = 'Exportação de Relatório'`;
      } else {
        baseQuery += ` AND l.evento = ?`;
        params.push(evento);
      }
    }

    if (busca) {
      baseQuery += ` AND (u.nome LIKE ? OR l.detalhes LIKE ? OR l.evento LIKE ? OR l.ip LIKE ? OR (u.nome IS NULL AND ? = 'sistema'))`;
      params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`, `%${busca}%`, busca.toLowerCase().trim());
    }

    if (exportar === 'true') {
      // Registrar log de exportação de relatório (RF-LOG-016)
      logAuditEvent(req.user.id, 'Exportação de Relatório', `Exportou relatório de auditoria (CSV) [Filtro: ${data_inicio || 'Início'} até ${data_fim || 'Hoje'}]`, req.ip);

      // Exportação total (limitada a 10.000 para segurança de memória)
      let dataQuery = `SELECT l.*, u.nome as usuario_nome ${baseQuery} ORDER BY l.criado_em DESC LIMIT 10000`;
      const logs = await db.allAsync(dataQuery, params);
      return res.json(logs);
    }

    // Fluxo normal de Paginação
    const limit = 20;
    const offset = (Math.max(1, parseInt(pagina)) - 1) * limit;

    const countResult = await db.getAsync(`SELECT COUNT(*) as total ${baseQuery}`, params);
    const totalRegistros = countResult.total || 0;
    const totalPaginas = Math.ceil(totalRegistros / limit);

    let dataQuery = `SELECT l.*, u.nome as usuario_nome ${baseQuery} ORDER BY l.criado_em DESC LIMIT ? OFFSET ?`;
    const logs = await db.allAsync(dataQuery, [...params, limit, offset]);

    // Resumo de estatísticas rápidas para o período
    let statsDateFilter = '';
    const statsParams = [tenant_id];
    if (data_inicio) {
      statsDateFilter += ` AND DATE(criado_em) >= ?`;
      statsParams.push(data_inicio);
    }
    if (data_fim) {
      statsDateFilter += ` AND DATE(criado_em) <= ?`;
      statsParams.push(data_fim);
    }

    const stats = await db.getAsync(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN evento IN ('Login bem-sucedido', 'Logout', 'Tentativa de login falha') THEN 1 ELSE 0 END) as acessos,
        SUM(CASE WHEN evento IN ('Pagamento Registrado', 'Desconto Aplicado', 'Estorno Realizado') THEN 1 ELSE 0 END) as financeiro,
        SUM(CASE WHEN evento LIKE '%Usuário%' OR evento LIKE '%Cliente%' OR evento LIKE '%Quadra%' OR evento LIKE '%bloqueio%' OR evento LIKE '%Cancelamento%' THEN 1 ELSE 0 END) as cadastrais
      FROM LogsAuditoria
      WHERE tenant_id = ? ${statsDateFilter}
    `, statsParams);

    res.json({
      logs,
      totalRegistros,
      totalPaginas,
      paginaAtual: parseInt(pagina),
      estatisticas: {
        total: stats?.total || totalRegistros,
        acessos: stats?.acessos || 0,
        financeiro: stats?.financeiro || 0,
        cadastrais: stats?.cadastrais || 0
      }
    });
  } catch (error) {
    console.error('Erro ao listar logs de auditoria:', error);
    res.status(500).json({ error: 'Erro interno ao buscar logs.' });
  }
};

module.exports = { listarLogs };
