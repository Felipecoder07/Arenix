import { useEffect, useState } from 'react';
import '../../assets/css/configuracoes.css';

interface Quadra {
  id: number;
  nome: string;
  tipo: string;
  preco_base: number;
  hora_abertura: string;
  hora_fechamento: string;
  status: string;
}

interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: string;
  criado_em: string;
}

interface Motivo {
  id: number;
  motivo: string;
}

interface ArenaData {
  nome: string;
  endereco: string;
  telefone: string;
  email: string;
  notif_reserva_email: number;
  notif_reserva_whatsapp: number;
  notif_cancelamento_email: number;
  notif_pagamento_email: number;
  alerta_pagamento_minutos: number;
}

export function AdminConfiguracoes() {
  const [relAtivo, setRelAtivo] = useState<string>(() => {
    return sessionStorage.getItem('cm_config_tab') || 'quadras';
  });

  const [token] = useState<string>(() => localStorage.getItem('courtmanager_token') || '');

  // Lists state
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [arena, setArena] = useState<ArenaData>({
    nome: '',
    endereco: '',
    telefone: '',
    email: '',
    notif_reserva_email: 0,
    notif_reserva_whatsapp: 0,
    notif_cancelamento_email: 0,
    notif_pagamento_email: 0,
    alerta_pagamento_minutos: 30
  });

  // Loadings
  const [loadingQuadras, setLoadingQuadras] = useState(true);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [loadingMotivos, setLoadingMotivos] = useState(true);

  // Modals state
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Forms state: Quadra
  const [nqId, setNqId] = useState<number | null>(null);
  const [nqNome, setNqNome] = useState('');
  const [nqModalidade, setNqModalidade] = useState('');
  const [nqPreco, setNqPreco] = useState('');
  const [nqInicio, setNqInicio] = useState('07:00');
  const [nqFim, setNqFim] = useState('22:00');

  // Forms state: Usuario
  const [nuId, setNuId] = useState<number | null>(null);
  const [nuNome, setNuNome] = useState('');
  const [nuEmail, setNuEmail] = useState('');
  const [nuPerfil, setNuPerfil] = useState('');
  const [nuSenha, setNuSenha] = useState('');

  // Forms state: Motivo
  const [nmNome, setNmNome] = useState('');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleTabChange = (tab: string) => {
    setRelAtivo(tab);
    sessionStorage.setItem('cm_config_tab', tab);
  };

  const formatCurrency = (val: number) => {
    return 'R$ ' + parseFloat(val as any).toFixed(2).replace('.', ',');
  };

  const formatCurrencyInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    const num = parseInt(digits, 10) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatFloatToCurrencyInput = (num: number) => {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrencyToFloat = (value: string) => {
    if (!value) return 0;
    const clean = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  // --- Fetch API helper ---
  const request = async (url: string, options: RequestInit = {}) => {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('courtmanager_token');
        window.location.href = '/login';
        return;
      }
      throw new Error(err.error || 'Erro na requisição');
    }
    return res.json();
  };

  // --- LOAD DATA ---
  const loadQuadras = async () => {
    setLoadingQuadras(true);
    try {
      const data = await request('http://localhost:3000/api/quadras');
      setQuadras(data);
    } catch (e: any) {
      showToast('Erro ao carregar quadras: ' + e.message, 'error');
    } finally {
      setLoadingQuadras(false);
    }
  };

  const loadUsuarios = async () => {
    setLoadingUsuarios(true);
    try {
      const data = await request('http://localhost:3000/api/usuarios');
      setUsuarios(data);
    } catch (e: any) {
      showToast('Erro ao carregar usuários: ' + e.message, 'error');
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const loadMotivos = async () => {
    setLoadingMotivos(true);
    try {
      const data = await request('http://localhost:3000/api/motivos');
      setMotivos(data);
    } catch (e: any) {
      showToast('Erro ao carregar motivos: ' + e.message, 'error');
    } finally {
      setLoadingMotivos(false);
    }
  };

  const loadArena = async () => {
    try {
      const data = await request('http://localhost:3000/api/arenas/minha');
      setArena({
        nome: data.nome || '',
        endereco: data.endereco || '',
        telefone: data.telefone || '',
        email: data.email || '',
        notif_reserva_email: data.notif_reserva_email || 0,
        notif_reserva_whatsapp: data.notif_reserva_whatsapp || 0,
        notif_cancelamento_email: data.notif_cancelamento_email || 0,
        notif_pagamento_email: data.notif_pagamento_email || 0,
        alerta_pagamento_minutos: data.alerta_pagamento_minutos || 30
      });
      if (data.nome) {
        localStorage.setItem('arena_nome', data.nome);
        window.dispatchEvent(new Event('arena_nome_changed'));
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (token) {
      loadQuadras();
      loadUsuarios();
      loadArena();
      loadMotivos();
    }
  }, [token]);

  // --- SAVE QUADRA ---
  const handleSaveQuadra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nqNome || !nqModalidade || !nqPreco) {
      showToast('Preencha os campos obrigatórios.', 'warning');
      return;
    }

    try {
      const payload = {
        nome: nqNome,
        tipo: nqModalidade,
        preco_base: parseCurrencyToFloat(nqPreco),
        hora_abertura: nqInicio,
        hora_fechamento: nqFim
      };

      if (nqId) {
        // Edit
        const currentQuadra = quadras.find(q => q.id === nqId);
        await request(`http://localhost:3000/api/quadras/${nqId}`, {
          method: 'PUT',
          body: JSON.stringify({ ...payload, status: currentQuadra?.status || 'Ativa' })
        });
        showToast('Quadra atualizada com sucesso!', 'success');
      } else {
        // Create
        await request('http://localhost:3000/api/quadras', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Quadra cadastrada com sucesso!', 'success');
      }
      setActiveModal(null);
      loadQuadras();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleStatusQuadra = async (id: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'Ativa' ? 'Inativa' : 'Ativa';
    if (!confirm(`Deseja alterar o status da quadra para ${nextStatus}?`)) return;

    try {
      await request(`http://localhost:3000/api/quadras/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      showToast('Status da quadra atualizado!', 'success');
      loadQuadras();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteQuadra = async (id: number, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir DEFINITIVAMENTE a quadra "${nome}"? Esta ação não pode ser desfeita.`)) return;

    try {
      await request(`http://localhost:3000/api/quadras/${id}`, {
        method: 'DELETE'
      });
      showToast('Quadra excluída com sucesso!', 'success');
      setActiveModal(null);
      loadQuadras();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const openEditarQuadraModal = (q: Quadra) => {
    setNqId(q.id);
    setNqNome(q.nome);
    setNqModalidade(q.tipo);
    setNqPreco(formatFloatToCurrencyInput(q.preco_base));
    setNqInicio(q.hora_abertura || '07:00');
    setNqFim(q.hora_fechamento || '22:00');
    setActiveModal('editar-quadra');
  };

  const openNovaQuadraModal = () => {
    setNqId(null);
    setNqNome('');
    setNqModalidade('');
    setNqPreco('');
    setNqInicio('07:00');
    setNqFim('22:00');
    setActiveModal('nova-quadra');
  };

  // --- SAVE USUARIO ---
  const handleSaveUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuNome || !nuEmail || !nuPerfil) {
      showToast('Preencha nome, e-mail e perfil.', 'warning');
      return;
    }
    if (nuNome.trim().split(/\s+/).length < 2) {
      showToast('Por favor, informe o nome completo (nome e sobrenome).', 'warning');
      return;
    }
    if (!nuId && !nuSenha) {
      showToast('A senha é obrigatória para novos usuários.', 'warning');
      return;
    }

    try {
      const payload: any = { nome: nuNome, email: nuEmail, perfil: nuPerfil };
      if (nuSenha) payload.senha = nuSenha;

      if (nuId) {
        // Edit
        await request(`http://localhost:3000/api/usuarios/${nuId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Usuário atualizado com sucesso!', 'success');

        // Update active sidebar if current user edits themselves
        const loggedUserStr = localStorage.getItem('courtmanager_user');
        if (loggedUserStr) {
          const loggedUser = JSON.parse(loggedUserStr);
          if (loggedUser.id.toString() === nuId.toString()) {
            loggedUser.nome = nuNome;
            loggedUser.perfil = nuPerfil;
            localStorage.setItem('courtmanager_user', JSON.stringify(loggedUser));
            // Trigger local navigation update if page refreshes
          }
        }
      } else {
        // Create
        await request('http://localhost:3000/api/usuarios', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Usuário cadastrado com sucesso!', 'success');
      }
      setActiveModal(null);
      loadUsuarios();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteUsuario = async (id: number, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${nome}"? Esta ação não pode ser desfeita.`)) return;

    try {
      await request(`http://localhost:3000/api/usuarios/${id}`, {
        method: 'DELETE'
      });
      showToast('Usuário excluído com sucesso!', 'success');
      setActiveModal(null);
      loadUsuarios();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const openEditarUsuarioModal = (u: Usuario) => {
    setNuId(u.id);
    setNuNome(u.nome);
    setNuEmail(u.email);
    setNuPerfil(u.perfil);
    setNuSenha('');
    setActiveModal('usuario');
  };

  const openNovoUsuarioModal = () => {
    setNuId(null);
    setNuNome('');
    setNuEmail('');
    setNuPerfil('');
    setNuSenha('');
    setActiveModal('usuario');
  };

  const handleSaveArena = async (e?: React.FormEvent, silent = false) => {
    if (e) e.preventDefault();
    try {
      await request('http://localhost:3000/api/arenas/minha', {
        method: 'PUT',
        body: JSON.stringify(arena)
      });
      if (!silent) {
        showToast('Configurações salvas com sucesso!', 'success');
      }
      loadArena();
    } catch (err: any) {
      showToast('Erro ao salvar: ' + err.message, 'error');
    }
  };

  const handleToggleNotification = (field: keyof ArenaData, value: number) => {
    setArena({ ...arena, [field]: value });
  };

  const handleAddMotivo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nmNome || !nmNome.trim()) {
      showToast('Digite o motivo do cancelamento.', 'warning');
      return;
    }

    try {
      await request('http://localhost:3000/api/motivos', {
        method: 'POST',
        body: JSON.stringify({ motivo: nmNome.trim() })
      });
      showToast('Motivo adicionado com sucesso!', 'success');
      setActiveModal(null);
      setNmNome('');
      loadMotivos();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoveMotivo = async (id: number, nome: string) => {
    if (!confirm(`Tem certeza que deseja remover o motivo "${nome}"?`)) return;

    try {
      await request(`http://localhost:3000/api/motivos/${id}`, {
        method: 'DELETE'
      });
      showToast('Motivo removido com sucesso!', 'success');
      loadMotivos();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="admin-configuracoes-page">
      {/* Toast Alert */}
      {toast && (
        <div 
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg text-white font-medium shadow-lg transition-transform duration-200 ${
            toast.type === 'success' ? 'bg-success' : toast.type === 'warning' ? 'bg-warning' : 'bg-danger'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="config-layout">
        {/* Navegação lateral */}
        <nav className="config-nav" aria-label="Seções de configuração">
          <button 
            className={`config-nav-item w-full text-left ${relAtivo === 'quadras' ? 'active' : ''}`}
            onClick={() => handleTabChange('quadras')}
          >
            Quadras
          </button>
          <button 
            className={`config-nav-item w-full text-left ${relAtivo === 'usuarios' ? 'active' : ''}`}
            onClick={() => handleTabChange('usuarios')}
          >
            Usuários
          </button>
          <button 
            className={`config-nav-item w-full text-left ${relAtivo === 'notificacoes' ? 'active' : ''}`}
            onClick={() => handleTabChange('notificacoes')}
          >
            Notificações
          </button>
          <button 
            className={`config-nav-item w-full text-left ${relAtivo === 'cancelamentos' ? 'active' : ''}`}
            onClick={() => handleTabChange('cancelamentos')}
          >
            Motivos de Cancelamento
          </button>
          <button 
            className={`config-nav-item w-full text-left ${relAtivo === 'arena' ? 'active' : ''}`}
            onClick={() => handleTabChange('arena')}
          >
            Arena
          </button>
        </nav>

        {/* Conteúdo Dinâmico */}
        <div className="config-content">
          
          {/* QUADRAS */}
          <div className={`config-section card ${relAtivo === 'quadras' ? 'active' : ''}`}>
            <div className="card-header">
              <h2 className="card-title">Quadras</h2>
              <button className="btn-primary" onClick={openNovaQuadraModal}>+ Nova Quadra</button>
            </div>
            <div className="table-wrap">
              <table aria-label="Quadras cadastradas">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Modalidade</th>
                    <th>Início</th>
                    <th>Fim</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingQuadras ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px' }}>
                        Carregando quadras...
                      </td>
                    </tr>
                  ) : quadras.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px' }}>
                        Nenhuma quadra cadastrada.
                      </td>
                    </tr>
                  ) : (
                    quadras.map(q => {
                      const isAtiva = q.status === 'Ativa';
                      return (
                        <tr key={q.id}>
                          <td>
                            <strong>{q.nome}</strong>
                            <br />
                            <small style={{ color: 'var(--muted)' }}>{formatCurrency(q.preco_base)}/h</small>
                          </td>
                          <td>{q.tipo}</td>
                          <td>{q.hora_abertura || '07:00'}</td>
                          <td>{q.hora_fechamento || '22:00'}</td>
                          <td>
                            <span className={`badge ${isAtiva ? 'badge--paid' : 'badge--pending'}`}>
                              {q.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button className="btn-ghost btn-sm" onClick={() => openEditarQuadraModal(q)}>
                                Editar
                              </button>
                              <button className="btn-ghost btn-sm" onClick={() => handleToggleStatusQuadra(q.id, q.status)}>
                                {isAtiva ? 'Desativar' : 'Ativar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* USUARIOS */}
          <div className={`config-section card ${relAtivo === 'usuarios' ? 'active' : ''}`}>
            <div className="card-header">
              <h2 className="card-title">Usuários do Sistema</h2>
              <button className="btn-primary" onClick={openNovoUsuarioModal}>+ Novo Usuário</button>
            </div>
            <div className="table-wrap">
              <table aria-label="Usuários do sistema">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Perfil</th>
                    <th>Último acesso</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsuarios ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px' }}>
                        Carregando usuários...
                      </td>
                    </tr>
                  ) : usuarios.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px' }}>
                        Nenhum usuário cadastrado.
                      </td>
                    </tr>
                  ) : (
                    usuarios.map(u => {
                      let badgeClass = 'badge--pending';
                      if (u.perfil === 'Administrador') badgeClass = 'badge--paid';
                      if (u.perfil === 'Gerente') badgeClass = 'badge--partial';

                      const dataCriacao = new Date(u.criado_em).toLocaleDateString('pt-BR');
                      return (
                        <tr key={u.id}>
                          <td><strong>{u.nome}</strong></td>
                          <td>{u.email}</td>
                          <td><span className={`badge ${badgeClass}`}>{u.perfil}</span></td>
                          <td>{dataCriacao}</td>
                          <td>Ativo</td>
                          <td>
                            <button className="btn-ghost btn-sm" onClick={() => openEditarUsuarioModal(u)}>
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* NOTIFICACOES */}
          <form className={`config-section card ${relAtivo === 'notificacoes' ? 'active' : ''}`} onSubmit={handleSaveArena}>
            <div className="card-header">
              <h2 className="card-title">Notificações</h2>
            </div>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-name">Confirmação de reserva por e-mail</div>
                <div className="setting-desc">Envia e-mail ao cliente quando uma reserva é criada</div>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox" 
                  checked={arena.notif_reserva_email === 1}
                  onChange={(e) => handleToggleNotification('notif_reserva_email', e.target.checked ? 1 : 0)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-name">Confirmação de reserva por WhatsApp</div>
                <div className="setting-desc">Envia link de WhatsApp ao cliente quando uma reserva é criada</div>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox" 
                  checked={arena.notif_reserva_whatsapp === 1}
                  onChange={(e) => handleToggleNotification('notif_reserva_whatsapp', e.target.checked ? 1 : 0)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-name">Cancelamento por e-mail</div>
                <div className="setting-desc">Notifica o cliente quando sua reserva é cancelada</div>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox" 
                  checked={arena.notif_cancelamento_email === 1}
                  onChange={(e) => handleToggleNotification('notif_cancelamento_email', e.target.checked ? 1 : 0)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-name">Comprovante de pagamento por e-mail</div>
                <div className="setting-desc">Envia comprovante PDF ao cliente após pagamento confirmado</div>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox" 
                  checked={arena.notif_pagamento_email === 1}
                  onChange={(e) => handleToggleNotification('notif_pagamento_email', e.target.checked ? 1 : 0)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-name">Alerta de pagamento pendente (minutos)</div>
                <div className="setting-desc">Alerta no dashboard quando uma reserva iniciada tem saldo devedor há X minutos</div>
              </div>
              <input 
                type="number" 
                min="5" 
                style={{ width: '72px', textAlign: 'center' }}
                value={arena.alerta_pagamento_minutos}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 5;
                  setArena({ ...arena, alerta_pagamento_minutos: val });
                }}
                aria-label="Minutos para alerta de pagamento pendente"
              />
            </div>
            <div style={{ marginTop: 'var(--s-4)', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary" id="btn-salvar-notificacoes">Salvar Notificações</button>
            </div>
          </form>

          {/* CANCELAMENTOS */}
          <div className={`config-section card ${relAtivo === 'cancelamentos' ? 'active' : ''}`}>
            <div className="card-header">
              <h2 className="card-title">Motivos de Cancelamento</h2>
              <button className="btn-ghost" onClick={() => setActiveModal('motivo')}>+ Adicionar</button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: 'var(--s-4)' }}>
              Estes motivos são exibidos ao cancelar uma reserva (RF-RES-015).
            </p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-2)' }}>
              {loadingMotivos ? (
                <li style={{ padding: '8px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                  Carregando motivos...
                </li>
              ) : motivos.length === 0 ? (
                <li style={{ padding: '8px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                  Nenhum motivo cadastrado.
                </li>
              ) : (
                motivos.map((m, index) => (
                  <li 
                    key={m.id}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '8px 0',
                      borderBottom: index !== motivos.length - 1 ? '1px solid var(--charcoal-03)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '13px' }}>{m.motivo}</span>
                    <button className="btn-ghost btn-sm" onClick={() => handleRemoveMotivo(m.id, m.motivo)}>
                      Remover
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* ARENA */}
          <form className={`config-section card ${relAtivo === 'arena' ? 'active' : ''}`} onSubmit={handleSaveArena}>
            <div className="card-header">
              <h2 className="card-title">Dados da Arena</h2>
            </div>
            <div className="form-group">
              <label htmlFor="arena-nome">Nome da Arena</label>
              <input 
                type="text" 
                id="arena-nome" 
                value={arena.nome}
                onChange={(e) => setArena({ ...arena, nome: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="arena-endereco">Endereço</label>
              <input 
                type="text" 
                id="arena-endereco" 
                value={arena.endereco}
                onChange={(e) => setArena({ ...arena, endereco: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="arena-telefone">Telefone</label>
              <input 
                type="tel" 
                id="arena-telefone" 
                value={arena.telefone}
                onChange={(e) => setArena({ ...arena, telefone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="arena-email">E-mail de contato</label>
              <input 
                type="email" 
                id="arena-email" 
                value={arena.email}
                onChange={(e) => setArena({ ...arena, email: e.target.value })}
              />
            </div>
            <div style={{ height: '1px', background: 'var(--border-passive)', margin: 'var(--s-4) 0' }}></div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 'var(--s-3)' }}>Aparência do Sistema</h3>
            <div className="form-group">
              <label htmlFor="arena-intervalo-grade">Intervalo da grade de horários (Reservas)</label>
              <select 
                id="arena-intervalo-grade" 
                style={{ maxWidth: '200px' }}
                value={localStorage.getItem('grade_interval') || '60'}
                onChange={(e) => {
                  localStorage.setItem('grade_interval', e.target.value);
                  showToast('Intervalo da grade salvo!', 'success');
                }}
              >
                <option value="60">60 em 60 minutos</option>
                <option value="30">30 em 30 minutos</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" id="btn-salvar-arena">Salvar</button>
          </form>

        </div>
      </div>

      {/* MODAL: NOVA QUADRA */}
      <div className={`modal-overlay ${activeModal === 'nova-quadra' ? 'open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-nq-title" onClick={() => setActiveModal(null)}>
        <form className="modal" onSubmit={handleSaveQuadra} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title" id="modal-nq-title">Nova Quadra</h2>
            <button type="button" className="modal-close" aria-label="Fechar" onClick={() => setActiveModal(null)}>✕</button>
          </div>
          <div className="form-group">
            <label htmlFor="nq-nome">Nome da quadra *</label>
            <input 
              type="text" 
              id="nq-nome" 
              placeholder="Ex: Quadra 5" 
              value={nqNome}
              onChange={(e) => setNqNome(e.target.value)}
              required 
            />
          </div>
          <div className="form-group">
            <label htmlFor="nq-modalidade">Modalidade *</label>
            <select 
              id="nq-modalidade" 
              value={nqModalidade}
              onChange={(e) => setNqModalidade(e.target.value)}
              required
            >
              <option value="">Selecione</option>
              <option>Beach Tennis</option>
              <option>Vôlei</option>
              <option>Futevôlei</option>
              <option>Padel</option>
              <option>Futsal</option>
              <option>Outro</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="nq-preco">Preço base por hora (R$) *</label>
            <input 
              type="text" 
              id="nq-preco" 
              placeholder="Ex: 150,00" 
              value={nqPreco}
              onChange={(e) => setNqPreco(formatCurrencyInput(e.target.value))}
              required 
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
            <div className="form-group">
              <label htmlFor="nq-inicio">Horário de abertura *</label>
              <input 
                type="time" 
                id="nq-inicio" 
                value={nqInicio}
                onChange={(e) => setNqInicio(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="nq-fim">Horário de fechamento *</label>
              <input 
                type="time" 
                id="nq-fim" 
                value={nqFim}
                onChange={(e) => setNqFim(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={() => setActiveModal(null)}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar Quadra</button>
          </div>
        </form>
      </div>

      {/* MODAL: EDITAR QUADRA */}
      <div className={`modal-overlay ${activeModal === 'editar-quadra' ? 'open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-eq-title" onClick={() => setActiveModal(null)}>
        <form className="modal" onSubmit={handleSaveQuadra} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title" id="modal-eq-title">Editar Quadra</h2>
            <button type="button" className="modal-close" aria-label="Fechar" onClick={() => setActiveModal(null)}>✕</button>
          </div>
          <div className="form-group">
            <label htmlFor="eq-nome">Nome da quadra *</label>
            <input 
              type="text" 
              id="eq-nome" 
              value={nqNome}
              onChange={(e) => setNqNome(e.target.value)}
              required 
            />
          </div>
          <div className="form-group">
            <label htmlFor="eq-modalidade">Modalidade *</label>
            <select 
              id="eq-modalidade" 
              value={nqModalidade}
              onChange={(e) => setNqModalidade(e.target.value)}
              required
            >
              <option value="">Selecione</option>
              <option>Beach Tennis</option>
              <option>Vôlei</option>
              <option>Futevôlei</option>
              <option>Padel</option>
              <option>Futsal</option>
              <option>Outro</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="eq-preco">Preço base por hora (R$) *</label>
            <input 
              type="number" 
              id="eq-preco" 
              step="0.01" 
              value={nqPreco}
              onChange={(e) => setNqPreco(e.target.value)}
              required 
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
            <div className="form-group">
              <label htmlFor="eq-inicio">Horário de abertura *</label>
              <input 
                type="time" 
                id="eq-inicio" 
                value={nqInicio}
                onChange={(e) => setNqInicio(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="eq-fim">Horário de fechamento *</label>
              <input 
                type="time" 
                id="eq-fim" 
                value={nqFim}
                onChange={(e) => setNqFim(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex' }}>
            <button 
              type="button" 
              className="btn-ghost" 
              style={{ color: 'var(--danger)', borderColor: 'var(--danger-bg)', marginRight: 'auto' }}
              onClick={() => nqId && handleDeleteQuadra(nqId, nqNome)}
            >
              Excluir
            </button>
            <button type="button" className="btn-ghost" onClick={() => setActiveModal(null)}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar Alterações</button>
          </div>
        </form>
      </div>

      {/* MODAL: CRIAR/EDITAR USUÁRIO */}
      <div className={`modal-overlay ${activeModal === 'usuario' ? 'open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-u-title" onClick={() => setActiveModal(null)}>
        <form className="modal" onSubmit={handleSaveUsuario} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title" id="modal-u-title">
              {nuId ? 'Editar Usuário' : 'Novo Usuário'}
            </h2>
            <button type="button" className="modal-close" aria-label="Fechar" onClick={() => setActiveModal(null)}>✕</button>
          </div>
          <div className="form-group">
            <label htmlFor="u-nome">Nome completo *</label>
            <input 
              type="text" 
              id="u-nome" 
              value={nuNome}
              onChange={(e) => setNuNome(e.target.value)}
              required 
            />
          </div>
          <div className="form-group">
            <label htmlFor="u-email">E-mail *</label>
            <input 
              type="email" 
              id="u-email" 
              value={nuEmail}
              onChange={(e) => setNuEmail(e.target.value)}
              required 
            />
          </div>
          <div className="form-group">
            <label htmlFor="u-perfil">Perfil de acesso *</label>
            <select 
              id="u-perfil" 
              value={nuPerfil}
              onChange={(e) => setNuPerfil(e.target.value)}
              required
            >
              <option value="">Selecione</option>
              <option value="Recepcionista">Recepcionista</option>
              <option value="Gerente">Gerente</option>
              <option value="Administrador">Administrador</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="u-senha">
              Senha {!nuId && <span style={{ color: 'var(--danger)' }}>*</span>}
            </label>
            <input 
              type="password" 
              id="u-senha" 
              placeholder="Digite a senha" 
              value={nuSenha}
              onChange={(e) => setNuSenha(e.target.value)}
              required={!nuId}
            />
            {nuId && (
              <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>
                Deixe em branco para manter a senha atual.
              </small>
            )}
          </div>
          <div className="modal-footer" style={{ display: 'flex' }}>
            {nuId && (
              <button 
                type="button" 
                className="btn-ghost" 
                style={{ color: 'var(--danger)', borderColor: 'var(--danger-bg)', marginRight: 'auto' }}
                onClick={() => handleDeleteUsuario(nuId, nuNome)}
              >
                Excluir
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={() => setActiveModal(null)}>Cancelar</button>
            <button type="submit" className="btn-primary">Salvar Usuário</button>
          </div>
        </form>
      </div>

      {/* MODAL: NOVO MOTIVO DE CANCELAMENTO */}
      <div className={`modal-overlay ${activeModal === 'motivo' ? 'open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-motivo-title" onClick={() => setActiveModal(null)}>
        <form className="modal" onSubmit={handleAddMotivo} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title" id="modal-motivo-title">Adicionar Motivo de Cancelamento</h2>
            <button type="button" className="modal-close" aria-label="Fechar" onClick={() => setActiveModal(null)}>✕</button>
          </div>
          <div className="form-group">
            <label htmlFor="nm-nome">Motivo *</label>
            <input 
              type="text" 
              id="nm-nome" 
              placeholder="Ex: Chuva forte" 
              value={nmNome}
              onChange={(e) => setNmNome(e.target.value)}
              required 
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={() => setActiveModal(null)}>Cancelar</button>
            <button type="submit" className="btn-primary">Adicionar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
