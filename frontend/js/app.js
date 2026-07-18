/* =============================================
   CourtManager — App JavaScript (UI Only)
   Frontend puro: zero lógica de negócio.
   Toda regra de negócio deve ser tratada
   exclusivamente no backend/API.
   ============================================= */

'use strict';

/* ---------- Sidebar ---------- */
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const hamburgerBtn   = document.getElementById('hamburgerBtn');
const sidebarClose   = document.getElementById('sidebarClose');

function openSidebar() {
  sidebar?.classList.add('open');
  sidebarOverlay?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  sidebar?.classList.remove('open');
  sidebarOverlay?.classList.remove('open');
  document.body.style.overflow = '';
}

hamburgerBtn?.addEventListener('click', openSidebar);
sidebarClose?.addEventListener('click', closeSidebar);
sidebarOverlay?.addEventListener('click', closeSidebar);

/* ---------- Highlight active nav item ---------- */
(function highlightNav() {
  const path = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav-item').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path) link.classList.add('active');
    else link.classList.remove('active');
  });
})();

/* ---------- Modal helpers ---------- */
function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) {
    overlay.classList.add('open');
    const firstInput = overlay.querySelector('input, select, textarea');
    setTimeout(() => firstInput?.focus(), 200);
  }
}
function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('open');
}

/* Close modal on overlay click */
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

/* Close modal on ESC */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

/* Expose to inline handlers */
window.openModal  = openModal;
window.closeModal = closeModal;

/* ---------- Slot click on grade (reservas.html) ---------- */
document.querySelectorAll('.slot--available, .grade-slot.available').forEach(slot => {
  slot.addEventListener('click', () => openModal('modal-nova-reserva'));
});

/* ---------- Tab switching ---------- */
document.querySelectorAll('.tabs').forEach(tabGroup => {
  const buttons = tabGroup.querySelectorAll('.tab-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.tab;
      if (target) {
        document.querySelectorAll('[data-tab-content]').forEach(panel => {
          panel.style.display = panel.dataset.tabContent === target ? 'block' : 'none';
        });
      }
    });
  });
});

/* ---------- Chip / filter toggle ---------- */
document.querySelectorAll('.chip[data-filter]').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('active');
  });
});

/* ---------- Chip / radio group (single select) ---------- */
document.querySelectorAll('.chip-group').forEach(group => {
  group.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
});

/* ---------- Date navigation on grade ---------- */
const prevDayBtn = document.getElementById('btn-prev-day');
const nextDayBtn = document.getElementById('btn-next-day');
const gradeDateLabel = document.getElementById('grade-date-label');
const scopeChips = document.querySelectorAll('#scope-toggle .chip');

let currentDate = new Date();
let currentScope = 'diaria'; // diaria | semanal

// Recupera estado anterior para manter a tela se o usuário der F5
const savedScope = sessionStorage.getItem('cm_lastScope');
if (savedScope) currentScope = savedScope;

const savedDate = sessionStorage.getItem('cm_lastDate');
if (savedDate) currentDate = new Date(savedDate);

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

// Sincroniza o visual do chip ao carregar
scopeChips.forEach(c => {
  if (c.dataset.scope === currentScope) c.classList.add('active');
  else c.classList.remove('active');
});

scopeChips.forEach(chip => {
  chip.addEventListener('click', (e) => {
    scopeChips.forEach(c => c.classList.remove('active'));
    e.target.classList.add('active');
    currentScope = e.target.dataset.scope;
    sessionStorage.setItem('cm_lastScope', currentScope);
    updateDateLabel();
  });
});

function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay();
  // Se for 0 (Domingo), queremos que a semana comece na Segunda. Então: diff = 6. 
  // Senão, diff = day - 1.
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

function formatDateISO(date) {
  // Ajusta para o fuso local para evitar problemas de dia anterior
  const d = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return d.toISOString().split('T')[0];
}

function updateDateLabel() {
  if (!gradeDateLabel) return;
  
  let dataInicio, dataFim;

  if (currentScope === 'diaria') {
    gradeDateLabel.textContent = dateFormatter.format(currentDate);
    dataInicio = formatDateISO(currentDate);
    dataFim = dataInicio;
  } else {
    const { start, end } = getWeekRange(currentDate);
    gradeDateLabel.textContent = `${dateFormatter.format(start)} - ${dateFormatter.format(end)}`;
    dataInicio = formatDateISO(start);
    dataFim = formatDateISO(end);
  }
  
  window.dispatchEvent(new CustomEvent('gradeDateChanged', { 
    detail: { scope: currentScope, dataInicio, dataFim, baseDate: currentDate } 
  }));
}

prevDayBtn?.addEventListener('click', () => {
  const step = currentScope === 'diaria' ? 1 : 7;
  currentDate.setDate(currentDate.getDate() - step);
  sessionStorage.setItem('cm_lastDate', currentDate.toISOString());
  updateDateLabel();
});

nextDayBtn?.addEventListener('click', () => {
  const step = currentScope === 'diaria' ? 1 : 7;
  currentDate.setDate(currentDate.getDate() + step);
  sessionStorage.setItem('cm_lastDate', currentDate.toISOString());
  updateDateLabel();
});

updateDateLabel();

/* ---------- Form reset on modal close ---------- */
document.querySelectorAll('.modal-close, [data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    const modal = btn.closest('.modal-overlay');
    if (modal) {
      modal.classList.remove('open');
      modal.querySelectorAll('input, select, textarea').forEach(field => field.value = '');
    }
  });
});

/* ---------- Logout confirm ---------- */
const btnLogout = document.getElementById('btn-logout');
btnLogout?.addEventListener('click', async e => {
  e.preventDefault();
  if (confirm('Deseja encerrar a sessão?')) {
    const token = localStorage.getItem('courtmanager_token');
    if (token) {
      try {
        // Invalida o token no backend
        await fetch('http://localhost:3000/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch(err) {
        console.warn('Erro ao fazer logout na API', err);
      }
      // Limpa a sessão local
      localStorage.removeItem('courtmanager_token');
      localStorage.removeItem('courtmanager_user');
    }
    window.location.href = 'login.html';
  }
});

/* ---------- Global UI Updates ---------- */
(function updateTopbarArena() {
  const arenaNome = localStorage.getItem('arena_nome') || 'Arena Principal';
  document.querySelectorAll('.topbar-arena').forEach(el => {
    el.innerHTML = `<span class="arena-dot"></span>${arenaNome}`;
  });
})();

/* ---------- Simple toast notification ---------- */
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => { toast.classList.add('toast--visible'); }, 10);
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.style.cssText = [
    'position:fixed', 'bottom:24px', 'right:24px',
    'display:flex', 'flex-direction:column', 'gap:8px',
    'z-index:9999', 'pointer-events:none'
  ].join(';');
  document.body.appendChild(container);
  return container;
}

/* Inject toast styles */
(function injectToastStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .toast {
      background: var(--charcoal);
      color: var(--off-white);
      font-size: 13px;
      padding: 10px 16px;
      border-radius: var(--r-md);
      box-shadow: var(--shadow-btn-dark);
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.25s ease, transform 0.25s ease;
      pointer-events: all;
      max-width: 300px;
    }
    .toast--visible { opacity: 1; transform: translateY(0); }
    .toast--success { background: var(--paid); }
    .toast--error   { background: var(--danger); }
    .toast--warning { background: var(--pending); color: #1c1c1c; }
  `;
  document.head.appendChild(style);
})();

window.showToast = showToast;

/* ---------- Sidebar User Info & ACL ---------- */
window.updateSidebarUser = function populateSidebar() {
  try {
    const userJson = localStorage.getItem('courtmanager_user');
    if (userJson) {
      const user = JSON.parse(userJson);
      
      const elAvatar = document.getElementById('sidebar-avatar');
      const elName = document.getElementById('sidebar-name');
      const elRole = document.getElementById('sidebar-role');
      
      if (elName) elName.textContent = user.nome || 'Usuário';
      if (elRole) elRole.textContent = user.perfil || '';
      
      if (elAvatar && user.nome) {
        const parts = user.nome.split(' ');
        let initials = parts[0].charAt(0).toUpperCase();
        if (parts.length > 1) initials += parts[parts.length - 1].charAt(0).toUpperCase();
        elAvatar.textContent = initials;
      }

      applyRoleBasedUI(user.perfil);
    }
  } catch(e) {
    console.warn('Erro ao ler usuário do localStorage', e);
  }
};

function applyRoleBasedUI(perfil) {
  // 1. Ocultar menus da sidebar
  const navAuditoria = document.querySelector('.nav-item[href="auditoria.html"]');
  const navConfig = document.querySelector('.nav-item[href="configuracoes.html"]');
  const navRelatorios = document.querySelector('.nav-item[href="relatorios.html"]');
  
  if (perfil === 'Recepcionista') {
    if (navAuditoria) navAuditoria.style.display = 'none';
    if (navConfig) navConfig.style.display = 'none';
    if (navRelatorios) navRelatorios.style.display = 'none';
  } else if (perfil === 'Gerente') {
    if (navAuditoria) navAuditoria.style.display = 'none';
    if (navConfig) navConfig.style.display = 'none';
  }

  // 2. Ocultar botões específicos (ex: Desconto no pagamento)
  // O botão de desconto tem id "btn-aplicar-desconto" ou está dentro de .desconto-area
  // Vamos tratar dinamicamente injetando uma classe no body
  document.body.setAttribute('data-perfil', perfil);
}

// Injetar regras CSS baseadas em data-perfil
(function injectAclStyles() {
  const style = document.createElement('style');
  style.textContent = `
    body[data-perfil="Recepcionista"] .admin-only,
    body[data-perfil="Recepcionista"] .gerente-only,
    body[data-perfil="Gerente"] .admin-only {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
})();

window.updateSidebarUser();
