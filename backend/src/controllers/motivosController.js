const logger = require('../utils/safeLogger').forModule('motivosController');
const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');
const { ensureSecuritySchema } = require('../config/securitySchema');

const defaultMotivos = [
  { id: -1, motivo: 'Desistência do Cliente' },
  { id: -2, motivo: 'Condições Climáticas' },
  { id: -3, motivo: 'Manutenção da Quadra' }
];

const listarMotivos = async (req, res) => {
  const tenant_id = req.user.tenant_id;
  try {
    const motivos = await db.allAsync(`SELECT * FROM MotivosCancelamento WHERE tenant_id = ? ORDER BY id ASC`, [tenant_id]);
    res.json([...defaultMotivos, ...motivos]);
  } catch (error) {
    logger.error('Erro ao buscar motivos de cancelamento:', error);
    res.status(500).json({ error: 'Erro ao buscar motivos de cancelamento.' });
  }
};

const estatisticasMotivos = async (req, res) => {
  try {
    await ensureSecuritySchema(db);
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const inicio30Dias = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const tenantId = req.user.tenant_id;
    const [mes, ultimos30Dias] = await Promise.all([
      db.getAsync(`
        SELECT COUNT(*) AS total, COALESCE(SUM(r.valor_total), 0) AS valor_total
        FROM BookingCancellations b
        JOIN Reservas r ON r.id = b.reserva_id
        WHERE r.tenant_id = ? AND r.status = 'Cancelada'
          AND b.created >= ? AND b.created <= ?
      `, [tenantId, inicioMes, now.getTime()]),
      db.allAsync(`
        SELECT r.motivo_cancelamento_id AS id, b.reason AS motivo, COUNT(*) AS total
        FROM BookingCancellations b
        JOIN Reservas r ON r.id = b.reserva_id
        WHERE r.tenant_id = ? AND r.status = 'Cancelada'
          AND b.created >= ? AND b.created <= ?
        GROUP BY r.motivo_cancelamento_id, b.reason
      `, [tenantId, inicio30Dias, now.getTime()])
    ]);
    const porMotivo = ultimos30Dias.map(row => ({
      id: row.id == null ? null : Number(row.id),
      motivo: row.motivo,
      total: Number(row.total)
    }));
    res.json({
      mes: { total: Number(mes.total), valorTotal: Number(mes.valor_total) / 100 },
      ultimos30Dias: {
        total: porMotivo.reduce((sum, row) => sum + row.total, 0),
        porMotivo
      }
    });
  } catch (error) {
    logger.error('Erro ao buscar estatísticas de cancelamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas de cancelamentos.' });
  }
};

const criarMotivo = async (req, res) => {
  const tenant_id = req.user.tenant_id;
  const admin_id = req.user.id;
  const ip = req.headers['x-forwarded-for'] || req.ip;
  const { motivo } = req.body;

  if (!motivo) {
    return res.status(400).json({ error: 'O nome do motivo é obrigatório.' });
  }

  try {
    const result = await db.runAsync(
      `INSERT INTO MotivosCancelamento (tenant_id, motivo) VALUES (?, ?)`,
      [tenant_id, motivo]
    );

    logAuditEvent(admin_id, 'Criação de Motivo', `Adicionou o motivo de cancelamento ID ${result.lastID}`, ip);
    res.status(201).json({ id: result.lastID, motivo });
  } catch (error) {
    logger.error('Erro ao criar motivo de cancelamento:', error);
    res.status(500).json({ error: 'Erro ao criar motivo de cancelamento.' });
  }
};

const excluirMotivo = async (req, res) => {
  const { id } = req.params;
  const tenant_id = req.user.tenant_id;
  const admin_id = req.user.id;
  const ip = req.headers['x-forwarded-for'] || req.ip;

  try {
    if (Number.parseInt(id) < 0) {
      return res.status(403).json({ error: 'Não é possível excluir os motivos predefinidos do sistema.' });
    }

    const result = await db.runAsync(`DELETE FROM MotivosCancelamento WHERE id = ? AND tenant_id = ?`, [id, tenant_id]);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Motivo não encontrado.' });
    }

    logAuditEvent(admin_id, 'Exclusão de Motivo', `Removeu o motivo de cancelamento ID ${id}`, ip);
    res.json({ message: 'Motivo de cancelamento excluído com sucesso.' });
  } catch (error) {
    logger.error('Erro ao excluir motivo de cancelamento:', error);
    res.status(500).json({ error: 'Erro ao excluir motivo de cancelamento.' });
  }
};

const atualizarMotivo = async (req, res) => {
  const { id } = req.params;
  const tenant_id = req.user.tenant_id;
  const admin_id = req.user.id;
  const ip = req.headers['x-forwarded-for'] || req.ip;
  const { motivo } = req.body;

  if (!motivo || !motivo.trim()) {
    return res.status(400).json({ error: 'O nome do motivo é obrigatório.' });
  }

  try {
    if (Number.parseInt(id) < 0) {
      return res.status(403).json({ error: 'Não é possível editar os motivos predefinidos do sistema.' });
    }

    const result = await db.runAsync(
      `UPDATE MotivosCancelamento SET motivo = ? WHERE id = ? AND tenant_id = ?`,
      [motivo.trim(), id, tenant_id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Motivo não encontrado.' });
    }

    logAuditEvent(admin_id, 'Atualização de Motivo', `Atualizou o motivo de cancelamento ID ${id} para "${motivo.trim()}"`, ip);
    res.json({ id: Number(id), motivo: motivo.trim() });
  } catch (error) {
    logger.error('Erro ao atualizar motivo de cancelamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar motivo de cancelamento.' });
  }
};

module.exports = {
  listarMotivos,
  estatisticasMotivos,
  criarMotivo,
  atualizarMotivo,
  excluirMotivo
};
