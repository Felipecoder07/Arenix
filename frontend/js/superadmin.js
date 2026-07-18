const token = localStorage.getItem('courtmanager_token');
const user = JSON.parse(localStorage.getItem('courtmanager_user') || '{}');

if (!token || user.perfil !== 'SuperAdmin') {
  window.location.href = 'master-login.html';
}

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('courtmanager_token');
  localStorage.removeItem('courtmanager_user');
  window.location.href = 'master-login.html';
});

let allArenas = [];
let allPlanos = [];

// Layout Navigation
window.switchView = (viewId) => {
  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  const activeBtn = Array.from(document.querySelectorAll('.nav-item')).find(btn => btn.getAttribute('onclick') === `switchView('${viewId}')`);
  if (activeBtn) activeBtn.classList.add('active');

  // Hide all views
  document.getElementById('view-dashboard').style.display = 'none';
  document.getElementById('view-arenas').style.display = 'none';
  // other views will be added here later

  // Show requested view
  const target = document.getElementById(`view-${viewId}`);
  if (target) {
    target.style.display = 'flex';
  } else {
    alert('Tela em desenvolvimento.');
    // fallback to dashboard if view doesn't exist yet
    document.getElementById('view-dashboard').style.display = 'flex';
    document.querySelector('.nav-item[onclick="switchView(\'dashboard\')"]').classList.add('active');
    return;
  }

  // Update Title
  const titles = {
    'dashboard': 'Dashboard Geral',
    'arenas': 'Gestão de Arenas',
    'financeiro': 'Visão Financeira',
    'auditoria': 'Log de Auditoria'
  };
  document.getElementById('topbar-title').textContent = titles[viewId] || 'CourtManager Master';
};

async function loadPlanos() {
  try {
    const res = await fetch('http://localhost:3000/api/saas/planos', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    allPlanos = await res.json();
  } catch (err) {
    console.error('Erro ao carregar planos', err);
  }
}
loadPlanos();

async function loadMetrics() {
  try {
    const res = await fetch('http://localhost:3000/api/saas/metrics', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      window.location.href = 'master-login.html';
      return;
    }
    const data = await res.json();
    
    // Antigo m-total removido, usando apenas m-ativas
    document.getElementById('m-ativas').textContent = data.arenasAtivas;
    document.getElementById('m-bloqueadas').textContent = `${data.arenasBloqueadas} bloqueadas`;
    document.getElementById('m-quadras').textContent = data.totalQuadras || 0;
    document.getElementById('m-clientes').textContent = data.totalClientes;
    document.getElementById('m-receita').textContent = `R$ ${parseFloat(data.totalReceitaSaaS).toFixed(2)}`;
  } catch (err) {
    console.error('Erro ao carregar métricas', err);
  }
}

async function loadArenas() {
  try {
    const res = await fetch('http://localhost:3000/api/saas/arenas', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    allArenas = await res.json();
    renderTable(allArenas);
  } catch (err) {
    console.error('Erro ao carregar arenas', err);
  }
}

function renderTable(arenas) {
  const tbody = document.getElementById('arenas-list');
  tbody.innerHTML = '';
  
  if (arenas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--muted);">Nenhuma arena encontrada.</td></tr>';
    return;
  }

  arenas.forEach(arena => {
    const tr = document.createElement('tr');
    const isActive = arena.status === 1;
    
    tr.innerHTML = `
      <td style="color:var(--muted);">${arena.id}</td>
      <td style="font-weight: 500;">${arena.nome}</td>
      <td style="color:var(--muted);">${arena.email || '-'}</td>
      <td><span style="font-size:12px;background:var(--cream-surface);padding:2px 6px;border-radius:4px;">${arena.plano_nome || 'Basic'}</span></td>
      <td>${arena.admins} admin(s)</td>
      <td>${arena.faturas_atrasadas > 0 ? `<span style="color:var(--danger);font-weight:bold;">${arena.faturas_atrasadas} Atrasada(s)</span>` : '-'}</td>
      <td>
        <span class="badge ${isActive ? (arena.faturas_atrasadas > 0 ? 'badge--pending' : 'badge--paid') : 'badge--cancelled'}">
          ${isActive ? (arena.faturas_atrasadas > 0 ? 'Inadimplente' : 'Ativa') : 'Bloqueada'}
        </span>
      </td>
      <td>
        <div class="actions-flex">
          <button class="btn-ghost" style="padding:4px 8px; font-size:12px;" onclick="viewArenaDetails(${arena.id})">🔍 Detalhes</button>
          <button class="btn-ghost" style="padding:4px 8px; font-size:12px; color:var(--paid);" onclick="viewFaturamento(${arena.id}, '${arena.nome.replace(/'/g, "\\'")}')">💲 Faturamento</button>
          <button class="btn-ghost" style="padding:4px 8px; font-size:12px;" onclick="openArenaModal(${arena.id})">✏️ Editar</button>
          <button class="btn-ghost" style="padding:4px 8px; font-size:12px;" onclick="toggleStatus(${arena.id}, ${isActive ? 0 : 1})">
            ${isActive ? 'Bloquear' : 'Desbloquear'}
          </button>
          <button class="btn-ghost" style="padding:4px 8px; font-size:12px; color:var(--blocked);" onclick="promptDeleteArena(${arena.id}, '${arena.nome.replace(/'/g, "\\'")}')">🗑️ Excluir</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Renderiza Inadimplentes Rápidas no Dashboard
  const overdueList = document.getElementById('inadimplentes-lista');
  const overdueCount = document.getElementById('m-inadimplentes-count');
  const overdueArenas = arenas.filter(a => a.faturas_atrasadas > 0);
  
  if (overdueCount) overdueCount.textContent = overdueArenas.length;
  
  if (overdueList) {
    if (overdueArenas.length === 0) {
      overdueList.innerHTML = '<p style="font-size: 13px; color: var(--muted); text-align: center; padding: 12px;">Nenhuma arena inadimplente.</p>';
    } else {
      overdueList.innerHTML = overdueArenas.slice(0, 7).map(a => `
        <button onclick="switchView('arenas'); setTimeout(() => viewFaturamento(${a.id}, '${a.nome.replace(/'/g, "\\'")}'), 100);"
          style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 8px; background: transparent; border: none; cursor: pointer; transition: background 0.2s; text-align: left;"
          onmouseover="this.style.background='var(--cream-surface)'" onmouseout="this.style.background='transparent'">
          <div style="min-width: 0;">
            <div style="font-size: 14px; font-weight: 500; color: var(--charcoal);">${a.nome}</div>
            <div style="font-size: 12px; color: var(--muted);">${a.plano_nome || 'Basic'}</div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-size: 12px; font-weight: 600; color: var(--danger);">${a.faturas_atrasadas} fatura(s)</div>
            <div style="font-size: 11px; color: var(--muted);">Ver detalhes ></div>
          </div>
        </button>
      `).join('');
    }
  }
}

// Search
document.getElementById('search-arena')?.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = allArenas.filter(a => 
    a.nome.toLowerCase().includes(term) ||
    (a.email && a.email.toLowerCase().includes(term)) ||
    (a.status === 1 ? 'ativa' : 'bloqueada').includes(term)
  );
  renderTable(filtered);
});

window.toggleStatus = async (arenaId, newStatus) => {
  if (newStatus === 0) {
    if (!confirm('ATENÇÃO: Bloquear esta arena impedirá todos os administradores e funcionários de acessarem o sistema temporariamente. Confirmar bloqueio?')) {
      return;
    }
  }

  try {
    const res = await fetch(`http://localhost:3000/api/saas/arenas/${arenaId}/status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ status: newStatus })
    });
    
    if (res.ok) {
      loadMetrics();
      loadArenas();
    } else {
      alert('Erro ao atualizar status.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão.');
  }
};

// Modals Setup
window.closeModal = (modalId) => {
  document.getElementById(modalId).classList.remove('active');
};

window.openArenaModal = async (id = null) => {
  document.getElementById('form-arena').reset();
  const modal = document.getElementById('modal-arena-form');
  const title = document.getElementById('modal-arena-title');
  const idInput = document.getElementById('arena-id');
  const sectionCreate = document.getElementById('section-admin-create');

  // Popular Planos
  const planoSelect = document.getElementById('frm-arena-plano');
  planoSelect.innerHTML = allPlanos.map(p => `<option value="${p.id}">${p.nome} (Até ${p.max_quadras} quadras) - R$ ${p.valor_mensal}</option>`).join('');

  if (id) {
    title.textContent = 'Editar Arena';
    sectionCreate.style.display = 'none';
    idInput.value = id;
    
    document.getElementById('frm-resp-nome').removeAttribute('required');
    document.getElementById('frm-resp-email').removeAttribute('required');
    document.getElementById('frm-resp-senha').removeAttribute('required');
    
    // Fetch data
    try {
      const res = await fetch(`http://localhost:3000/api/saas/arenas/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      document.getElementById('frm-arena-nome').value = data.nome || '';
      document.getElementById('frm-arena-email').value = data.email || '';
      document.getElementById('frm-arena-telefone').value = data.telefone || '';
      document.getElementById('frm-arena-endereco').value = data.endereco || '';
      document.getElementById('frm-arena-plano').value = data.plano_id || 1;
      document.getElementById('frm-arena-dia').value = data.dia_vencimento || 10;
    } catch (e) {
      console.error(e);
      alert('Erro ao carregar dados da arena.');
      return;
    }
  } else {
    title.textContent = 'Nova Arena';
    sectionCreate.style.display = 'block';
    idInput.value = '';
    
    document.getElementById('frm-resp-nome').setAttribute('required', 'true');
    document.getElementById('frm-resp-email').setAttribute('required', 'true');
    document.getElementById('frm-resp-senha').setAttribute('required', 'true');
  }

  modal.classList.add('active');
};

window.saveArena = async () => {
  const id = document.getElementById('arena-id').value;
  const isEditing = !!id;
  const form = document.getElementById('form-arena');
  
  if (!form.reportValidity()) return;

  const payload = {
    nome: document.getElementById('frm-arena-nome').value,
    email: document.getElementById('frm-arena-email').value,
    telefone: document.getElementById('frm-arena-telefone').value,
    endereco: document.getElementById('frm-arena-endereco').value,
    dia_vencimento: document.getElementById('frm-arena-dia').value,
    plano_id: document.getElementById('frm-arena-plano').value
  };

  let url = `http://localhost:3000/api/saas/arenas`;
  let method = 'POST';

  if (isEditing) {
    url += `/${id}`;
    method = 'PUT';
  } else {
    // Adiciona dados do responsável
    payload.arena_nome = payload.nome; // Backend POST expects arena_nome
    payload.arena_email = payload.email;
    payload.arena_telefone = payload.telefone;
    payload.arena_endereco = payload.endereco;
    
    payload.resp_nome = document.getElementById('frm-resp-nome').value;
    payload.resp_email = document.getElementById('frm-resp-email').value;
    payload.resp_senha = document.getElementById('frm-resp-senha').value;
  }

  try {
    const res = await fetch(url, {
      method,
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      if (isEditing) {
        // Tenta atualizar o plano também
        const resPlano = await fetch(`http://localhost:3000/api/saas/arenas/${id}/plano`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ plano_id: payload.plano_id })
        });
        if (!resPlano.ok) {
          const errPlano = await resPlano.json();
          alert('Dados salvos, mas erro no plano: ' + (errPlano.error || ''));
        }
      }
      closeModal('modal-arena-form');
      loadMetrics();
      loadArenas();
    } else {
      const err = await res.json();
      alert(err.error || 'Erro ao salvar arena.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão ao salvar.');
  }
};

window.promptDeleteArena = (id, nome) => {
  document.getElementById('del-arena-id').value = id;
  document.getElementById('del-arena-nome').textContent = nome;
  document.getElementById('del-senha-master').value = '';
  document.getElementById('modal-arena-delete').classList.add('active');
};

window.confirmDeleteArena = async () => {
  const id = document.getElementById('del-arena-id').value;
  const senha = document.getElementById('del-senha-master').value;

  if (!senha) {
    alert('A senha é obrigatória.');
    return;
  }

  try {
    const res = await fetch(`http://localhost:3000/api/saas/arenas/${id}`, {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ senha_master: senha })
    });
    
    if (res.ok) {
      closeModal('modal-arena-delete');
      loadMetrics();
      loadArenas();
    } else {
      const err = await res.json();
      alert(err.error || 'Erro ao excluir arena.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão ao excluir.');
  }
};

window.viewArenaDetails = async (id) => {
  const modal = document.getElementById('modal-arena-details');
  const content = document.getElementById('arena-details-content');
  content.innerHTML = '<p style="color:var(--muted);text-align:center;">Carregando...</p>';
  modal.classList.add('active');

  try {
    const res = await fetch(`http://localhost:3000/api/saas/arenas/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Erro na API');
    
    const data = await res.json();
    
    let adminsHtml = data.administradores.map(a => `<li>${a.nome} (${a.email})</li>`).join('');
    if (!adminsHtml) adminsHtml = '<li style="color:var(--muted);">Nenhum administrador</li>';

    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div>
          <h3 style="font-size:18px; font-weight:600; color:var(--charcoal); margin-bottom:4px;">${data.nome}</h3>
          <p style="font-size:13px; color:var(--muted);">ID: ${data.id} | Cadastrado em: ${new Date(data.criado_em).toLocaleDateString()}</p>
        </div>
        
        <div style="background:var(--cream); padding:16px; border-radius:var(--r-md); border:1px solid var(--border-passive);">
          <div style="display:flex; gap:24px;">
            <div>
              <p style="font-size:12px; color:var(--muted); text-transform:uppercase;">Clientes</p>
              <p style="font-size:24px; font-weight:600; color:var(--charcoal);">${data.clientes}</p>
            </div>
            <div>
              <p style="font-size:12px; color:var(--muted); text-transform:uppercase;">Quadras</p>
              <p style="font-size:24px; font-weight:600; color:var(--charcoal);">${data.quadras}</p>
            </div>
          </div>
        </div>

        <div>
          <h4 style="font-size:14px; font-weight:600; margin-bottom:8px;">Contatos</h4>
          <p style="font-size:14px; color:var(--charcoal-83);"><strong>E-mail:</strong> ${data.email || '-'}</p>
          <p style="font-size:14px; color:var(--charcoal-83);"><strong>Telefone:</strong> ${data.telefone || '-'}</p>
          <p style="font-size:14px; color:var(--charcoal-83);"><strong>Endereço:</strong> ${data.endereco || '-'}</p>
        </div>

        <div>
          <h4 style="font-size:14px; font-weight:600; margin-bottom:8px;">Administradores (${data.administradores.length})</h4>
          <ul style="font-size:14px; color:var(--charcoal-83); padding-left:20px;">
            ${adminsHtml}
          </ul>
        </div>
      </div>
    `;

  } catch (err) {
    content.innerHTML = '<p style="color:var(--blocked);text-align:center;">Falha ao carregar detalhes.</p>';
  }
};

window.viewFaturamento = async (arenaId, nomeArena) => {
  document.getElementById('fat-arena-nome').textContent = nomeArena;
  const tbody = document.getElementById('faturas-list');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Carregando...</td></tr>';
  document.getElementById('modal-arena-faturamento').classList.add('active');

  try {
    const res = await fetch(`http://localhost:3000/api/saas/arenas/${arenaId}/faturas`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const faturas = await res.json();
    
    tbody.innerHTML = '';
    if (faturas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--muted);">Nenhuma fatura encontrada.</td></tr>';
      return;
    }

    faturas.forEach(f => {
      const isPaid = f.status === 'Paga';
      const isAtrasada = f.status === 'Atrasada';
      let statusBadge = isPaid ? 'badge--paid' : (isAtrasada ? 'badge--danger' : 'badge--pending');
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(f.data_vencimento).toLocaleDateString()}</td>
        <td>${f.plano_nome}</td>
        <td>R$ ${parseFloat(f.valor).toFixed(2)}</td>
        <td><span class="badge ${statusBadge}">${f.status}</span></td>
        <td>
          ${!isPaid ? `<button class="btn-primary" style="padding:4px 8px; font-size:12px;" onclick="pagarFatura(${f.id}, ${arenaId})">Dar Baixa</button>` : `<span style="font-size:12px; color:var(--muted);">Em ${new Date(f.data_pagamento).toLocaleDateString()}</span>`}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger);">Erro ao carregar faturas.</td></tr>';
  }
};

window.pagarFatura = async (faturaId, arenaId) => {
  if (!confirm('Deseja dar baixa (marcar como paga) nesta fatura manualmente?')) return;
  
  try {
    const res = await fetch(`http://localhost:3000/api/saas/faturas/${faturaId}/pagar`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      }
    });
    
    if (res.ok) {
      alert('Pagamento registrado com sucesso!');
      viewFaturamento(arenaId, document.getElementById('fat-arena-nome').textContent);
      loadMetrics();
      loadArenas(); // Para remover o badge de Inadimplente, se houver
    } else {
      const err = await res.json();
      alert(err.error || 'Erro ao registrar pagamento.');
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão ao registrar pagamento.');
  }
};

// Initialize
loadMetrics();
loadArenas();
