// reservas.js - Motor de renderização da Grade de Reservas

document.addEventListener('DOMContentLoaded', () => {
  const gradeTable = document.getElementById('grade-table');
  const token = localStorage.getItem('courtmanager_token');
  const filterQuadra = document.getElementById('filter-quadra');
  
  let currentReservas = []; // Guarda as reservas ativas da tela

  if (!gradeTable) return;

  // Variáveis globais de estado
  let currentState = {
    scope: 'diaria',
    dataInicio: null,
    dataFim: null,
    baseDate: new Date(),
    intervalo: parseInt(localStorage.getItem('grade_interval') || '60', 10)
  };

  // Escutar mudança de datas vinda do app.js
  window.addEventListener('gradeDateChanged', (e) => {
    const wasSemanal = (currentState.scope === 'semanal');
    
    currentState.scope = e.detail.scope;
    currentState.dataInicio = e.detail.dataInicio;
    currentState.dataFim = e.detail.dataFim;
    currentState.baseDate = e.detail.baseDate;
    
    if (wasSemanal && currentState.scope === 'diaria' && filterQuadra) {
      filterQuadra.value = '';
    }

    // Gerencia a visibilidade da opção "Todas as quadras"
    if (filterQuadra) {
      const optionTodas = filterQuadra.querySelector('option[value=""]');
      if (optionTodas) {
        if (currentState.scope === 'semanal') {
          optionTodas.style.display = 'none';
          optionTodas.disabled = true;
          // Se estava selecionado, muda para a primeira quadra real
          if (filterQuadra.value === '') {
            if (filterQuadra.options.length > 1) filterQuadra.value = filterQuadra.options[1].value;
          }
        } else {
          optionTodas.style.display = '';
          optionTodas.disabled = false;
        }
      }
    }
    
    fetchAndRenderGrade();
  
  // Função para abrir a modal de pagamento e popular os dados dinâmicos
  window.abrirModalPagamento = () => {
    const id = window.currentReservaId;
    if (!id) return;
    
    // Assumindo que currentReservas está disponível no escopo de reservas.js
    const r = currentReservas.find(x => x.id === id);
    if (!r) return;

    if (window.closeModal) window.closeModal('modal-detalhe-reserva');
    
    // Atualizar o texto dinâmico da modal de pagamento
    const infoEl = document.getElementById('modal-pag-info');
    if (infoEl) {
      // Calcular saldo devedor focado na UI por enquanto
      const valorFmt = parseFloat(r.valor_total || 0).toFixed(2).replace('.',',');
      const saldoFmt = r.status_pagamento === 'Pago' ? '0,00' : valorFmt; // Melhorar isso depois com backend real de saldo
      
      infoEl.innerHTML = `Reserva #${r.id} &middot; ${r.cliente_nome} &middot; Saldo devedor: <strong style="color:var(--danger)">R$ ${saldoFmt}</strong>`;
    }
    
    // Limpar campos
    const pagValor = document.getElementById('pag-valor');
    const pagMetodo = document.getElementById('pag-metodo');
    const pagData = document.getElementById('pag-data');
    if (pagValor) pagValor.value = '';
    if (pagMetodo) pagMetodo.value = '';
    
    // Preencher data do pagamento com data atual local
    if (pagData) {
      const now = new Date();
      const tzOffset = now.getTimezoneOffset() * 60000;
      pagData.value = new Date(Date.now() - tzOffset).toISOString().split('T')[0];
    }

    if (window.openModal) window.openModal('modal-registrar-pagamento');
  };

  window.abrirModalEstorno = () => {
    if (window.closeModal) window.closeModal('modal-detalhe-reserva');
    if (window.openModal) window.openModal('modal-estornar-pagamento');
  };

});

  // Escutar mudança no select de quadras
  if (filterQuadra) {
    filterQuadra.addEventListener('change', () => {
      fetchAndRenderGrade();
    });
  }

  // Gera o array de horários baseado no funcionamento das quadras visíveis
  function generateTimeSlots(intervalo, quadras) {
    let minHour = 8;
    let maxHour = 22;

    if (quadras && quadras.length > 0) {
      let earliest = '23:59';
      let latest = '00:00';
      quadras.forEach(q => {
        if (q.hora_abertura && q.hora_abertura < earliest) earliest = q.hora_abertura;
        if (q.hora_fechamento && q.hora_fechamento > latest) latest = q.hora_fechamento;
      });
      if (earliest !== '23:59') minHour = parseInt(earliest.split(':')[0], 10);
      if (latest !== '00:00') {
        const parts = latest.split(':');
        maxHour = parseInt(parts[0], 10);
        // Se a quadra fecha 22:30, precisamos ir até 22:30, mas para simplificar
        // o maxHour será teto
        if (parseInt(parts[1], 10) > 0) maxHour++;
      }
    }

    const slots = [];
    let currentHour = minHour;
    let currentMin = 0;
    while (currentHour < maxHour || (currentHour === maxHour && currentMin === 0)) {
      const h = currentHour.toString().padStart(2, '0');
      const m = currentMin.toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
      currentMin += intervalo;
      if (currentMin >= 60) {
        currentHour++;
        currentMin -= 60;
      }
    }
    return slots;
  }

  // Busca dados na API
  async function fetchAndRenderGrade() {
    if (!token) return;
    try {
      const url = new URL('http://localhost:3000/api/reservas/grade');
      // Adiciona o timezone offset ou apenas pega YYYY-MM-DD
      url.searchParams.append('data_inicio', currentState.dataInicio);
      url.searchParams.append('data_fim', currentState.dataFim);

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('Erro ao buscar grade');
      
      const { quadras, reservas, bloqueios } = await res.json();
      currentReservas = reservas || [];
      renderGrade(quadras, currentReservas, bloqueios);
    } catch (e) {
      console.error(e);
      gradeTable.innerHTML = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--danger);">Erro ao carregar grade.</div>`;
    }
  }

  // Renderiza a grade
  function renderGrade(todasQuadras, reservas, bloqueios) {
    const selectedQuadraId = filterQuadra ? filterQuadra.value : '';
    
    // Na visão semanal, obrigatoriamente precisamos de uma quadra selecionada.
    // Se estiver em "Todas", forçamos a primeira quadra.
    let quadrasParaExibir = todasQuadras;
    if (currentState.scope === 'semanal') {
      if (!selectedQuadraId && todasQuadras.length > 0) {
        quadrasParaExibir = [todasQuadras[0]];
        if (filterQuadra) filterQuadra.value = todasQuadras[0].id;
      } else {
        quadrasParaExibir = todasQuadras.filter(q => q.id.toString() === selectedQuadraId);
      }
    } else {
      if (selectedQuadraId) {
        quadrasParaExibir = todasQuadras.filter(q => q.id.toString() === selectedQuadraId);
      }
    }

    if (quadrasParaExibir.length === 0) {
      gradeTable.innerHTML = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--muted);">Nenhuma quadra ativa para exibir.</div>`;
      return;
    }

    const timeSlots = generateTimeSlots(currentState.intervalo, quadrasParaExibir);
    
    // Precisamos definir as colunas com base no escopo
    let colunas = [];
    if (currentState.scope === 'diaria') {
      // Diária: colunas são as quadras
      colunas = quadrasParaExibir.map(q => ({
        id: `q-${q.id}`,
        label: q.nome,
        subLabel: q.tipo,
        quadra_id: q.id,
        data: currentState.dataInicio,
        hora_abertura: q.hora_abertura || '08:00',
        hora_fechamento: q.hora_fechamento || '22:00'
      }));
    } else {
      // Semanal: colunas são os dias da semana (de dataInicio até dataFim)
      const q = quadrasParaExibir[0];
      let d = new Date(currentState.dataInicio + 'T00:00:00'); // Trata como local time meia-noite
      const endD = new Date(currentState.dataFim + 'T00:00:00');
      const format = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
      
      while (d <= endD) {
        const diaStr = d.toISOString().split('T')[0];
        colunas.push({
          id: `d-${diaStr}`,
          label: format.format(d),
          subLabel: q.nome,
          quadra_id: q.id,
          data: diaStr,
          hora_abertura: q.hora_abertura || '08:00',
          hora_fechamento: q.hora_fechamento || '22:00'
        });
        d.setDate(d.getDate() + 1);
      }
    }

    // Configura o CSS Grid Dinamicamente
    gradeTable.style.gridTemplateColumns = `80px repeat(${colunas.length}, 1fr)`;
    
    let html = '';
    // Header Row (Row 1)
    html += `<div class="gh-cell" style="grid-column: 1; grid-row: 1"></div>`;
    colunas.forEach((col, idx) => {
      html += `
        <div class="gh-cell" style="grid-column: ${idx + 2}; grid-row: 1">
          ${col.label}
          <span class="today-pill">${col.subLabel}</span>
        </div>
      `;
    });

    // Time Rows
    timeSlots.forEach((time, timeIndex) => {
      const row = timeIndex + 2; // +2 porque o Header é row 1

      // Apenas mostra os :30 se for o intervalo menor
      if (currentState.intervalo === 60 && time.endsWith(':30')) return;

      // Se for intervalo 30, mostra label do horário, ex "08:00" ou "08:30" (ou deixa menor)
      html += `<div class="gt-time" style="grid-column: 1; grid-row: ${row}">${time}</div>`;
      
      colunas.forEach((col, idx) => {
        // Encontra o que há nesse slot exato
        const reserva = reservas.find(r => 
          r.quadra_id === col.quadra_id && 
          r.data_reserva === col.data && 
          r.hora_inicio <= time && 
          r.hora_fim > time
        );

        const bloqueio = bloqueios.find(b => 
          b.quadra_id === col.quadra_id && 
          b.data_bloqueio === col.data && 
          b.hora_inicio <= time && 
          b.hora_fim > time
        );

        if (bloqueio) {
          // O tempo atual cai dentro do bloqueio?
          if (bloqueio.hora_inicio <= time && bloqueio.hora_fim > time) {
             html += `
              <div class="gt-slot s-blocked" style="grid-column: ${idx + 2}; grid-row: ${row}; cursor: pointer;"
                   onclick="abrirModalBloqueio(${bloqueio.id}, '${time}')" title="Clique para gerenciar bloqueio">
                <span class="slot-name">${bloqueio.motivo || 'Bloqueado'}</span>
              </div>
            `;
          } else if (bloqueio.hora_inicio > time) {
            // Antes de começar de fato
            html += generateLivreSlot(idx, col, time, row);
          }
        } else if (reserva) {
          // É o início da reserva?
          if (reserva.hora_inicio === time) {
            let cssClass = 's-pending';
            let labelStatus = 'Pendente';
            
            if (reserva.status_pagamento === 'Pago') {
              cssClass = 's-paid'; labelStatus = 'Pago';
            } else if (reserva.status_pagamento === 'Parcial') {
              cssClass = 's-partial'; labelStatus = 'Parcial';
            }

            // Calculo de span
            let span = 1;
            if (currentState.intervalo === 30) {
               const hI = parseInt(reserva.hora_inicio.split(':')[0], 10);
               const mI = parseInt(reserva.hora_inicio.split(':')[1], 10);
               const hF = parseInt(reserva.hora_fim.split(':')[0], 10);
               const mF = parseInt(reserva.hora_fim.split(':')[1], 10);
               const duracaoMinutos = (hF * 60 + mF) - (hI * 60 + mI);
               span = Math.ceil(duracaoMinutos / 30);
            } else {
               const hI = parseInt(reserva.hora_inicio.split(':')[0], 10);
               const hF = parseInt(reserva.hora_fim.split(':')[0], 10);
               span = hF - hI;
            }

            const priceLabel = reserva.valor_total ? `R$ ${parseFloat(reserva.valor_total).toFixed(2)} · ${labelStatus}` : labelStatus;

            // Usa grid-row: span X
            html += `
              <div class="gt-slot ${cssClass}" style="grid-column: ${idx + 2}; grid-row: ${row} / span ${span};"
                   tabindex="0" role="button" onclick="abrirDetalheReserva(${reserva.id})">
                <span class="slot-name">${reserva.cliente_nome || 'Cliente'}</span>
                <span class="slot-label">${priceLabel}</span>
              </div>
            `;
          } else {
            // É o meio da reserva!
            // NÃO EMITE NADA (nem div invisível). O span X acima já ocupa fisicamente esse espaço no grid.
            // Isso evita que divs vazias sejam "empurradas" pelo auto-placement.
          }
        } else {
          // Livre ou Fechada
          if (time < col.hora_abertura || time >= col.hora_fechamento) {
            html += `<div class="gt-slot s-blocked" style="grid-column: ${idx + 2}; grid-row: ${row}; background: var(--charcoal-03); border: 1px solid var(--border-passive); opacity: 0.5; pointer-events: none;">
                      <span class="slot-name" style="color: var(--muted);">Fechada</span>
                     </div>`;
          } else {
            html += generateLivreSlot(idx, col, time, row);
          }
        }
      });
    });

    gradeTable.innerHTML = html;
  }

  function generateLivreSlot(colIndex, col, time, row) {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(Date.now() - tzOffset).toISOString();
    const todayStr = localISOTime.split('T')[0];
    const currentTimeStr = localISOTime.split('T')[1].substring(0, 5);

    let isPast = false;
    if (col.data < todayStr) {
      isPast = true;
    } else if (col.data === todayStr && time <= currentTimeStr) {
      isPast = true;
    }

    if (isPast) {
      return `<div class="gt-slot" style="grid-column: ${colIndex + 2}; grid-row: ${row}; background: rgba(0,0,0,0.04); border: none; pointer-events: none;"></div>`;
    }

    return `
      <div class="gt-slot s-available" style="grid-column: ${colIndex + 2}; grid-row: ${row}" tabindex="0" role="button" 
           onclick="iniciarNovaReserva(${col.quadra_id}, '${col.data}', '${time}')">
        <span class="slot-label">Livre</span>
      </div>
    `;
  }

  // Exportar funções globais para serem chamadas pelos onclick do HTML gerado
  window.iniciarNovaReserva = async (quadraId, data, horaInicio) => {
    const qSelect = document.getElementById('nr-quadra');
    const dInput = document.getElementById('nr-data');
    const hInput = document.getElementById('nr-inicio');
    const hFimInput = document.getElementById('nr-fim');

    if(qSelect) qSelect.value = quadraId;
    if(dInput) dInput.value = data;
    
    // Usa dataset.pendingValue para passar o valor desejado para atualizarHorariosDisponiveis
    if(hInput) {
      hInput.dataset.pendingValue = horaInicio;
    }

    if(hFimInput) {
      const [h, m] = horaInicio.split(':');
      const fimH = (parseInt(h) + 1).toString().padStart(2, '0');
      hFimInput.dataset.pendingValue = `${fimH}:${m}`;
    }

    if(window.atualizarHorariosDisponiveis) {
      await window.atualizarHorariosDisponiveis();
    }

    if(window.openModal) window.openModal('modal-nova-reserva');
  };

  window.abrirDetalheReserva = (id) => {
    const r = currentReservas.find(x => x.id === id);
    if (!r) return;
    window.currentReservaId = id; // guarda para as ações

    // Preenche Detalhes
    document.getElementById('modal-detalhe-title').textContent = `Reserva #${r.id}`;
    
    // Status visual
    const statusEl = document.querySelector('#modal-detalhe-reserva .badge');
    if (statusEl) {
      statusEl.className = 'badge';
      if (r.status_pagamento === 'Pago') statusEl.classList.add('badge--paid');
      else if (r.status_pagamento === 'Parcial') statusEl.classList.add('badge--partial');
      else statusEl.classList.add('badge--pending');
      statusEl.textContent = r.status_pagamento;
    }

    // Informações
    const elCliente = document.getElementById('detalhe-cliente');
    const elQuadra = document.getElementById('detalhe-quadra');
    const elHorario = document.getElementById('detalhe-horario');
    const elValorTotal = document.getElementById('detalhe-valor-total');
    const elValorPago = document.getElementById('detalhe-valor-pago');
    const elSaldo = document.getElementById('detalhe-saldo');

    if (elCliente) elCliente.textContent = `${r.cliente_nome}`;
    if (elQuadra) elQuadra.textContent = `${r.quadra_nome || 'Quadra'}`;

    // Formata a data (evitando problema de fuso mudando o dia)
    if (elHorario) {
      const parts = r.data_reserva.split('-'); // ex "2026-07-13"
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1]-1, parts[2]);
        const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
        elHorario.textContent = `${fmtData} · ${r.hora_inicio} – ${r.hora_fim}`;
      } else {
        elHorario.textContent = `${r.data_reserva} · ${r.hora_inicio} – ${r.hora_fim}`;
      }
    }

    const valorTotalFmt = `R$ ${parseFloat(r.valor_total || 0).toFixed(2).replace('.',',')}`;
    if (elValorTotal) elValorTotal.textContent = valorTotalFmt;
    
    // Fakes de pago/saldo por enquanto (pois o backend não devolve valor_pago e saldo_devedor na grade ainda)
    if (elValorPago) elValorPago.textContent = r.status_pagamento === 'Pago' ? valorTotalFmt : 'R$ 0,00';
    if (elSaldo) elSaldo.textContent = r.status_pagamento === 'Pago' ? 'R$ 0,00' : valorTotalFmt;
    
    // Configura texto do cancelar
    const cancelarTexto = document.querySelector('#modal-cancelar-reserva p strong');
    if (cancelarTexto) cancelarTexto.textContent = r.cliente_nome;

    if(window.openModal) window.openModal('modal-detalhe-reserva');
  };

  window.abrirModalBloqueio = (id, time) => {
    window.currentBloqueioId = id;
    window.currentBloqueioTime = time;

    // Calcular hora de fim do "furo" com base no intervalo atual
    const [h, m] = time.split(':').map(Number);
    const duracao = currentState.intervalo;
    const hFim = Math.floor((h * 60 + m + duracao) / 60).toString().padStart(2, '0');
    const mFim = ((m + duracao) % 60).toString().padStart(2, '0');
    window.currentBloqueioEndTime = `${hFim}:${mFim}`;

    const lbl = document.getElementById('lbl-hora-desbloqueio');
    if (lbl) lbl.textContent = `${time} às ${window.currentBloqueioEndTime}`;

    if(window.openModal) window.openModal('modal-gerenciar-bloqueio');
  };

  const btnDesbloquearHora = document.getElementById('btn-desbloquear-hora');
  if (btnDesbloquearHora) {
    btnDesbloquearHora.addEventListener('click', async () => {
      const id = window.currentBloqueioId;
      if (!id) return;
      try {
        const res = await fetch(`http://localhost:3000/api/reservas/bloqueios/${id}/desbloquear-hora`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            hora_inicio_desbloqueio: window.currentBloqueioTime,
            hora_fim_desbloqueio: window.currentBloqueioEndTime
          })
        });
        if (!res.ok) throw new Error('Erro ao desbloquear horário');
        if(window.showToast) window.showToast('Horário desbloqueado com sucesso!', 'success');
        if(window.closeModal) window.closeModal('modal-gerenciar-bloqueio');
        fetchAndRenderGrade();
      } catch (e) {
        console.error(e);
        if(window.showToast) window.showToast('Erro ao desbloquear o horário.', 'error');
      }
    });
  }

  const btnDesbloquearTudo = document.getElementById('btn-desbloquear-tudo');
  if (btnDesbloquearTudo) {
    btnDesbloquearTudo.addEventListener('click', async () => {
      const id = window.currentBloqueioId;
      if (!id) return;
      try {
        const res = await fetch(`http://localhost:3000/api/reservas/bloqueios/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Erro ao remover bloqueio');
        if(window.showToast) window.showToast('Bloqueio removido integralmente!', 'success');
        if(window.closeModal) window.closeModal('modal-gerenciar-bloqueio');
        fetchAndRenderGrade();
      } catch (e) {
        console.error(e);
        if(window.showToast) window.showToast('Erro ao remover o bloqueio.', 'error');
      }
    });
  }

  // Antigo removerBloqueio removido.
  // Botão Confirmar Cancelamento
  const btnConfirmarCancelamento = document.getElementById('btn-confirmar-cancelamento');
  if (btnConfirmarCancelamento) {
    btnConfirmarCancelamento.addEventListener('click', async () => {
      const motivoSelect = document.getElementById('motivo-cancelamento');
      const obsInput = document.getElementById('obs-cancelamento');
      if (!motivoSelect.value) {
        if(window.showToast) window.showToast('Selecione um motivo para o cancelamento.', 'warning');
        return;
      }
      if (!window.currentReservaId) return;

      try {
        const res = await fetch(`http://localhost:3000/api/reservas/${window.currentReservaId}/cancelar`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ motivo: motivoSelect.value, observacoes: obsInput.value })
        });
        
        if (!res.ok) throw new Error('Erro ao cancelar reserva');
        
        if(window.showToast) window.showToast('Reserva cancelada com sucesso.', 'success');
        if(window.closeModal) window.closeModal('modal-cancelar-reserva');
        fetchAndRenderGrade();
      } catch (err) {
        console.error(err);
        if(window.showToast) window.showToast('Falha ao cancelar reserva.', 'error');
      }
    });
  }

  // Carregar os filtros de quadra se for necessário
  async function loadQuadrasFilter() {
    if (!filterQuadra) return;
    try {
      const res = await fetch('http://localhost:3000/api/quadras', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const quadras = await res.json();

      // Usa filterQuadra do escopo externo (sem redeclarar)
      filterQuadra.innerHTML = '<option value="">Todas as quadras</option>' + 
        quadras.map(q => `<option value="${q.id}">${q.nome} — ${q.tipo || 'Geral'}</option>`).join('');
        
      // Aplica a regra de visibilidade se estiver em modo semanal
      const optionTodas = filterQuadra.querySelector('option[value=""]');
      if (optionTodas && currentState.scope === 'semanal') {
        optionTodas.style.display = 'none';
        optionTodas.disabled = true;
        if (filterQuadra.value === '') {
          if (filterQuadra.options.length > 1) filterQuadra.value = filterQuadra.options[1].value;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar quadras no filtro');
    }
  }

  // Carregar motivos de cancelamento do banco
  async function loadMotivosCancelamento() {
    const motivoSelect = document.getElementById('motivo-cancelamento');
    if (!motivoSelect) return;
    try {
      const res = await fetch('http://localhost:3000/api/motivos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const motivos = await res.json();

      motivoSelect.innerHTML = '<option value="">Selecione o motivo</option>' + 
        motivos.map(m => `<option value="${m.id}">${m.motivo}</option>`).join('');
    } catch (e) {
      console.warn('Erro ao carregar motivos de cancelamento:', e);
    }
  }

  // Expor globalmente para uso no HTML inline (ex: após criar bloqueio)
  window.fetchAndRenderGrade = fetchAndRenderGrade;

  // Disparar update inicial
  loadQuadrasFilter().then(() => {
    if (typeof updateDateLabel === 'function') {
      updateDateLabel();
    } else {
      setTimeout(() => {
        if (typeof updateDateLabel === 'function') updateDateLabel();
      }, 100);
    }
  });
  
  loadMotivosCancelamento();

  // Handler para Registrar Pagamento
  const btnConfirmarPagamento = document.getElementById('btn-confirmar-pagamento');
  if (btnConfirmarPagamento) {
    btnConfirmarPagamento.addEventListener('click', async () => {
      const valor = parseFloat(document.getElementById('pag-valor').value);
      const metodo = document.getElementById('pag-metodo').value;
      const data_pagamento = document.getElementById('pag-data').value;

      if (!valor || valor <= 0 || !metodo || !data_pagamento) {
        alert('Por favor, preencha todos os campos obrigatórios corretamente.');
        return;
      }

      try {
        const res = await fetch('http://localhost:3000/api/pagamentos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            reserva_id: window.currentReservaId,
            valor,
            metodo
          })
        });

        if (!res.ok) {
          const err = await res.json();
          alert(err.error || 'Erro ao registrar pagamento.');
          return;
        }

        alert('Pagamento registrado com sucesso!');
        closeModal('modal-registrar-pagamento');
        if (window.fetchAndRenderGrade) window.fetchAndRenderGrade();
      } catch (e) {
        console.error(e);
        alert('Erro de conexão ao registrar pagamento.');
      }
    });
  }

  // Handler para Estornar Pagamento (na agenda, pode ser genérico ou precisaríamos do pagamento_id real)
  const btnConfirmarEstorno = document.getElementById('btn-confirmar-estorno');
  if (btnConfirmarEstorno) {
    btnConfirmarEstorno.addEventListener('click', async () => {
      alert('Funcionalidade de estorno via agenda em construção. Use a aba Pagamentos para estornar transações específicas.');
      closeModal('modal-estornar-pagamento');
    });
  }

});
