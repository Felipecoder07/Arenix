const db = require('../config/database');
const logAuditEvent = require('../utils/auditLogger');
const { criarCobrancaPix } = require('../services/gatewayService');
const { getTodayString, getLocalTimeString } = require('../utils/dateUtils');

/**
 * Controller Público — Vitrine do Tenant (Sem Necessidade de Autenticação JWT)
 */

// Helper para normalizar slug
function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper para cancelar automaticamente reservas pendentes vencidas (mais de 15 min ou data no passado)
async function expirarReservasAntigas() {
  try {
    await db.runAsync(
      `UPDATE Reservas 
       SET status = 'Cancelada', status_pagamento = 'Expirado' 
       WHERE (status = 'Pendente' OR status_pagamento = 'Pendente') 
         AND status_pagamento NOT IN ('Pago', 'Estornado') 
         AND (
           datetime(criado_em, '+15 minutes') < datetime('now', 'localtime') 
           OR data_reserva < date('now', 'localtime')
         )`
    );
  } catch (e) {
    console.warn('[Public Controller Warning] Erro ao expirar reservas antigas:', e.message);
  }
}

// 1. Resolver Dados da Arena pelo Slug
const getTenantBySlug = async (req, res) => {
  const { slug } = req.params;

  try {
    const arena = await db.getAsync(
      `SELECT id, nome, endereco, telefone, email, fuso_horario, horario_abertura, horario_fechamento, status, slug, criado_em
       FROM Arenas 
       WHERE slug = ? AND status != -1`,
      [slug]
    );

    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada. Verifique o link e tente novamente.' });
    }

    if (arena.status === 0) {
      return res.status(403).json({
        blocked: true,
        error: 'Esta arena está com os agendamentos temporariamente suspensos. Entre em contato com o local.'
      });
    }

    // Calcula o horário consolidado de funcionamento da arena com base no menor horário de abertura e maior de fechamento das quadras ativas
    const quadrasHours = await db.getAsync(
      `SELECT MIN(hora_abertura) as min_abertura, MAX(hora_fechamento) as max_fechamento 
       FROM Quadras 
       WHERE tenant_id = ? AND status = 'Ativa'`,
      [arena.id]
    );

    const horaAberturaFinal = (quadrasHours && quadrasHours.min_abertura)
      ? quadrasHours.min_abertura
      : (arena.horario_abertura || '06:00');

    const horaFechamentoFinal = (quadrasHours && quadrasHours.max_fechamento)
      ? quadrasHours.max_fechamento
      : (arena.horario_fechamento || '23:00');

    res.json({
      arena: {
        ...arena,
        horario_abertura: horaAberturaFinal,
        horario_fechamento: horaFechamentoFinal
      }
    });
  } catch (err) {
    console.error('[Public Controller Error] getTenantBySlug:', err);
    res.status(500).json({ error: 'Erro ao carregar dados da arena.' });
  }
};

// 2. Buscar Quadras Ativas pelo Slug da Arena
const getQuadrasBySlug = async (req, res) => {
  const { slug } = req.params;

  try {
    const arena = await db.getAsync('SELECT id FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    const quadras = await db.allAsync(
      `SELECT id, nome, tipo, preco_base, hora_abertura, hora_fechamento, status
       FROM Quadras 
       WHERE tenant_id = ? AND status = 'Ativa'`,
      [arena.id]
    );

    res.json({ quadras });
  } catch (err) {
    console.error('[Public Controller Error] getQuadrasBySlug:', err);
    res.status(500).json({ error: 'Erro ao buscar quadras da arena.' });
  }
};

// 3. Matriz de Disponibilidade de Horários (100% Privado sem expor nomes de terceiros - RN-02)
const getDisponibilidadeBySlug = async (req, res) => {
  const { slug } = req.params;
  const dataFiltro = req.query.data || new Date().toISOString().split('T')[0];
  const quadraIdFiltro = req.query.quadra_id ? parseInt(req.query.quadra_id, 10) : null;

  try {
    const arena = await db.getAsync('SELECT id, horario_abertura, horario_fechamento FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    // Busca quadras ativas da arena
    let queryQuadras = 'SELECT id, nome, preco_base, hora_abertura, hora_fechamento FROM Quadras WHERE tenant_id = ? AND status = \'Ativa\'';
    const paramsQuadras = [arena.id];
    if (quadraIdFiltro) {
      queryQuadras += ' AND id = ?';
      paramsQuadras.push(quadraIdFiltro);
    }
    const quadras = await db.allAsync(queryQuadras, paramsQuadras);

    // 1. Cancela automaticamente reservas pendentes com mais de 15 minutos sem pagamento ou no passado
    await expirarReservasAntigas();

    // Busca reservas ocupadas no dia (NUNCA expõe cliente_id ou nome do atleta - RN-02)
    // Apenas reservas efetivamente CONFIRMADAS/PAGAS ocupam a grade pública
    const reservasOcupadas = await db.allAsync(
      `SELECT quadra_id, hora_inicio, hora_fim
       FROM Reservas
       WHERE tenant_id = ? AND data_reserva = ? AND status IN ('Confirmada', 'Pago') AND status_pagamento != 'Desistência'`,
      [arena.id, dataFiltro]
    );

    // Busca bloqueios de quadra no dia
    const bloqueios = await db.allAsync(
      `SELECT quadra_id, hora_inicio, hora_fim, motivo
       FROM Bloqueios
       WHERE quadra_id IN (SELECT id FROM Quadras WHERE tenant_id = ?) AND data_bloqueio = ?`,
      [arena.id, dataFiltro]
    );

    const todayStr = getTodayString();
    const currentTimeStr = getLocalTimeString();
    const isHoje = dataFiltro === todayStr;

    const resultadoPorQuadra = quadras.map(q => {
      // Define os horários reais da quadra/arena (Ex: das 06:00 às 23:00)
      const hAbertura = q.hora_abertura || arena.horario_abertura || '06:00';
      const hFechamento = q.hora_fechamento || arena.horario_fechamento || '23:00';

      const startHour = parseInt(hAbertura.split(':')[0], 10);
      const endHour = parseInt(hFechamento.split(':')[0], 10);

      const slotsHorarios = [];
      for (let h = startHour; h < endHour; h++) {
        slotsHorarios.push(`${String(h).padStart(2, '0')}:00`);
      }

      const slots = slotsHorarios.map(hInicio => {
        const [h, m] = hInicio.split(':').map(Number);
        const hFim = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        // Checa se o horário no dia de hoje já passou
        const jaPassou = isHoje && hInicio <= currentTimeStr;

        // Checa se coincide com reserva existente
        const temReserva = reservasOcupadas.some(r => String(r.quadra_id) === String(q.id) && (
          (r.hora_inicio <= hInicio && r.hora_fim > hInicio) ||
          (r.hora_inicio < hFim && r.hora_fim >= hFim)
        ));

        // Checa se coincide com bloqueio
        const temBloqueio = bloqueios.some(b => String(b.quadra_id) === String(q.id) && (
          (b.hora_inicio <= hInicio && b.hora_fim > hInicio) ||
          (b.hora_inicio < hFim && b.hora_fim >= hFim)
        ));

        let statusSlot = 'disponivel';
        if (jaPassou) {
          statusSlot = 'passado';
        } else if (temReserva || temBloqueio) {
          statusSlot = 'ocupado';
        }

        return {
          hora_inicio: hInicio,
          hora_fim: hFim,
          status: statusSlot,
          preco: q.preco_base
        };
      });

      return {
        quadra_id: q.id,
        quadra_nome: q.nome,
        preco_base: q.preco_base,
        hora_abertura: hAbertura,
        hora_fechamento: hFechamento,
        slots
      };
    });

    res.json({
      arena_id: arena.id,
      data: dataFiltro,
      quadras: resultadoPorQuadra
    });
  } catch (err) {
    console.error('[Public Controller Error] getDisponibilidadeBySlug:', err);
    res.status(500).json({ error: 'Erro ao verificar disponibilidade.' });
  }
};

/**
 * Gerador de Payload Pix EMV QRCPS (Padrão Oficial Banco Central do Brasil)
 * Permite que o pagamento vá DIRETO para a conta bancária do Dono da Arena
 */
function gerarPixEMV({ chave, nome, cidade = 'SAO PAULO', valor, txid = '***' }) {
  const cleanChave = (chave || '').trim();
  if (!cleanChave) return '';

  const cleanNome = (nome || 'ARENA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .substring(0, 25)
    .toUpperCase();

  const cleanCidade = (cidade || 'SAO PAULO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .substring(0, 15)
    .toUpperCase();

  const valStr = parseFloat(valor).toFixed(2);
  const cleanTxid = (txid || '***').replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***';

  const formatField = (id, value) => {
    const len = String(value.length).padStart(2, '0');
    return `${id}${len}${value}`;
  };

  const gui = formatField('00', 'BR.GOV.BCB.PIX');
  const key = formatField('01', cleanChave);
  const merchantAccount = formatField('26', `${gui}${key}`);

  const payloadParts = [
    formatField('00', '01'),
    merchantAccount,
    formatField('52', '0000'),
    formatField('53', '986'),
    formatField('54', valStr),
    formatField('58', 'BR'),
    formatField('59', cleanNome),
    formatField('60', cleanCidade),
    formatField('62', formatField('05', cleanTxid)),
  ];

  const payloadString = payloadParts.join('') + '6304';

  let crc = 0xFFFF;
  for (let i = 0; i < payloadString.length; i++) {
    crc ^= (payloadString.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xFFFF;
    }
  }

  const crcHex = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  return `${payloadString}${crcHex}`;
}

// 4. Checkout Rápido sem Senha — Agendamento (Único ou Múltiplos Horários) + Gerar Pix
const agendarReservaPublica = async (req, res) => {
  const { slug } = req.params;
  const { nome, telefone, cpf, email, quadra_id, data_reserva, hora_inicio, hora_fim, itens } = req.body;

  // Normaliza lista de itens a reservar (suporta 1 único item ou múltiplos itens no carrinho)
  let listaItens = [];
  if (Array.isArray(itens) && itens.length > 0) {
    listaItens = itens;
  } else if (quadra_id && data_reserva && hora_inicio && hora_fim) {
    listaItens = [{ quadra_id, data_reserva, hora_inicio, hora_fim }];
  } else {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios e selecione ao menos um horário.' });
  }

  if (!nome || !telefone) {
    return res.status(400).json({ error: 'Nome e WhatsApp são obrigatórios.' });
  }

  try {
    const arena = await db.getAsync(
      'SELECT id, nome, email, telefone, chave_pix, titular_pix, cidade_pix, gateway_access_token FROM Arenas WHERE slug = ? AND status = 1',
      [slug]
    );
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada ou indisponível.' });
    }

    const tenantId = arena.id;

    const hasGateway = arena.gateway_access_token && arena.gateway_access_token.trim() !== '';
    const hasChavePix = arena.chave_pix && arena.chave_pix.trim() !== '';

    if (!hasGateway && !hasChavePix) {
      return res.status(400).json({
        payment_not_configured: true,
        error: 'Esta arena ainda não configurou o recebimento de pagamentos online via Pix. Por favor, entre em contato direto com a recepção do local para agendar.'
      });
    }

    const todayStr = getTodayString();
    const currentTimeStr = getLocalTimeString();

    // Validação de datas passadas ou horários retroativos do dia atual
    for (const item of listaItens) {
      if (item.data_reserva < todayStr) {
        return res.status(400).json({ error: 'Não é permitido criar agendamentos em datas passadas.' });
      }
      if (item.data_reserva === todayStr && item.hora_inicio <= currentTimeStr) {
        return res.status(400).json({
          error: `Ops! O horário das ${item.hora_inicio} do dia de hoje já encerrou. Escolha um horário futuro.`
        });
      }
    }

    // 4a. Cancela automaticamente reservas pendentes expiradas antes da checagem
    await db.runAsync(
      `UPDATE Reservas 
       SET status = 'Cancelada', status_pagamento = 'Expirado' 
       WHERE status = 'Pendente' AND status_pagamento = 'Pendente' 
         AND datetime(criado_em, '+15 minutes') < datetime('now')`
    );

    // Validação de Conflitos para TODOS os horários solicitados
    for (const item of listaItens) {
      const conflito = await db.getAsync(
        `SELECT id FROM Reservas 
         WHERE quadra_id = ? AND data_reserva = ? AND status != 'Cancelada'
           AND (hora_inicio < ? AND hora_fim > ?)`,
        [item.quadra_id, item.data_reserva, item.hora_fim, item.hora_inicio]
      );

      if (conflito) {
        return res.status(400).json({
          error: `Ops! O horário das ${item.hora_inicio} do dia ${item.data_reserva} já foi reservado por outro atleta.`
        });
      }
    }

    // 4b. Buscar ou Cadastrar/Atualizar Cliente no Tenant (Reconciliação por E-mail, Telefone ou CPF)
    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : null;
    const cleanPhone = telefone && telefone.trim() ? telefone.trim() : null;
    const cleanCpf = cpf && cpf.trim() ? cpf.trim() : null;

    let cliente = null;

    if (cleanEmail) {
      cliente = await db.getAsync('SELECT id FROM Clientes WHERE LOWER(email) = ?', [cleanEmail]);
    }
    if (!cliente && cleanPhone && cleanPhone !== '(00) 00000-0000') {
      cliente = await db.getAsync('SELECT id FROM Clientes WHERE tenant_id = ? AND telefone = ?', [tenantId, cleanPhone]);
    }
    if (!cliente && cleanCpf) {
      cliente = await db.getAsync('SELECT id FROM Clientes WHERE cpf = ?', [cleanCpf]);
    }

    if (cliente) {
      await db.runAsync(
        `UPDATE Clientes 
         SET nome = ?, telefone = COALESCE(?, telefone), email = COALESCE(?, email), cpf = COALESCE(?, cpf) 
         WHERE id = ?`,
        [nome.trim(), cleanPhone, cleanEmail, cleanCpf, cliente.id]
      );
    } else {
      try {
        const rCliente = await db.runAsync(
          'INSERT INTO Clientes (tenant_id, nome, email, telefone, cpf) VALUES (?, ?, ?, ?, ?)',
          [tenantId, nome.trim(), cleanEmail, cleanPhone, cleanCpf]
        );
        cliente = { id: rCliente.lastID };
      } catch (insertErr) {
        if (cleanEmail) {
          cliente = await db.getAsync('SELECT id FROM Clientes WHERE LOWER(email) = ?', [cleanEmail]);
        }
        if (!cliente && cleanCpf) {
          cliente = await db.getAsync('SELECT id FROM Clientes WHERE cpf = ?', [cleanCpf]);
        }
        if (cliente) {
          await db.runAsync(
            `UPDATE Clientes SET nome = ?, telefone = COALESCE(?, telefone) WHERE id = ?`,
            [nome.trim(), cleanPhone, cliente.id]
          );
        } else {
          throw insertErr;
        }
      }
    }

    // 4c-1. Trava Idempotente: Se a exata mesma reserva foi criada para este cliente nos últimos 15 segundos, reutiliza-a ao invés de duplicar
    const itemPrimeiro = listaItens[0];
    const reservaRecente = await db.getAsync(
      `SELECT id, valor_total FROM Reservas
       WHERE cliente_id = ? AND quadra_id = ? AND data_reserva = ? AND hora_inicio = ? AND status != 'Cancelada'
         AND datetime(criado_em, '+15 seconds') >= datetime('now')`,
      [cliente.id, itemPrimeiro.quadra_id, itemPrimeiro.data_reserva, itemPrimeiro.hora_inicio]
    );

    if (reservaRecente) {
      const primeiraReservaId = reservaRecente.id;
      const chavePixArena = arena.chave_pix || arena.email || arena.telefone || 'financeiro@felparena.com.br';
      const titularArena = arena.titular_pix || arena.nome || 'Felp Arena';
      const cidadeArena = arena.cidade_pix || 'SAO PAULO';
      const copiaCola = gerarPixEMV({
        chave: chavePixArena,
        nome: titularArena,
        cidade: cidadeArena,
        valor: reservaRecente.valor_total,
        txid: `RESERVA${primeiraReservaId}`
      });

      return res.json({
        reserva_id: primeiraReservaId,
        reservas_ids: [primeiraReservaId],
        valor_total: reservaRecente.valor_total,
        copia_cola: copiaCola,
        qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(copiaCola)}`,
        gateway_ref: `PIX_MULTI_${primeiraReservaId}`
      });
    }

    // 4c-2. Inserir Reservas e calcular valor total somado com grupo_id único
    let valorTotalGeral = 0;
    const reservasCriadasIds = [];
    const grupoId = `GRUPO_${cliente.id}_${Date.now()}`;

    for (const item of listaItens) {
      let precoItem = item.preco;
      if (!precoItem) {
        const quadra = await db.getAsync('SELECT preco_base FROM Quadras WHERE id = ? AND tenant_id = ?', [item.quadra_id, tenantId]);
        precoItem = quadra ? quadra.preco_base : 100.0;
      }
      valorTotalGeral += precoItem;

      const rReserva = await db.runAsync(
        `INSERT INTO Reservas (tenant_id, cliente_id, quadra_id, data_reserva, hora_inicio, hora_fim, valor_total, status, status_pagamento, grupo_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendente', 'Pendente', ?)`,
        [tenantId, cliente.id, item.quadra_id, item.data_reserva, item.hora_inicio, item.hora_fim, precoItem, grupoId]
      );
      reservasCriadasIds.push(rReserva.lastID);
    }

    const primeiraReservaId = reservasCriadasIds[0];

    // 4d. Tentar gerar Cobrança Pix via Gateway para o valor total
    let pixData = null;
    try {
      if (arena.gateway_access_token) {
        pixData = await criarCobrancaPix(primeiraReservaId, valorTotalGeral, tenantId);
      }
    } catch (eGateway) {
      console.warn('[Public Checkout Warning] Falha ao gerar Pix no gateway:', eGateway.message);
    }

    // Gera o código Copia e Cola EMV padrão Banco Central utilizando a Chave Pix Real do Dono da Arena
    const chavePixArena = arena.chave_pix || arena.email || arena.telefone || 'financeiro@felparena.com.br';
    const titularArena = arena.titular_pix || arena.nome || 'Felp Arena';
    const cidadeArena = arena.cidade_pix || 'SAO PAULO';

    const gatewayRef = pixData?.gateway_ref || `PIX_MULTI_${primeiraReservaId}_${Date.now()}`;
    const copiaCola = pixData?.copia_cola || gerarPixEMV({
      chave: chavePixArena,
      nome: titularArena,
      cidade: cidadeArena,
      valor: valorTotalGeral,
      txid: `RES${primeiraReservaId}`
    });

    logAuditEvent(
      0,
      'Reserva Publica Multi-Slot',
      `Atleta '${nome}' agendou ${reservasCriadasIds.length} reserva(s) [IDs: ${reservasCriadasIds.join(', ')}] totalizando R$ ${valorTotalGeral.toFixed(2)}.`,
      req.ip
    );

    res.status(201).json({
      message: 'Reserva(s) realizada(s) com sucesso! Realize o pagamento via Pix para garantir a vaga.',
      reserva_id: primeiraReservaId,
      reservas_ids: reservasCriadasIds,
      gateway_ref: gatewayRef,
      copia_cola: copiaCola,
      qr_code: pixData?.qr_code || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(copiaCola)}`,
      valor_total: valorTotalGeral,
      expira_em_minutos: 15
    });
  } catch (err) {
    console.error('[Public Controller Error] agendarReservaPublica:', err);
    res.status(500).json({ error: 'Erro ao concluir o agendamento.' });
  }
};

// 5. Cadastro Real do Atleta via Portal Público por Tenant
const cadastrarAtletaPublico = async (req, res) => {
  const { slug } = req.params;
  const { nome, email, senha, telefone } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios para realizar o cadastro.' });
  }

  if (senha.length < 6) {
    return res.status(400).json({ error: 'A senha deve possuir no mínimo 6 caracteres.' });
  }

  try {
    const arena = await db.getAsync('SELECT id, nome FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada ou indisponível.' });
    }

    const tenantId = arena.id;
    const bcrypt = require('bcrypt');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

    // Checa se o e-mail já existe na base global de usuários
    const existente = await db.getAsync(
      'SELECT id, nome, email, senha_hash, ativo FROM Usuarios WHERE LOWER(email) = ?',
      [email.trim().toLowerCase()]
    );

    if (existente) {
      if (existente.ativo === 0) {
        return res.status(403).json({ error: 'Sua conta de usuário está desativada. Entre em contato com a arena.' });
      }

      const senhaValida = await bcrypt.compare(senha, existente.senha_hash);
      if (!senhaValida) {
        return res.status(400).json({ error: 'Este e-mail já está cadastrado em nossa plataforma. Verifique a senha ou faça login.' });
      }

      // Garante vínculo na tabela Clientes para esta arena específica
      let clienteExistente = await db.getAsync(
        'SELECT id, telefone FROM Clientes WHERE tenant_id = ? AND LOWER(email) = ?',
        [tenantId, email.trim().toLowerCase()]
      );

      if (!clienteExistente) {
        try {
          await db.runAsync(
            'INSERT INTO Clientes (tenant_id, nome, email, telefone) VALUES (?, ?, ?, ?)',
            [tenantId, existente.nome, email.trim().toLowerCase(), telefone ? telefone.trim() : null]
          );
        } catch (eCl) {
          /* ignora colisão de constraint se o cliente já existia */
        }
        clienteExistente = await db.getAsync(
          'SELECT id, telefone FROM Clientes WHERE tenant_id = ? AND LOWER(email) = ?',
          [tenantId, email.trim().toLowerCase()]
        );
      }

      const token = jwt.sign(
        { id: existente.id, perfil: 'cliente', email: existente.email },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      logAuditEvent(
        existente.id,
        'Acesso Atleta Publico Multiarena',
        `Atleta '${existente.nome}' conectou-se à arena '${arena.nome}' usando sua conta universal.`,
        req.ip
      );

      return res.status(200).json({
        message: 'Bem-vindo de volta! Sua conta universal foi conectada a esta arena com sucesso.',
        token,
        usuario: {
          id: existente.id,
          nome: existente.nome,
          email: existente.email,
          telefone: clienteExistente ? (clienteExistente.telefone || (telefone ? telefone.trim() : '')) : ''
        }
      });
    }

    // Checa se o telefone já está cadastrado para outro cliente nesta arena
    if (telefone && telefone.trim()) {
      const telefoneExiste = await db.getAsync(
        'SELECT id FROM Clientes WHERE tenant_id = ? AND telefone = ? AND (email IS NULL OR LOWER(email) != ?)',
        [tenantId, telefone.trim(), email.trim().toLowerCase()]
      );
      if (telefoneExiste) {
        return res.status(400).json({ error: 'Este número de WhatsApp já está vinculado a outro cadastro nesta arena.' });
      }
    }

    // Criptografa a senha com bcrypt (10 rounds)
    const senhaHash = await bcrypt.hash(senha, 10);

    // Insere o Usuário com perfil 'Cliente' (Conta Universal)
    const rUser = await db.runAsync(
      `INSERT INTO Usuarios (nome, email, senha_hash, perfil, ativo)
       VALUES (?, ?, ?, 'Cliente', 1)`,
      [nome.trim(), email.trim().toLowerCase(), senhaHash]
    );

    const userId = rUser.lastID;

    // Garante criação/vínculo no cadastro de Clientes da arena atual
    let cliente = await db.getAsync(
      'SELECT id FROM Clientes WHERE tenant_id = ? AND (email = ? OR (telefone IS NOT NULL AND telefone = ?))',
      [tenantId, email.trim().toLowerCase(), telefone ? telefone.trim() : '']
    );

    if (!cliente) {
      try {
        await db.runAsync(
          'INSERT INTO Clientes (tenant_id, nome, email, telefone) VALUES (?, ?, ?, ?)',
          [tenantId, nome.trim(), email.trim().toLowerCase(), telefone ? telefone.trim() : null]
        );
      } catch (eCl) {
        /* ignora colisão de constraint se já existir */
      }
    }

    // Gera o Token JWT para o atleta (Conta Universal)
    const token = jwt.sign(
      { id: userId, perfil: 'cliente', email: email.trim().toLowerCase() },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    logAuditEvent(
      userId,
      'Cadastro Atleta Publico',
      `Atleta '${nome}' cadastrou-se com sucesso no portal da arena '${arena.nome}'.`,
      req.ip
    );

    res.status(201).json({
      message: 'Cadastro realizado com sucesso!',
      token,
      usuario: {
        id: userId,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        telefone: telefone ? telefone.trim() : ''
      }
    });
  } catch (err) {
    console.error('[Public Controller Error] cadastrarAtletaPublico:', err);
    res.status(500).json({ error: 'Erro ao realizar o cadastro do atleta.' });
  }
};

// 6. Login Real do Atleta via Portal Público por Tenant
const loginAtletaPublico = async (req, res) => {
  const { slug } = req.params;
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const arena = await db.getAsync('SELECT id, nome FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada ou indisponível.' });
    }

    const tenantId = arena.id;
    const bcrypt = require('bcrypt');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

    const usuario = await db.getAsync(
      'SELECT id, tenant_id, nome, email, senha_hash, perfil, ativo FROM Usuarios WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (!usuario) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    if (usuario.ativo === 0) {
      return res.status(403).json({ error: 'Sua conta de usuário está desativada. Entre em contato com a arena.' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    // Busca o telefone e avatar do cliente correspondente se existir
    const cliente = await db.getAsync('SELECT telefone, avatar_url FROM Clientes WHERE tenant_id = ? AND LOWER(email) = LOWER(?)', [tenantId, email.trim()]);

    const token = jwt.sign(
      { id: usuario.id, perfil: usuario.perfil, email: usuario.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    logAuditEvent(
      usuario.id,
      'Login Atleta Publico',
      `Atleta '${usuario.nome}' realizou login com sucesso no portal da arena '${arena.nome}'.`,
      req.ip
    );

    res.json({
      message: 'Login realizado com sucesso!',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        telefone: cliente ? (cliente.telefone || '') : '',
        avatar_url: cliente ? (cliente.avatar_url || '') : ''
      }
    });
  } catch (err) {
    console.error('[Public Controller Error] loginAtletaPublico:', err);
    res.status(500).json({ error: 'Erro ao realizar login.' });
  }
};

// 7. Autenticação e Cadastro com Google OAuth 2.0 pelo Tenant
const googleAuthAtletaPublico = async (req, res) => {
  const { slug } = req.params;
  const { credential, email: bodyEmail, nome: bodyNome, telefone: bodyTelefone } = req.body;

  try {
    const arena = await db.getAsync('SELECT id, nome FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada ou indisponível.' });
    }

    const tenantId = arena.id;
    const jwt = require('jsonwebtoken');
    const bcrypt = require('bcrypt');
    const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

    let email = bodyEmail;
    let nome = bodyNome;

    // Se vier com o token do Google (credential), decodifica o JWT do Google
    if (credential) {
      try {
        const decoded = jwt.decode(credential);
        if (decoded && decoded.email) {
          email = decoded.email;
          nome = decoded.name || decoded.given_name || email.split('@')[0];
        }
      } catch {
        /* ignora falha de decode e usa fallback */
      }
    }

    if (!email) {
      return res.status(400).json({ error: 'E-mail do Google não informado.' });
    }

    email = email.trim().toLowerCase();
    nome = (nome || email.split('@')[0]).trim();

    // Busca se o usuário já existe na base
    let usuario = await db.getAsync('SELECT id, tenant_id, nome, email, perfil, ativo FROM Usuarios WHERE email = ?', [email]);

    if (!usuario) {
      // Se não existir, realiza o cadastro automático via Google
      const senhaHashMock = await bcrypt.hash(`GOOGLE_OAUTH_${Date.now()}_${Math.random()}`, 10);
      const rUser = await db.runAsync(
        `INSERT INTO Usuarios (nome, email, senha_hash, perfil, ativo)
         VALUES (?, ?, ?, 'Cliente', 1)`,
        [nome, email, senhaHashMock]
      );
      usuario = {
        id: rUser.lastID,
        tenant_id: tenantId,
        nome,
        email,
        perfil: 'Cliente',
        ativo: 1
      };
    }

    if (usuario.ativo === 0) {
      return res.status(403).json({ error: 'Sua conta de usuário está desativada. Entre em contato com a arena.' });
    }

    // Garante presença na tabela Clientes
    let cliente = await db.getAsync('SELECT id, telefone, avatar_url FROM Clientes WHERE tenant_id = ? AND LOWER(email) = LOWER(?)', [tenantId, email]);
    if (!cliente) {
      try {
        await db.runAsync(
          'INSERT INTO Clientes (tenant_id, nome, email, telefone) VALUES (?, ?, ?, ?)',
          [tenantId, nome, email, bodyTelefone ? bodyTelefone.trim() : null]
        );
      } catch (eCl) {
        /* ignora colisão de constraint se o cliente já existia */
      }
      cliente = await db.getAsync('SELECT id, telefone, avatar_url FROM Clientes WHERE tenant_id = ? AND LOWER(email) = LOWER(?)', [tenantId, email]);
    }

    const token = jwt.sign(
      { id: usuario.id, perfil: usuario.perfil, email: usuario.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    logAuditEvent(
      usuario.id,
      'Login Google Atleta Publico',
      `Atleta '${usuario.nome}' autenticou-se via Google na arena '${arena.nome}'.`,
      req.ip
    );

    res.json({
      message: 'Autenticação via Google realizada com sucesso!',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        telefone: cliente ? (cliente.telefone || '') : '',
        avatar_url: cliente ? (cliente.avatar_url || '') : ''
      }
    });
  } catch (err) {
    console.error('[Public Controller Error] googleAuthAtletaPublico:', err);
    res.status(500).json({ error: 'Erro ao autenticar com o Google.' });
  }
};

// 8. Buscar Perfil do Atleta Logado
const getPerfilAtleta = async (req, res) => {
  const { slug } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const arena = await db.getAsync('SELECT id FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    const usuario = await db.getAsync('SELECT id, nome, email, perfil FROM Usuarios WHERE id = ?', [decoded.id]);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const cliente = await db.getAsync('SELECT id, telefone, cpf, avatar_url FROM Clientes WHERE LOWER(email) = LOWER(?) AND tenant_id = ?', [usuario.email, arena.id]);

    res.json({
      perfil: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        telefone: cliente ? (cliente.telefone || '') : '',
        cpf: cliente ? (cliente.cpf || '') : '',
        avatar_url: cliente ? (cliente.avatar_url || '') : ''
      }
    });
  } catch (err) {
    console.error('[Public Controller Error] getPerfilAtleta:', err);
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
};

// 9. Atualizar Perfil e/ou Senha do Atleta
const atualizarPerfilAtleta = async (req, res) => {
  const { slug } = req.params;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  const jwt = require('jsonwebtoken');
  const bcrypt = require('bcrypt');
  const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';

  const { nome, telefone, cpf, nova_senha, avatar_url } = req.body;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const arena = await db.getAsync('SELECT id, nome FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    const usuario = await db.getAsync('SELECT id, nome, email FROM Usuarios WHERE id = ?', [decoded.id]);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // 9a. Atualiza nome e senha na tabela Usuarios se fornecidos
    const updatesUser = [];
    const paramsUser = [];

    if (nome && nome.trim()) {
      updatesUser.push('nome = ?');
      paramsUser.push(nome.trim());
    }

    if (nova_senha && nova_senha.length >= 6) {
      const senhaHash = await bcrypt.hash(nova_senha, 10);
      updatesUser.push('senha_hash = ?');
      paramsUser.push(senhaHash);
    }

    if (updatesUser.length > 0) {
      paramsUser.push(usuario.id);
      await db.runAsync(`UPDATE Usuarios SET ${updatesUser.join(', ')} WHERE id = ?`, paramsUser);
    }

    // Checa se o telefone já está cadastrado para outro cliente nesta arena
    if (telefone && telefone.trim()) {
      const telefoneExiste = await db.getAsync(
        'SELECT id FROM Clientes WHERE tenant_id = ? AND telefone = ? AND (email IS NULL OR LOWER(email) != ?)',
        [arena.id, telefone.trim(), usuario.email.toLowerCase()]
      );
      if (telefoneExiste) {
        return res.status(400).json({ error: 'Este número de WhatsApp já está vinculado a outro cadastro nesta arena.' });
      }
    }

    // 9b. Atualiza tabela Clientes (telefone, cpf e avatar_url)
    const avatarToSave = (avatar_url && typeof avatar_url === 'string' && avatar_url.trim().length > 0) ? avatar_url.trim() : null;

    let cliente = await db.getAsync('SELECT id, avatar_url FROM Clientes WHERE LOWER(email) = LOWER(?) AND tenant_id = ?', [usuario.email, arena.id]);
    if (cliente) {
      const finalAvatar = avatarToSave || cliente.avatar_url || null;
      await db.runAsync(
        'UPDATE Clientes SET nome = ?, telefone = ?, cpf = ?, avatar_url = ? WHERE id = ?',
        [nome ? nome.trim() : usuario.nome, telefone ? telefone.trim() : null, cpf ? cpf.trim() : null, finalAvatar, cliente.id]
      );
    } else {
      await db.runAsync(
        'INSERT INTO Clientes (tenant_id, nome, email, telefone, cpf, avatar_url) VALUES (?, ?, ?, ?, ?, ?)',
        [arena.id, nome ? nome.trim() : usuario.nome, usuario.email, telefone ? telefone.trim() : null, cpf ? cpf.trim() : null, avatarToSave]
      );
    }

    logAuditEvent(
      usuario.id,
      'Atualizacao Perfil Atleta',
      `Atleta '${nome || usuario.nome}' atualizou seus dados cadastrais e/ou senha na arena '${arena.nome}'.`,
      req.ip
    );

    const clienteAtualizado = await db.getAsync('SELECT avatar_url FROM Clientes WHERE LOWER(email) = LOWER(?) AND tenant_id = ?', [usuario.email, arena.id]);

    res.json({
      message: 'Perfil atualizado com sucesso!',
      usuario: {
        id: usuario.id,
        nome: nome ? nome.trim() : usuario.nome,
        email: usuario.email,
        telefone: telefone ? telefone.trim() : '',
        cpf: cpf ? cpf.trim() : '',
        avatar_url: clienteAtualizado ? (clienteAtualizado.avatar_url || '') : ''
      }
    });

  } catch (err) {
    console.error('[Public Controller Error] atualizarPerfilAtleta:', err);
    res.status(500).json({ error: 'Erro ao atualizar perfil do atleta.' });
  }
};

// 10. Simular Confirmação de Pix Público (Para Testes e Demonstrações)
const simularPagamentoPublico = async (req, res) => {
  const { slug } = req.params;
  const { reserva_id } = req.body;

  if (!reserva_id) {
    return res.status(400).json({ error: 'reserva_id é obrigatório.' });
  }

  try {
    const arena = await db.getAsync('SELECT id, nome FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    const reserva = await db.getAsync('SELECT id, cliente_id, valor_total, grupo_id FROM Reservas WHERE id = ? AND tenant_id = ?', [reserva_id, arena.id]);
    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada nesta arena.' });
    }

    // 10a. Atualiza status da reserva principal e todas as reservas do mesmo grupo/lote para Confirmada e Pago
    if (reserva.grupo_id) {
      await db.runAsync(
        `UPDATE Reservas SET status = 'Confirmada', status_pagamento = 'Pago' 
         WHERE grupo_id = ? AND tenant_id = ?`,
        [reserva.grupo_id, arena.id]
      );
    } else {
      await db.runAsync(
        `UPDATE Reservas SET status = 'Confirmada', status_pagamento = 'Pago' 
         WHERE id = ? OR (cliente_id = ? AND tenant_id = ? AND status = 'Pendente' AND abs(strftime('%s', criado_em) - strftime('%s', (SELECT criado_em FROM Reservas WHERE id = ?))) < 60)`,
        [reserva_id, reserva.cliente_id, arena.id, reserva_id]
      );
    }

    // 10b. Insere registro financeiro na tabela Pagamentos se não existir
    const pExistente = await db.getAsync('SELECT id FROM Pagamentos WHERE reserva_id = ?', [reserva_id]);
    if (!pExistente) {
      await db.runAsync(
        "INSERT INTO Pagamentos (reserva_id, valor, metodo, registrado_por) VALUES (?, ?, 'Pix Online', NULL)",
        [reserva_id, reserva.valor_total]
      );
    }

    logAuditEvent(
      0,
      'Pagamento Pix Confirmado',
      `Pagamento Pix da reserva #${reserva_id} (R$ ${reserva.valor_total.toFixed(2)}) foi confirmado na arena '${arena.nome}'.`,
      req.ip
    );

    res.json({
      message: 'Pagamento Pix confirmado com sucesso! Sua reserva está garantida.',
      status_pagamento: 'Pago',
      status_reserva: 'Confirmada'
    });
  } catch (err) {
    console.error('[Public Controller Error] simularPagamentoPublico:', err);
    res.status(500).json({ error: 'Erro ao confirmar pagamento Pix.' });
  }
};

// 11. Consultar Status do Pagamento da Reserva para Polling do Pix
const getStatusReservaPublica = async (req, res) => {
  const { slug, reserva_id } = req.params;

  try {
    let reserva = await db.getAsync('SELECT id, tenant_id, status, status_pagamento FROM Reservas WHERE id = ?', [reserva_id]);
    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    const arena = await db.getAsync('SELECT id, gateway_access_token FROM Arenas WHERE id = ? AND status = 1', [reserva.tenant_id]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    // Se a reserva ainda estiver com pagamento Pendente, consulta a API do Mercado Pago diretamente
    if (reserva.status_pagamento === 'Pendente') {
      const transacao = await db.getAsync('SELECT gateway_ref FROM TransacoesGateway WHERE reserva_id = ? AND status = "Pendente"', [reserva_id]);
      if (transacao && transacao.gateway_ref && !transacao.gateway_ref.startsWith('sim_') && !transacao.gateway_ref.startsWith('PIX_')) {
        const token = arena.gateway_access_token || process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (token) {
          try {
            const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${transacao.gateway_ref}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (mpRes.ok) {
              const mpData = await mpRes.json();
              if (mpData.status === 'approved') {
                const { processarLiquidacao } = require('../services/gatewayService');
                const payload = {};
                if (mpData.transaction_amount) payload.valor_pago = mpData.transaction_amount;
                await processarLiquidacao(transacao.gateway_ref, payload);

                reserva = await db.getAsync('SELECT id, status, status_pagamento FROM Reservas WHERE id = ? AND tenant_id = ?', [reserva_id, arena.id]);
              }
            }
          } catch (eMp) {
            console.warn('[Public Polling Warning] Erro ao consultar API do Mercado Pago:', eMp.message);
          }
        }
      }
    }

    res.json({
      reserva_id: reserva.id,
      status: reserva.status,
      status_pagamento: reserva.status_pagamento
    });
  } catch (err) {
    console.error('[Public Controller Error] getStatusReservaPublica:', err);
    res.status(500).json({ error: 'Erro ao consultar status da reserva.' });
  }
};

// 12. Cancelar Reserva Pendente por Desistência Rápida (Ao Fechar Modal sem Pagar)
const cancelarPendentePublico = async (req, res) => {
  const { slug } = req.params;
  const { reserva_id, reservas_ids } = req.body;

  const idsParaCancelar = Array.isArray(reservas_ids) && reservas_ids.length > 0
    ? reservas_ids
    : reserva_id ? [reserva_id] : [];

  if (idsParaCancelar.length === 0) {
    return res.status(400).json({ error: 'Nenhuma reserva informada para cancelamento.' });
  }

  try {
    const arena = await db.getAsync('SELECT id FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    const placeholders = idsParaCancelar.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE Reservas 
       SET status = 'Cancelada', status_pagamento = 'Desistência' 
       WHERE tenant_id = ? AND status = 'Pendente' AND id IN (${placeholders})`,
      [arena.id, ...idsParaCancelar]
    );

    res.json({ message: 'Reserva(s) pendente(s) cancelada(s) com sucesso. Vaga liberada.' });
  } catch (err) {
    console.error('[Public Controller Error] cancelarPendentePublico:', err);
    res.status(500).json({ error: 'Erro ao cancelar reservas pendentes.' });
  }
};

// 13. Buscar Reservas do Atleta (por Token JWT ou por Telefone)
const getMinhasReservasAtleta = async (req, res) => {
  const { slug } = req.params;
  const { telefone } = req.query;
  const authHeader = req.headers.authorization;

  try {
    const arena = await db.getAsync('SELECT id FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    await expirarReservasAntigas();

    let emailsBusca = [];
    let telefonesBusca = [];

    // Se houver token JWT, extrai o e-mail e telefone do atleta logado
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'secret-jwt-courtmanager-2026';
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.email) {
          emailsBusca.push(decoded.email.trim().toLowerCase());
        }
        if (decoded && decoded.id) {
          const userObj = await db.getAsync('SELECT email, telefone FROM Usuarios WHERE id = ?', [decoded.id]);
          if (userObj) {
            if (userObj.email) emailsBusca.push(userObj.email.trim().toLowerCase());
            if (userObj.telefone) {
              telefonesBusca.push(userObj.telefone.trim());
              const digits = userObj.telefone.replace(/\D/g, '');
              if (digits) telefonesBusca.push(digits);
            }
          }
        }
      } catch (e) { }
    }

    if (telefone && telefone.trim() && telefone.trim() !== '(00) 00000-0000') {
      const phoneTrim = telefone.trim();
      telefonesBusca.push(phoneTrim);
      const digits = phoneTrim.replace(/\D/g, '');
      if (digits) telefonesBusca.push(digits);
    }

    // Remove duplicados
    emailsBusca = [...new Set(emailsBusca)];
    telefonesBusca = [...new Set(telefonesBusca)];

    if (emailsBusca.length === 0 && telefonesBusca.length === 0) {
      return res.json([]);
    }

    const emailPlaceholders = emailsBusca.length > 0 ? emailsBusca.map(() => '?').join(',') : "''";
    const phonePlaceholders = telefonesBusca.length > 0 ? telefonesBusca.map(() => '?').join(',') : "''";

    // Busca os clientes correspondentes no tenant
    const clientes = await db.allAsync(
      `SELECT id FROM Clientes 
       WHERE tenant_id = ? 
         AND (
           (${emailsBusca.length > 0 ? `LOWER(email) IN (${emailPlaceholders})` : '1=0'}) 
           OR (${telefonesBusca.length > 0 ? `telefone IN (${phonePlaceholders}) OR REPLACE(REPLACE(REPLACE(REPLACE(telefone, '(', ''), ')', ''), ' ', ''), '-', '') IN (${phonePlaceholders})` : '1=0'})
         )`,
      [arena.id, ...emailsBusca, ...telefonesBusca, ...telefonesBusca]
    );

    const clientIds = clientes.map(c => c.id);
    if (clientIds.length === 0) {
      return res.json([]);
    }

    // Busca todas as reservas desse atleta no tenant com detalhes para o comprovante
    const arenaInfo = await db.getAsync('SELECT id, nome, endereco, telefone, email, chave_pix, titular_pix FROM Arenas WHERE id = ?', [arena.id]);

    const reservas = await db.allAsync(
      `SELECT MIN(r.id) as id, r.grupo_id, r.quadra_id, q.nome as quadra_nome, r.data_reserva, 
              MIN(r.hora_inicio) as hora_inicio, MAX(r.hora_fim) as hora_fim, 
              SUM(r.valor_total) as valor_total, COUNT(r.id) as total_horarios,
              CASE WHEN MAX(CASE WHEN r.status = 'Confirmada' THEN 1 ELSE 0 END) = 1 THEN 'Confirmada' ELSE MIN(r.status) END as status,
              CASE WHEN MAX(CASE WHEN r.status_pagamento = 'Pago' THEN 1 ELSE 0 END) = 1 THEN 'Pago' ELSE MIN(r.status_pagamento) END as status_pagamento,
              MAX(r.criado_em) as criado_em, r.codigo_validacao_cancelamento,
              c.nome as cliente_nome, c.email as cliente_email, c.telefone as cliente_telefone, c.cpf as cliente_cpf,
              tg.gateway_ref, tg.metodo as metodo_gateway, tg.status as status_gateway, tg.atualizado_em as data_gateway,
              p.metodo as metodo_pagamento, p.registrado_em as data_pagamento
       FROM Reservas r
       JOIN Quadras q ON r.quadra_id = q.id
       JOIN Clientes c ON r.cliente_id = c.id
       LEFT JOIN TransacoesGateway tg ON r.id = tg.reserva_id
       LEFT JOIN Pagamentos p ON r.id = p.reserva_id
       WHERE r.tenant_id = ? AND r.cliente_id IN (${clientIds.map(() => '?').join(',')})
       GROUP BY COALESCE(NULLIF(r.grupo_id, ''), CAST(r.id AS TEXT))
       ORDER BY CASE 
                  WHEN (MIN(r.status) = 'Pendente' OR MIN(r.status_pagamento) = 'Pendente') AND MIN(r.status) != 'Cancelada' AND r.data_reserva >= date('now', 'localtime') THEN 0
                  WHEN MIN(r.status) != 'Cancelada' AND MIN(r.status_pagamento) != 'Estornado' AND r.data_reserva >= date('now', 'localtime') THEN 1
                  WHEN MIN(r.status) != 'Cancelada' AND MIN(r.status_pagamento) != 'Estornado' THEN 2
                  ELSE 3 
                END, 
                CASE WHEN r.data_reserva >= date('now', 'localtime') THEN r.data_reserva END ASC,
                CASE WHEN r.data_reserva >= date('now', 'localtime') THEN MIN(r.hora_inicio) END ASC,
                r.data_reserva DESC, 
                MIN(r.hora_inicio) DESC`,
      [arena.id, ...clientIds]
    );

    const result = reservas.map(r => ({
      ...r,
      arena: {
        nome: arenaInfo?.nome || 'Arena',
        endereco: arenaInfo?.endereco || '',
        telefone: arenaInfo?.telefone || '',
        email: arenaInfo?.email || '',
        titular_pix: arenaInfo?.titular_pix || arenaInfo?.nome || ''
      }
    }));

    res.json(result);
  } catch (err) {
    console.error('[Public Controller Error] getMinhasReservasAtleta:', err);
    res.status(500).json({ error: 'Erro ao buscar reservas do atleta.' });
  }
};


// 14. Solicitar Recuperação de Senha do Atleta
const solicitarRecuperacaoSenhaAtleta = async (req, res) => {
  const { slug } = req.params;
  const { email } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'E-mail é obrigatório.' });
  }

  try {
    const arena = await db.getAsync('SELECT id, nome FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    const emailTrim = email.trim().toLowerCase();
    const usuario = await db.getAsync('SELECT id, nome, email FROM Usuarios WHERE email = ?', [emailTrim]);

    const successMsg = 'Se o e-mail informado estiver cadastrado, o código de recuperação de 6 dígitos foi enviado.';

    if (!usuario) {
      return res.json({ message: successMsg });
    }

    const crypto = require('crypto');
    const codigo6Digits = Math.floor(100000 + Math.random() * 900000).toString();
    const token = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutos (Padrão OWASP / Mercado)

    await db.runAsync(
      'UPDATE Usuarios SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?',
      [`${codigo6Digits}:${token}`, expires, usuario.id]
    );

    logAuditEvent(usuario.id, 'Solicitação Recuperação Senha Atleta', `Arena: ${arena.nome}, E-mail: ${usuario.email}`, req.ip);

    (async () => {
      try {
        const { sendEmail } = require('../services/emailService');
        const subject = `Código de Recuperação: ${codigo6Digits} - ${arena.nome}`;
        const html = `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6;">
            <h2 style="color: #1a202c;">Olá, ${usuario.nome}! 👋</h2>
            <p>Você solicitou a redefinição de senha para o seu acesso na <strong>${arena.nome}</strong>.</p>
            <p>Seu código de verificação é:</p>
            <div style="margin: 20px 0; text-align: center;">
              <span style="background-color: #f7fafc; border: 2px dashed #cbd5e0; color: #2d3748; padding: 12px 24px; font-size: 28px; font-weight: bold; letter-spacing: 6px; border-radius: 8px; display: inline-block;">${codigo6Digits}</span>
            </div>
            <p style="font-size: 0.9em; color: #e53e3e; font-weight: bold;">Este código é válido por 15 minutos.</p>
            <p style="font-size: 0.85em; color: #718096;">Se você não fez essa solicitação, ignore este e-mail.</p>
          </div>
        `;
        await sendEmail(usuario.email, subject, html);
      } catch (e) {
        console.error('[SMTP] Erro ao enviar código de recuperação:', e.message);
      }
    })();

    res.json({ message: successMsg });
  } catch (err) {
    console.error('[Public Controller Error] solicitarRecuperacaoSenhaAtleta:', err);
    res.status(500).json({ error: 'Erro ao processar solicitação de recuperação.' });
  }
};

// 15. Redefinir Senha do Atleta
const redefinirSenhaAtleta = async (req, res) => {
  const { slug } = req.params;
  const { email, codigo, nova_senha } = req.body;

  if (!email || !codigo || !nova_senha) {
    return res.status(400).json({ error: 'E-mail, código de verificação e nova senha são obrigatórios.' });
  }

  if (nova_senha.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  try {
    const arena = await db.getAsync('SELECT id FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    const emailTrim = email.trim().toLowerCase();
    const codigoTrim = codigo.trim();

    const usuario = await db.getAsync(
      `SELECT id, nome, email, reset_password_token, reset_password_expires 
       FROM Usuarios 
       WHERE email = ? AND reset_password_expires > datetime('now')`,
      [emailTrim]
    );

    if (!usuario || !usuario.reset_password_token) {
      return res.status(400).json({ error: 'Código de recuperação inválido ou expirado.' });
    }

    const savedCode = usuario.reset_password_token.split(':')[0];
    if (savedCode !== codigoTrim && usuario.reset_password_token !== codigoTrim) {
      return res.status(400).json({ error: 'Código de verificação incorreto.' });
    }

    const bcrypt = require('bcrypt');
    const senhaHash = await bcrypt.hash(nova_senha, 10);

    await db.runAsync(
      `UPDATE Usuarios 
       SET senha_hash = ?, reset_password_token = NULL, reset_password_expires = NULL 
       WHERE id = ?`,
      [senhaHash, usuario.id]
    );

    logAuditEvent(usuario.id, 'Redefinição Senha Atleta Concluída', `E-mail: ${usuario.email}`, req.ip);

    res.json({ message: 'Sua senha foi redefinida com sucesso! Você já pode fazer login.' });
  } catch (err) {
    console.error('[Public Controller Error] redefinirSenhaAtleta:', err);
    res.status(500).json({ error: 'Erro ao redefinir a senha do atleta.' });
  }
};

// 16. Recuperar/Obter Dados do Pix de uma Reserva Pendente
const obterPixReservaPendente = async (req, res) => {
  const { slug, reserva_id } = req.params;

  try {
    const arena = await db.getAsync(
      'SELECT id, nome, email, telefone, chave_pix, titular_pix, cidade_pix, gateway_access_token FROM Arenas WHERE slug = ? AND status = 1',
      [slug]
    );
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    await expirarReservasAntigas();

    const reserva = await db.getAsync(
      `SELECT r.id, r.tenant_id, r.cliente_id, r.quadra_id, q.nome as quadra_nome, 
              r.data_reserva, r.hora_inicio, r.hora_fim, r.valor_total, 
              r.status, r.status_pagamento, r.criado_em,
              c.nome as cliente_nome, c.email as cliente_email, c.telefone as cliente_telefone, c.cpf as cliente_cpf
       FROM Reservas r
       JOIN Quadras q ON r.quadra_id = q.id
       LEFT JOIN Clientes c ON r.cliente_id = c.id
       WHERE r.id = ? AND r.tenant_id = ?`,
      [reserva_id, arena.id]
    );

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    if (reserva.status === 'Cancelada' || reserva.status_pagamento === 'Expirado') {
      return res.status(400).json({ error: 'Esta reserva foi cancelada ou expirou por falta de pagamento.' });
    }

    if (reserva.status_pagamento === 'Pago') {
      return res.json({
        reserva_id: reserva.id,
        status: reserva.status,
        status_pagamento: 'Pago',
        message: 'Esta reserva já foi paga com sucesso!'
      });
    }

    let transacao = await db.getAsync('SELECT gateway_ref FROM TransacoesGateway WHERE reserva_id = ? ORDER BY id DESC', [reserva.id]);

    let gatewayRef = transacao?.gateway_ref || `PIX_${reserva.id}_${Date.now()}`;
    let copiaCola = null;
    let qrCode = null;

    if (!copiaCola) {
      try {
        if (arena.gateway_access_token) {
          const pixData = await criarCobrancaPix(reserva.id, reserva.valor_total, arena.id);
          if (pixData) {
            gatewayRef = pixData.gateway_ref || gatewayRef;
            copiaCola = pixData.copia_cola;
            qrCode = pixData.qr_code;
          }
        }
      } catch (eGateway) {
        console.warn('[Public Controller Warning] Erro ao re-gerar Pix via gatewayService:', eGateway.message);
      }
    }

    if (!copiaCola) {
      const chavePixArena = arena.chave_pix || arena.email || arena.telefone || 'financeiro@felparena.com.br';
      const titularArena = arena.titular_pix || arena.nome || 'Felp Arena';
      const cidadeArena = arena.cidade_pix || 'SAO PAULO';

      copiaCola = gerarPixEMV({
        chave: chavePixArena,
        nome: titularArena,
        cidade: cidadeArena,
        valor: reserva.valor_total,
        txid: `RES${reserva.id}`
      });
    }

    if (!qrCode) {
      qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(copiaCola)}`;
    }

    const criadoEmRaw = reserva.criado_em ? String(reserva.criado_em).replace(' ', 'T') : new Date().toISOString();
    const criadoEmStr = criadoEmRaw.endsWith('Z') ? criadoEmRaw : `${criadoEmRaw}Z`;
    const criadoEmTime = new Date(criadoEmStr).getTime();
    const agoraTime = Date.now();
    const decorridoSegundos = Math.max(0, Math.floor((agoraTime - criadoEmTime) / 1000));
    const restanteSegundos = Math.max(0, (15 * 60) - decorridoSegundos);
    const expiraEmMinutos = Math.ceil(restanteSegundos / 60);

    res.json({
      reserva_id: reserva.id,
      quadra_nome: reserva.quadra_nome,
      data_reserva: reserva.data_reserva,
      hora_inicio: reserva.hora_inicio,
      hora_fim: reserva.hora_fim,
      valor_total: reserva.valor_total,
      status: reserva.status,
      status_pagamento: reserva.status_pagamento,
      gateway_ref: gatewayRef,
      copia_cola: copiaCola,
      qr_code: qrCode,
      expira_em_minutos: expiraEmMinutos,
      expira_em_segundos: restanteSegundos
    });
  } catch (err) {
    console.error('[Public Controller Error] obterPixReservaPendente:', err);
    res.status(500).json({ error: 'Erro ao consultar dados do Pix da reserva.' });
  }
};

const cancelarReservaAtleta = async (req, res) => {
  const { slug, id } = req.params;
  const reservaId = parseInt(id, 10);

  if (!reservaId || isNaN(reservaId)) {
    return res.status(400).json({ error: 'ID de reserva inválido.' });
  }

  try {
    const arena = await db.getAsync('SELECT id, nome, telefone, email FROM Arenas WHERE slug = ? AND status = 1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    const reserva = await db.getAsync(
      `SELECT r.*, q.nome as quadra_nome, c.nome as cliente_nome, c.email as cliente_email, c.telefone as cliente_telefone, c.cpf as cliente_cpf
       FROM Reservas r
       JOIN Quadras q ON r.quadra_id = q.id
       JOIN Clientes c ON r.cliente_id = c.id
       WHERE r.id = ? AND r.tenant_id = ?`,
      [reservaId, arena.id]
    );

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }

    if (reserva.status === 'Cancelada') {
      return res.status(400).json({ error: 'Esta reserva já se encontra cancelada.' });
    }

    const todayStr = getTodayString();
    const currentTimeStr = getLocalTimeString();

    if (reserva.data_reserva < todayStr || (reserva.data_reserva === todayStr && reserva.hora_inicio <= currentTimeStr)) {
      return res.status(400).json({ error: 'Não é possível cancelar uma reserva de data ou horário que já passou.' });
    }


    const crypto = require('crypto');
    const codigoValidacao = 'VAL-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    let estornoStatus = 'none';
    let mensagemDevolucao = 'Reserva cancelada com sucesso.';

    if (reserva.status_pagamento === 'Pago') {
      const { estornarPagamentoPix } = require('../services/gatewayService');
      const estornoMp = await estornarPagamentoPix(reserva.id, arena.id);

      if (estornoMp && estornoMp.success) {
        estornoStatus = 'automatic';
        mensagemDevolucao = 'Reserva cancelada e valor estornado automaticamente via Pix pelo Mercado Pago!';
        await db.runAsync(
          `UPDATE Reservas 
           SET status = 'Cancelada', status_pagamento = 'Estornado', 
               codigo_validacao_cancelamento = ?, observacoes_cancelamento = 'Cancelado pelo cliente (Estorno MP Automático)'
           WHERE id = ?`,
          [codigoValidacao, reserva.id]
        );
      } else {
        estornoStatus = 'manual';
        mensagemDevolucao = 'Reserva cancelada. Entre em contato com a arena via WhatsApp para realizar o estorno do Pix.';
        await db.runAsync(
          `UPDATE Reservas 
           SET status = 'Cancelada', status_pagamento = 'Cancelado (Pendente Estorno)', 
               codigo_validacao_cancelamento = ?, observacoes_cancelamento = 'Cancelado pelo cliente (Pendente Estorno Manual)'
           WHERE id = ?`,
          [codigoValidacao, reserva.id]
        );
      }
    } else {
      await db.runAsync(
        `UPDATE Reservas 
         SET status = 'Cancelada', codigo_validacao_cancelamento = ?, observacoes_cancelamento = 'Cancelado pelo cliente'
         WHERE id = ?`,
        [codigoValidacao, reserva.id]
      );
    }

    res.json({
      success: true,
      status: 'Cancelada',
      refund_status: estornoStatus,
      message: mensagemDevolucao,
      codigo_validacao: codigoValidacao,
      arena: {
        nome: arena.nome,
        telefone: arena.telefone || ''
      },
      reserva: {

        id: reserva.id,
        quadra_nome: reserva.quadra_nome,
        data_reserva: reserva.data_reserva,
        hora_inicio: reserva.hora_inicio,
        hora_fim: reserva.hora_fim,
        valor_total: reserva.valor_total,
        cliente_nome: reserva.cliente_nome,
        cliente_email: reserva.cliente_email,
        cliente_telefone: reserva.cliente_telefone,
        cliente_cpf: reserva.cliente_cpf || 'Não informado'
      }
    });
  } catch (err) {
    console.error('[Public Controller Error] cancelarReservaAtleta:', err);
    res.status(500).json({ error: 'Erro ao processar o cancelamento da reserva.' });
  }
};

// Exclusão Definitiva de Conta de Atleta (LGPD)
const excluirContaAtleta = async (req, res) => {
  const { slug } = req.params;
  const { cliente_id, phone, email } = req.body;

  try {
    const arena = await db.getAsync('SELECT id FROM Arenas WHERE slug = ? AND status != -1', [slug]);
    if (!arena) {
      return res.status(404).json({ error: 'Arena não encontrada.' });
    }

    let cliente = null;
    if (cliente_id) {
      cliente = await db.getAsync('SELECT id, nome, email, telefone FROM Clientes WHERE id = ?', [cliente_id]);
    } else if (phone || email) {
      const cleanPhone = (phone || '').replace(/\D/g, '');
      cliente = await db.getAsync(
        `SELECT id, nome, email, telefone FROM Clientes 
         WHERE (telefone = ? OR (telefone LIKE ? AND length(?) >= 8)) OR (email = ? AND length(?) > 3)`,
        [phone, `%${cleanPhone.slice(-8)}`, cleanPhone, email, email]
      );
    }

    if (!cliente) {
      return res.status(404).json({ error: 'Conta de atleta não encontrada.' });
    }

    // 1. Anonimizar Reservas antigas (Manter Faturamento & Relatórios de Caixa da Arena)
    await db.runAsync(
      `UPDATE Reservas 
       SET cliente_nome = 'Cliente Removido (LGPD)',
           cliente_email = NULL,
           cliente_telefone = NULL,
           cliente_cpf = NULL,
           cliente_id = NULL
       WHERE cliente_id = ? OR (cliente_telefone = ? AND cliente_telefone IS NOT NULL) OR (cliente_email = ? AND cliente_email IS NOT NULL)`,
      [cliente.id, cliente.telefone, cliente.email]
    );

    // 2. Registrar Audit Log
    try {
      logAuditEvent('LGPD_EXCLUSAO_CONTA', `Atleta ID ${cliente.id} (${cliente.nome}) solicitou a exclusão definitiva de seus dados sob LGPD.`, {
        cliente_id: cliente.id,
        arena_id: arena.id
      });
    } catch (e) {
      console.warn('[LGPD Audit Warning]', e.message);
    }

    // 3. Excluir conta de atleta permanentemente
    await db.runAsync('DELETE FROM Clientes WHERE id = ?', [cliente.id]);

    res.json({
      success: true,
      message: 'Sua conta e seus dados pessoais foram excluídos permanentemente com sucesso.'
    });
  } catch (err) {
    console.error('[Public Controller Error] excluirContaAtleta:', err);
    res.status(500).json({ error: 'Erro ao processar a exclusão da conta. Tente novamente.' });
  }
};

module.exports = {
  getTenantBySlug,
  getQuadrasBySlug,
  getDisponibilidadeBySlug,
  agendarReservaPublica,
  cadastrarAtletaPublico,
  loginAtletaPublico,
  googleAuthAtletaPublico,
  getPerfilAtleta,
  atualizarPerfilAtleta,
  simularPagamentoPublico,
  getStatusReservaPublica,
  cancelarPendentePublico,
  getMinhasReservasAtleta,
  solicitarRecuperacaoSenhaAtleta,
  redefinirSenhaAtleta,
  obterPixReservaPendente,
  cancelarReservaAtleta,
  excluirContaAtleta
};



