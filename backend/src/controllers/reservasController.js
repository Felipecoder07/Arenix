const logger = require('../utils/safeLogger').forModule('reservasController');
const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');
const { getTodayString, getLocalTimeString } = require('../utils/dateUtils');

// Listar grade de quadras e horários ocupados
const listarGrade = async (req, res) => {
  try {
    const { data, data_inicio, data_fim } = req.query;
    const inicio = data_inicio || data;
    const fim = data_fim || data;

    if (!inicio || !fim) return res.status(400).json({ error: 'Data ou intervalo de datas é obrigatório' });

    const tenant_id = req.user.tenant_id;

    // Pegar todas as quadras ativas
    const quadras = await db.allAsync('SELECT id,nome,tipo,modalidades,preco_base,hora_abertura,hora_fechamento,status FROM Quadras WHERE status = "Ativa" AND tenant_id = ?', [tenant_id]);

    // Pegar reservas confirmadas/pendentes/parciais do intervalo
    const reservas = await db.allAsync(`
      SELECT r.id,r.cliente_id,r.quadra_id,r.data_reserva,r.hora_inicio,r.hora_fim,r.valor_total,r.status,r.status_pagamento,r.esporte,r.grupo_id,COALESCE(bc.nome,c.nome) as cliente_nome,
             COALESCE((SELECT SUM(valor) FROM Pagamentos WHERE reserva_id = r.id), 0) as valor_pago
      FROM Reservas r 
      LEFT JOIN Clientes c ON r.cliente_id = c.id AND c.tenant_id=r.tenant_id
      LEFT JOIN BookingContacts bc ON bc.grupo_id=r.grupo_id AND bc.tenant_id=r.tenant_id
      WHERE r.data_reserva >= ? AND r.data_reserva <= ? AND r.status != 'Cancelada' AND r.tenant_id = ?
    `, [inicio, fim, tenant_id]);

    // Pegar bloqueios do intervalo
    const bloqueios = await db.allAsync(`
      SELECT b.id,b.quadra_id,b.data_bloqueio,b.hora_inicio,b.hora_fim,b.motivo FROM Bloqueios b
      JOIN Quadras q ON b.quadra_id = q.id
      WHERE b.data_bloqueio >= ? AND b.data_bloqueio <= ? AND q.tenant_id = ?
    `, [inicio, fim, tenant_id]);

    const formattedQuadras = quadras.map(q => {
      let mods = q.modalidades;
      try { if (typeof mods === 'string') mods = JSON.parse(mods); } catch {}
      if (!Array.isArray(mods)) mods = [];
      return { 
        ...q, 
        preco_base: (q.preco_base || 0) / 100, 
        modalidades: mods.map(m => ({ ...m, preco: (m.preco || 0) / 100 })) 
      };
    });

    const formattedReservas = reservas.map(r => ({
      ...r,
      valor_total: (r.valor_total || 0) / 100,
      valor_pago: (r.valor_pago || 0) / 100
    }));

    res.json({ quadras: formattedQuadras, reservas: formattedReservas, bloqueios });
  } catch (error) {
    logger.error('Erro ao listar grade:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

const criarReserva=async(req,res)=>{
 try {
  const inserted=await require('../services/bookingService').createBookings({tenantId:req.user.tenant_id,items:req.body.itens || [req.body],actor:req.user,source:'staff'});
  const balance=await db.getAsync('SELECT status_pagamento FROM Reservas WHERE id=?',[inserted.reservasCriadasIds[0]]);
  const result={reserva_id:inserted.reservasCriadasIds[0],reservas_ids:inserted.reservasCriadasIds,valor_total:inserted.valorTotalGeral / 100,status_pagamento:balance.status_pagamento};
  logAuditEvent(req.user.id,'Criacao de reserva','Reserva: '+result.reserva_id,req.ip);
  res.status(201).json({message:'Reserva criada.',...result});
 }catch(e){res.status(e.status||500).json({error: require('../utils/security').publicError(e, 'Erro ao criar reserva.')});}
};

const minhasReservas = async (req, res) => {
  try {
    const member = await require('../services/clientAccessService').membership(req.user, req.user.tenant_id, false);
    const cliente_id = member?.id;
    if (!cliente_id) {
      return res.status(403).json({ error: 'Usuário não tem perfil de cliente vinculado.' });
    }

    const tenant_id = req.user.tenant_id;
    const reservas = await db.allAsync(`
      SELECT r.id, r.data_reserva, r.hora_inicio, r.hora_fim, r.status, r.valor_total, r.status_pagamento, q.nome as quadra_nome 
      FROM Reservas r
      JOIN Quadras q ON r.quadra_id = q.id
      WHERE r.cliente_id = ? AND r.tenant_id = ?
      ORDER BY r.data_reserva DESC, r.hora_inicio DESC
    `, [cliente_id, tenant_id]);

    res.json(reservas.map(r => ({ ...r, valor_total: (r.valor_total || 0) / 100 })));
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao buscar reservas do cliente.' });
  }
};

const cancelarReserva = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo, observacoes } = req.body; // 'motivo' now actually expects motivo_id from frontend
    const tenant_id = req.user.tenant_id;

    const reserva = await db.getAsync('SELECT * FROM Reservas WHERE id = ? AND tenant_id = ?', [id, tenant_id]);
    if (!reserva) return res.status(404).json({ error: 'Reserva não encontrada.' });

    // Busca o texto do motivo para o log
    // Busca o texto do motivo para o log
    let motivoTexto = 'Motivo desconhecido';
    let motivoId = null;
    if (motivo) {
      if (motivo == -1) { motivoTexto = 'Desistência do Cliente'; motivoId = -1; }
      else if (motivo == -2) { motivoTexto = 'Condições Climáticas'; motivoId = -2; }
      else if (motivo == -3) { motivoTexto = 'Manutenção da Quadra'; motivoId = -3; }
      else {
        const m = await db.getAsync('SELECT motivo FROM MotivosCancelamento WHERE id = ? AND tenant_id = ?', [motivo,tenant_id]);
        if (m) { motivoTexto = m.motivo; motivoId = Number(motivo); }
      }
    }

    let grupoClause = 'WHERE id = ? AND tenant_id = ?';
    let grupoParams = [id, tenant_id];

    if (reserva.grupo_id && String(reserva.grupo_id).trim() !== '') {
      grupoClause = 'WHERE grupo_id = ? AND tenant_id = ?';
      grupoParams = [reserva.grupo_id, tenant_id];
    }

    const cancellation=await require('../services/bookingCancellationService').requestCancellation([id],{tenantId:tenant_id,reason:motivoTexto,reasonId:motivoId,observations:observacoes || null});
    logAuditEvent(req.user.id, 'Cancelamento de reserva', `Reserva ID: ${id}, Motivo: ${motivoTexto}`, req.ip);

    // Dispara e-mail de cancelamento em background (defensivo)
    (async () => {
      try {
        const client = await db.getAsync('SELECT nome, email FROM Clientes WHERE id = ?', [reserva.cliente_id]);
        const arena = await db.getAsync('SELECT nome, notif_cancelamento_email FROM Arenas WHERE id = ?', [tenant_id]);
        const quadraObj = await db.getAsync('SELECT nome FROM Quadras WHERE id = ?', [reserva.quadra_id]);
        
        if (client && client.email && arena?.notif_cancelamento_email !== 0) {
          const { sendEmail } = require('../services/emailService');
          const subject = `${cancellation.pending ? 'Cancelamento pendente' : 'Reserva Cancelada'} - ${arena ? arena.nome : 'Arenix'}`;
          const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6;">
              <h2 style="color: #C53030;">${cancellation.pending ? 'Cancelamento pendente' : 'Reserva Cancelada'}</h2>
              <p>Olá, ${client.nome}. ${cancellation.pending ? 'Recebemos a solicitação de cancelamento. A conclusão depende da devolução dos valores ou da conciliação das cobranças pendentes.' : 'Informamos que a sua reserva foi cancelada no sistema.'}</p>
              <div style="background-color: #FFF5F5; border: 1px solid #FEB2B2; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <strong>Detalhes do agendamento cancelado:</strong><br />
                📅 <strong>Data:</strong> ${reserva.data_reserva.split('-').reverse().join('/')}<br />
                🕒 <strong>Horário:</strong> ${reserva.hora_inicio} às ${reserva.hora_fim}<br />
                🎾 <strong>Quadra:</strong> ${quadraObj ? quadraObj.nome : 'Quadra Principal'}<br />
                ❌ <strong>Motivo do Cancelamento:</strong> ${motivoTexto}
              </div>
              <p>Se você tiver dúvidas ou precisar reagendar, entre em contato diretamente com a equipe da arena.</p>
              <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
              <p style="font-size: 0.8em; color: #A0AEC0;">Esta é uma mensagem automática enviada por Arenix CourtManager em nome de ${arena ? arena.nome : 'sua Arena'}.</p>
            </div>
          `;
          await sendEmail(client.email, subject, html);
        }
      } catch (e) {
        logger.error('[SMTP] Erro ao disparar e-mail de cancelamento:', e.message);
      }
    })();

    res.status(cancellation.pending?202:200).json({message:cancellation.pending?'Cancelamento pendente. Use Estornar para devolver valores recebidos; cobrancas em aberto dependem de conciliacao.':'Reserva cancelada.',pending:cancellation.pending});
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: 'Erro ao cancelar reserva.' });
  }
};

const { createBlock, releaseBlock, validTime } = require('../services/blockService');

function blockFailure(res, error) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  logger.error('Erro ao alterar bloqueio:', error);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
}

const criarBloqueio = async (req, res) => {
  try {
    const id = await createBlock(req.user, req.body);
    logAuditEvent(req.user.id, 'Criação de bloqueio', 'Bloqueio ID: ' + id, req.ip);
    res.status(201).json({ message: 'Quadra bloqueada com sucesso.', bloqueio_id: id, id });
  } catch (error) { blockFailure(res, error); }
};

const removerBloqueio = async (req, res) => {
  try {
    await releaseBlock(req.user, req.params.id, null, null, true);
    logAuditEvent(req.user.id, 'Remoção de bloqueio', 'Bloqueio ID: ' + req.params.id, req.ip);
    res.json({ message: 'Bloqueio removido com sucesso.' });
  } catch (error) { blockFailure(res, error); }
};

const desbloquearParcialmente = async (req, res) => {
  try {
    const { hora_inicio_desbloqueio: start, hora_fim_desbloqueio: end } = req.body;
    await releaseBlock(req.user, req.params.id, start, end);
    logAuditEvent(req.user.id, 'Desbloqueio Parcial', 'Bloqueio ID: ' + req.params.id + ', Período: ' + start + ' - ' + end, req.ip);
    res.json({ message: 'Horário desbloqueado com sucesso.' });
  } catch (error) { blockFailure(res, error); }
};

const desbloquearHoraDelete = async (req, res) => {
  const { hora } = req.query;
  if (!validTime(hora)) return res.status(400).json({ error: 'Informe um horário válido.' });
  const [h, m] = hora.split(':').map(Number);
  const minutes = Math.min(h * 60 + m + 60, 1440);
  const end = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
  req.body = { hora_inicio_desbloqueio: hora, hora_fim_desbloqueio: end };
  return desbloquearParcialmente(req, res);
};

module.exports = { 
  listarGrade, 
  criarReserva, 
  minhasReservas, 
  cancelarReserva, 
  criarBloqueio, 
  removerBloqueio, 
  desbloquearParcialmente,
  desbloquearHoraDelete
};
