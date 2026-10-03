const fs = require('fs');
const root = 'frontend/src/screens/';
function edit(file, callback) {
  let s = fs.readFileSync(root + file, 'utf8').replace(/\r\n/g, '\n');
  const replace = (from, to) => { if (!s.includes(from)) throw new Error(file + ': missing ' + from.slice(0, 90)); s = s.replace(from, to); };
  callback(replace, () => s);
  fs.writeFileSync(root + file, s);
}
edit('MasterArenas.tsx', (r, get) => {
  r('const PAGE_SIZE = 8;', 'const PAGE_SIZE = 7;');
  r('EmptyState, Pagination', 'EmptyState');
  r("import { formatDate, formatBRL }", "import { MasterPagination } from '../components/MasterPagination';\nimport { formatDate, formatBRL }");
  r('Pencil, Ban', 'Search, Bell, RotateCcw, Ban');
  r("  const [planFilter, setPlanFilter]", "  const [trialFilter, setTrialFilter] = useState('all');\n  const [planFilter, setPlanFilter]");
  r("      if (planFilter !== 'all'", "      if (trialFilter !== 'all' && Boolean(a.em_trial) !== (trialFilter === 'trial')) return false;\n      if (planFilter !== 'all'");
  r('[arenas, search, statusFilter, planFilter, dateFrom, dateTo]', '[arenas, search, statusFilter, trialFilter, planFilter, dateFrom, dateTo]');
  r('    <div>\n      <PageHeader', '    <div className="master-reference-page master-arenas-page">\n      <PageHeader');
  r('description="Todas as arenas (tenants) cadastradas na plataforma."', 'description="Gerencie cada operação da rede em um só lugar" context={false}');
  r('<Button variant="primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> Cadastrar nova arena</Button>', '<><button className="master-header-icon" aria-label="Abrir comunicação" onClick={() => onNavigate(\'comunicacao\')}><Bell size={16} /></button><span className="master-context"><i /> Gestão de arenas</span><Button variant="primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> Cadastrar arena</Button></>');
  const a = get().indexOf('      {/* Filter bar */}'), b = get().indexOf('      {/* Table */}');
  r(get().slice(a, b), `      <section className="master-arena-search">
        <div className="master-search-row"><label className="master-search-box"><Search size={18} /><span><input aria-label="Buscar arena por nome ou e-mail" placeholder="Buscar por nome ou e-mail" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /><small>A busca não considera cidade</small></span></label><Button variant="primary" onClick={() => setShowFilters(s => !s)} aria-expanded={showFilters}><Filter size={14} /> Filtros</Button></div>
        <div className="master-arena-filter-row">
          <Select aria-label="Status da arena" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}><option value="all">Todos os status</option><option value="ativa">Ativa</option><option value="bloqueada">Bloqueada</option></Select>
          <Select aria-label="Período de teste" value={trialFilter} onChange={e => { setTrialFilter(e.target.value); setPage(1); }}><option value="all">Período de teste</option><option value="trial">Em teste</option><option value="regular">Fora do teste</option></Select>
          <Select aria-label="Plano da arena" value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }}><option value="all">Todos os planos</option>{planosSaaS.map(p => <option key={p.id} value={String(p.id)}>{p.nome}</option>)}</Select>
          <button className="master-date-filter" onClick={() => setShowFilters(s => !s)} aria-expanded={showFilters}>Data de cadastro <ChevronDown size={12} /></button>
          <button className="master-clear-filter" onClick={() => { setSearch(''); setStatusFilter('all'); setTrialFilter('all'); setPlanFilter('all'); setDateFrom(''); setDateTo(''); setPage(1); }}><RotateCcw size={13} /> Limpar</button>
        </div>
        {showFilters && <div className="master-date-range"><Field label="Criada de"><Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} /></Field><Field label="Criada até"><Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} /></Field></div>}
      </section>

`);
  r('<Card className="overflow-hidden">', '<Card className="master-data-panel master-arena-table overflow-hidden">');
  r('<div className="master-table-heading">Arenas cadastradas <span>{filtered.length} arenas</span></div>', '<div className="master-table-heading"><strong>Todas as arenas <em>{filtered.length}</em></strong><span>Mostrando {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}</span></div>');
  r('>Cidade</th>', '>Responsável</th>');r('>Criada em</th>', '>Datas</th>');r('>Financeiro</th>', '>Saúde</th>');
  r('                  <th className="px-4 py-3 font-medium">Gateway MP</th>\n', '');
  r('<div className="text-xs text-muted">{a.email}</div>', '<div className="text-xs text-muted">{a.endereco || \'Endereço não informado\'}</div>');
  r('<td className="px-4 py-3 text-muted" style={{maxWidth: \'120px\', whiteSpace: \'nowrap\', overflow: \'hidden\', textOverflow: \'ellipsis\'}}>{a.endereco || \'Não informado\'}</td>', '<td className="px-4 py-3 text-muted"><span>{a.email}</span></td>');
  r('<td className="px-4 py-3 text-muted tabular">{formatDate(a.criado_em || new Date().toISOString())}</td>', '<td className="px-4 py-3 text-muted tabular"><div>Cadastro · {formatDate(a.criado_em)}</div><small>Vencimento · dia {a.dia_vencimento || \'—\'}</small></td>');
  const gateway = get().indexOf('                    <td className="px-4 py-3">\n                      {a.gateway_conectado');
  const gatewayEnd = get().indexOf('                    </td>', gateway) + '                    </td>\n'.length;
  r(get().slice(gateway, gatewayEnd), '');
  r('<td className="px-4 py-3"><Badge status={fin}>{financeLabel[fin]}</Badge></td>', '<td className="px-4 py-3"><span className={`master-health ${fin === \'atrasado\' ? \'is-overdue\' : \'\'}`} title={a.gateway_conectado ? \'Mercado Pago conectado\' : \'Mercado Pago pendente\'}><i />{financeLabel[fin]}</span></td>');
  r('className="flex items-center justify-end gap-0.5"', 'className="master-row-actions"');
  r('                        <button title="Editar" className="p-1.5 rounded-md text-muted hover:text-charcoal hover:bg-cream-surface transition-colors"><Pencil size={15} /></button>\n', '');
  r('<div className="p-3 border-t border-border-passive">\n          <Pagination page={page} totalPages={totalPages} onPage={setPage} />\n        </div>', '<MasterPagination page={page} totalPages={totalPages} onPage={setPage} label="7 arenas por página" />');
});
edit('MasterUsuarios.tsx', (r, get) => {
  r('KeyRound, Power, History', 'KeyRound, Power, History, Download, Users');r('EmptyState, Pagination', 'EmptyState, Button');
  r("import { formatDateTime }", "import { MasterPagination } from '../components/MasterPagination';\nimport { exportMasterCsv } from '../utils/masterExport';\nimport { formatDateTime }");
  r('const PAGE_SIZE = 10;', 'const PAGE_SIZE = 6;');
  r('    <div>\n      <PageHeader title="Usuários" description="Todos os usuários de todas as arenas da plataforma." />', `    <div className="master-reference-page master-users-page">
      <PageHeader title="Usuários" description="Acessos e permissões de todas as arenas da plataforma" context={false} actions={<Button variant="ghost" onClick={() => exportMasterCsv('usuarios.csv', [['Nome', 'E-mail', 'Arena', 'Perfil', 'Status'], ...filtered.map(u => [u.name, u.email, u.arenaName, u.roleOriginal, u.status])])}><Download size={14} /> Exportar lista</Button>} />`);
  const start = get().indexOf('      <section className="master-user-summary"'), end = get().indexOf('      <Card className="master-soft', start);
  r(get().slice(start,end), `      <section className="master-access-summary" aria-label="Resumo de usuários">
        <div className="master-access-total"><small><i /> REDE DE ACESSOS</small><strong>{users.length.toLocaleString('pt-BR')}</strong><span>usuários em {arenas.length} arenas</span></div>
        {[
          { label: 'ATIVOS', value: users.filter(u => u.status === 'ativo').length, note: (users.length ? (users.filter(u => u.status === 'ativo').length / users.length * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : 0) + '% da base' },
          { label: 'INATIVOS', value: users.filter(u => u.status !== 'ativo').length, note: (users.length ? (users.filter(u => u.status !== 'ativo').length / users.length * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : 0) + '% da base' },
          { label: 'GESTORES', value: users.filter(u => ['SuperAdmin', 'Administrador', 'Gerente'].includes(u.roleOriginal)).length, note: 'com acesso admin' },
          { label: 'ACESSOS HOJE', value: '—', note: 'Consulte os acessos na lista' },
        ].map(item => <div className="master-access-metric" key={item.label}><small>{item.label}</small><strong>{item.value.toLocaleString('pt-BR')}</strong><span>{item.note}</span></div>)}
      </section>
`);
  r('className="master-soft p-3 mb-4"', 'className="master-user-filters master-soft p-3"');
  r('sm:w-[220px]', 'sm:w-[170px]');r('sm:w-[160px]', 'sm:w-[150px]');
  r('<Card className="overflow-hidden">', '<Card className="master-data-panel master-users-table overflow-hidden">');
  r('<div className="master-table-heading">Usuários cadastrados <span>{filtered.length} usuários</span></div>', '<div className="master-table-heading"><strong><Users size={16} /> Todos os usuários <em>{filtered.length}</em></strong><span>Mostrando {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}</span></div>');
  r('>Nome</th>', '>Usuário</th>');r('                <th className="px-5 py-3 font-medium">E-mail</th>\n', '');
  r('                <th className="px-5 py-3 font-medium text-right">Ações</th>', '                <th className="px-5 py-3 font-medium">Último acesso</th>\n                <th className="px-5 py-3 font-medium text-right">Ações</th>');
  r('<td className="px-5 py-3 font-medium text-charcoal">{u.name}</td>\n                    <td className="px-5 py-3 text-muted">{u.email}</td>', '<td className="px-5 py-3"><div className="master-user-identity"><span className={`master-user-initials ${u.status !== \'ativo\' ? \'is-inactive\' : \'\'}`}>{u.name.split(\' \').map(part => part[0]).slice(0, 2).join(\'\')}</span><div><strong>{u.name}</strong><small>{u.email}</small></div></div></td>');
  r('{u.status}</Badge>', "{u.status === 'ativo' ? '● Ativo' : '● Inativo'}</Badge>");
  r('                    <td className="px-5 py-3">\n                      <div className="flex items-center justify-end gap-0.5">', '                    <td className="px-5 py-3"><button className="master-access-link" onClick={() => handleOpenAccess(u)}>Consultar acessos</button></td>\n                    <td className="px-5 py-3">\n                      <div className="master-row-actions">');
  r('<div className="p-3 border-t border-border-passive">\n          <Pagination page={page} totalPages={totalPages} onPage={setPage} />\n        </div>', '<MasterPagination page={page} totalPages={totalPages} onPage={setPage} label="6 usuários por página" />');
});
