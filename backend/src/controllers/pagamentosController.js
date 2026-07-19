const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');

// Função auxiliar para recalcular status da reserva com base nos pagamentos efetuados (RN-005 e RN-006)
const atualizarStatusReserva = async (reserva_id, tenant_id) => {
  const reserva = await db.getAsync('SELECT valor_total FROM Reservas WHERE id = ? AND tenant_id = ?', [reserva_id, tenant_id]);
  const resultPagamentos = await db.getAsync('SELECT SUM(valor) as total_pago FROM Pagamentos WHERE reserva_id = ?', [reserva_id]);

  const totalPago = resultPagamentos.total_pago || 0;
  const saldoDevedor = reserva.valor_total - totalPago;

  let novoStatus = 'Pendente';
  if (saldoDevedor <= 0) novoStatus = 'Pago';
  else if (totalPago > 0) novoStatus = 'Parcial';

  await db.runAsync('UPDATE Reservas SET status_pagamento = ? WHERE id = ?', [novoStatus, reserva_id]);
  return { totalPago, saldoDevedor, novoStatus };
};

const registrarPagamento = async (req, res) => {
  try {
    const { reserva_id, valor, metodo } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.ip;
    const usuario_id = req.user ? req.user.id : null;

    if (valor <= 0) return res.status(400).json({ error: 'O valor deve ser maior que zero.' });

    // Validar se o valor excede o saldo devedor
    const reserva = await db.getAsync('SELECT valor_total FROM Reservas WHERE id = ? AND tenant_id = ?', [reserva_id, req.user.tenant_id]);
    if (!reserva) return res.status(404).json({ error: 'Reserva não encontrada.' });
    
    const resultPagamentos = await db.getAsync('SELECT SUM(valor) as total_pago FROM Pagamentos WHERE reserva_id = ?', [reserva_id]);
    const totalPago = resultPagamentos.total_pago || 0;
    const saldoAtual = reserva.valor_total - totalPago;

    if (valor > saldoAtual) {
      return res.status(400).json({ error: `O valor (R$ ${valor.toFixed(2)}) não pode ser maior que o saldo devedor (R$ ${saldoAtual.toFixed(2)}).` });
    }

    // Salvar pagamento no histórico
    const insert = await db.runAsync(
      'INSERT INTO Pagamentos (reserva_id, valor, metodo, registrado_por) VALUES (?, ?, ?, ?)',
      [reserva_id, valor, metodo, usuario_id]
    );

    // Calcular novo saldo (RN-005) e atualizar status da reserva (RN-006)
    const { saldoDevedor, novoStatus } = await atualizarStatusReserva(reserva_id, req.user.tenant_id);

    logAuditEvent(usuario_id, 'Pagamento Registrado', `Reserva: ${reserva_id}, Valor: ${valor}, Método: ${metodo}`, ip);

    res.status(201).json({
      message: 'Pagamento registrado com sucesso.',
      pagamento_id: insert.lastID,
      saldo_devedor: saldoDevedor,
      status_pagamento: novoStatus
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno ao registrar pagamento.' });
  }
};

const aplicarDesconto = async (req, res) => {
  try {
    const { reserva_id, desconto_percentual } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.ip;
    const usuario = req.user;

    // RN-007: Gerentes podem dar até 30% de desconto. Admins não tem limite.
    if (usuario.perfil === 'Gerente' && desconto_percentual > 30) {
      return res.status(403).json({ error: 'Gerentes só podem aplicar no máximo 30% de desconto.' });
    }

    const reserva = await db.getAsync('SELECT valor_total FROM Reservas WHERE id = ? AND tenant_id = ?', [reserva_id, req.user.tenant_id]);
    if (!reserva) return res.status(404).json({ error: 'Reserva não encontrada.' });

    const valorDesconto = reserva.valor_total * (desconto_percentual / 100);
    const novoValorTotal = reserva.valor_total - valorDesconto;

    await db.runAsync('UPDATE Reservas SET valor_total = ? WHERE id = ?', [novoValorTotal, reserva_id]);
    const { saldoDevedor, novoStatus } = await atualizarStatusReserva(reserva_id, req.user.tenant_id);

    logAuditEvent(usuario.id, 'Desconto Aplicado', `Reserva: ${reserva_id}, Desconto: ${desconto_percentual}%`, ip);

    res.json({
      message: 'Desconto aplicado com sucesso.',
      novo_valor_total: novoValorTotal,
      saldo_devedor: saldoDevedor
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao aplicar desconto.' });
  }
};

const registrarEstorno = async (req, res) => {
  try {
    const { pagamento_id, reserva_id, valor, motivo, motivo_estorno } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.ip;
    const usuario = req.user;
    const descMotivo = motivo || motivo_estorno || 'Estorno parcial';

    // RN-008: Apenas Admin pode estornar
    if (usuario.perfil !== 'Administrador') {
      return res.status(403).json({ error: 'Apenas Administradores podem realizar estornos.' });
    }

    let finalReservaId;
    let maxEstornavel = 0;

    if (pagamento_id) {
      const pagamento = await db.getAsync(
        'SELECT p.* FROM Pagamentos p JOIN Reservas r ON p.reserva_id = r.id WHERE p.id = ? AND r.tenant_id = ?',
        [pagamento_id, req.user.tenant_id]
      );
      if (!pagamento) return res.status(404).json({ error: 'Pagamento não encontrado.' });
      if (pagamento.valor < 0) return res.status(400).json({ error: 'Pagamento já é um estorno.' });
      
      finalReservaId = pagamento.reserva_id;
      maxEstornavel = pagamento.valor;
    } else if (reserva_id) {
      const reserva = await db.getAsync(
        'SELECT r.*, COALESCE((SELECT SUM(p.valor) FROM Pagamentos p WHERE p.reserva_id = r.id), 0) AS total_pago FROM Reservas r WHERE r.id = ? AND r.tenant_id = ?',
        [reserva_id, req.user.tenant_id]
      );
      if (!reserva) return res.status(404).json({ error: 'Reserva não encontrada.' });
      
      finalReservaId = reserva.id;
      maxEstornavel = reserva.total_pago;
    } else {
      return res.status(400).json({ error: 'É necessário informar pagamento_id ou reserva_id.' });
    }

    const valorEstornoInfo = valor !== undefined ? parseFloat(valor) : maxEstornavel;
    if (isNaN(valorEstornoInfo) || valorEstornoInfo <= 0) {
      return res.status(400).json({ error: 'O valor do estorno deve ser maior que zero.' });
    }

    if (valorEstornoInfo > maxEstornavel) {
      return res.status(400).json({ error: `O valor do estorno (R$ ${valorEstornoInfo.toFixed(2)}) não pode ser maior que o saldo disponível para estorno (R$ ${maxEstornavel.toFixed(2)}).` });
    }

    // Criar um pagamento negativo para representar o estorno e manter rastreabilidade
    const valorEstornoNegativo = -Math.abs(valorEstornoInfo);
    await db.runAsync(
      'INSERT INTO Pagamentos (reserva_id, valor, metodo, registrado_por) VALUES (?, ?, ?, ?)',
      [finalReservaId, valorEstornoNegativo, 'Estorno', usuario.id]
    );

    const { saldoDevedor, novoStatus } = await atualizarStatusReserva(finalReservaId, req.user.tenant_id);

    logAuditEvent(usuario.id, 'Estorno Realizado', `Reserva: ${finalReservaId}, Valor: ${Math.abs(valorEstornoNegativo)}, Motivo: ${descMotivo}`, ip);

    res.json({
      message: 'Estorno realizado com sucesso.',
      saldo_devedor: saldoDevedor,
      status_pagamento: novoStatus
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao registrar estorno.' });
  }
};

// ─── RESUMO KPI ───────────────────────────────────────────────────────────────
const resumoPagamentos = async (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const tenant_id = req.user.tenant_id;
    const mes = hoje.substring(0, 7);
    const hora = new Date().toTimeString().substring(0, 5);

    // Recebido hoje
    const recebidoHoje = await db.getAsync(
      `SELECT COALESCE(SUM(p.valor),0) as total, COUNT(CASE WHEN p.valor > 0 THEN 1 END) as qtd FROM Pagamentos p JOIN Reservas r ON p.reserva_id = r.id WHERE DATE(p.registrado_em) = ? AND r.tenant_id = ?`,
      [hoje, tenant_id]);

    // Pendente hoje
    const pendenteHoje = await db.allAsync(
      `SELECT r.valor_total, COALESCE((SELECT SUM(valor) FROM Pagamentos WHERE reserva_id = r.id),0) as pago
       FROM Reservas r WHERE r.data_reserva = ? AND r.status != 'Cancelada' AND r.status_pagamento != 'Pago' AND r.tenant_id = ?`,
      [hoje, tenant_id]);
    const totalPendenteHoje = pendenteHoje.reduce((acc, r) => acc + Math.max(0, r.valor_total - r.pago), 0);

    // Recebido no mês
    const recebidoMes = await db.getAsync(
      `SELECT COALESCE(SUM(p.valor),0) as total FROM Pagamentos p JOIN Reservas r ON p.reserva_id = r.id WHERE strftime('%Y-%m', p.registrado_em) = ? AND r.tenant_id = ?`,
      [mes, tenant_id]);

    // Inadimplência global para o card
    const inadimplentes = await db.allAsync(
      `SELECT r.valor_total, COALESCE((SELECT SUM(valor) FROM Pagamentos WHERE reserva_id = r.id),0) as pago
       FROM Reservas r WHERE r.status != 'Cancelada' AND r.status_pagamento != 'Pago'`
    );
    const totalInadimplencia = inadimplentes.reduce((acc, r) => acc + Math.max(0, r.valor_total - r.pago), 0);

    // Contagens Globais para as Tabs
    const countPendentes = await db.getAsync(`SELECT COUNT(*) as c FROM Reservas WHERE status != 'Cancelada' AND status_pagamento != 'Pago' AND tenant_id = ?`, [tenant_id]);
    const countPagos = await db.getAsync(`SELECT COUNT(*) as c FROM Reservas WHERE status != 'Cancelada' AND status_pagamento = 'Pago' AND tenant_id = ?`, [tenant_id]);
    const countTodos = await db.getAsync(`SELECT COUNT(*) as c FROM Reservas WHERE status != 'Cancelada' AND tenant_id = ?`, [tenant_id]);
    const countInadimplentes = await db.getAsync(`
      SELECT COUNT(*) as c FROM Reservas 
      WHERE status != 'Cancelada' AND status_pagamento != 'Pago' AND tenant_id = ?
      AND (data_reserva < ? OR (data_reserva = ? AND hora_fim < ?))
    `, [tenant_id, hoje, hoje, hora]);

    res.json({
      recebidoHoje: recebidoHoje.total,
      qtdPagamentosHoje: recebidoHoje.qtd,
      pendenteHoje: totalPendenteHoje,
      qtdPendenteHoje: pendenteHoje.length,
      recebidoMes: recebidoMes.total,
      totalInadimplencia,
      qtdInadimplentes: countInadimplentes.c,
      countsGlobais: {
        pendentes: countPendentes.c,
        pagos: countPagos.c,
        todos: countTodos.c,
        inadimplentes: countInadimplentes.c
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar resumo de pagamentos.' });
  }
};

// ─── LISTAGEM DE RESERVAS COM PAGAMENTOS ─────────────────────────────────────
const listarReservasPagamentos = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;
    const { status, busca, data } = req.query;

    let where = `r.tenant_id = ? AND r.status != 'Cancelada'`;
    const params = [tenant_id];

    if (status === 'Pendente') {
      where += ` AND r.status_pagamento IN ('Pendente', 'Parcial')`;
    } else if (status === 'Pago') {
      where += ` AND r.status_pagamento = 'Pago'`;
    } else if (status === 'inadimplentes') {
      // reservas cujo horário já passou e ainda não foram pagas
      const hoje = new Date().toISOString().split('T')[0];
      const tenant_id = req.user.tenant_id;
      const hora = new Date().toTimeString().substring(0, 5);
      where += ` AND r.status_pagamento != 'Pago'
                 AND (r.data_reserva < ? OR (r.data_reserva = ? AND r.hora_fim < ?))`;
      params.push(hoje, hoje, hora);
    }

    if (data) {
      where += ` AND r.data_reserva = ?`;
      params.push(data);
    }

    if (busca) {
      where += ` AND (c.nome LIKE ? OR CAST(r.id AS TEXT) LIKE ?)`;
      params.push(`%${busca}%`, `%${busca}%`);
    }

    const reservas = await db.allAsync(`
      SELECT
        r.id, r.data_reserva, r.hora_inicio, r.hora_fim,
        r.valor_total, r.status, r.status_pagamento,
        c.nome AS cliente_nome, c.telefone AS cliente_telefone,
        q.nome AS quadra_nome,
        COALESCE((SELECT SUM(valor) FROM Pagamentos WHERE reserva_id = r.id), 0) AS total_pago,
        COALESCE((SELECT GROUP_CONCAT(DISTINCT metodo) FROM Pagamentos WHERE reserva_id = r.id AND metodo != 'Estorno'), '') AS metodos
      FROM Reservas r
      JOIN Clientes c ON r.cliente_id = c.id
      JOIN Quadras q ON r.quadra_id = q.id
      WHERE ${where}
      ORDER BY r.data_reserva DESC, r.hora_inicio DESC
    `, params);

    const comSaldo = reservas.map(r => ({
      ...r,
      saldo_devedor: Math.max(0, r.valor_total - r.total_pago)
    }));

    res.json(comSaldo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar reservas para pagamentos.' });
  }
};

module.exports = { registrarPagamento, aplicarDesconto, registrarEstorno, resumoPagamentos, listarReservasPagamentos };
