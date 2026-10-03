const fs = require('fs');
const path = 'frontend/src/screens/admin/AdminRelatorios.tsx';
let s = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
for (const name of ['Faturamento', 'Ocupacao', 'Reservas', 'Inadimplencia']) {
  const start = s.indexOf(`  const render${name} = () => {`);
  const end = s.indexOf('\n  const ', start + 10);
  let block = s.slice(start, end);
  const kpi = block.indexOf('        <div className="rel-kpi-row">');
  if (kpi >= 0) {
    const table = block.indexOf('        <div className="table-card">', kpi);
    block = block.slice(0, kpi) + block.slice(table);
  }
  block = block.replace('      <>', '      <>\n        <ReportOverview tab={relAtivo} data={dadosAtuais} />');
  s = s.slice(0, start) + block + s.slice(end);
}
s = s.replaceAll('{fmtData(dataInicio)} a {fmtData(dataFim)}', '{fmtData(applied.inicio)} a {fmtData(applied.fim)}');
const exportStart = s.indexOf('  const exportarCSV = () => {');
const exportEnd = s.indexOf('\n  // Helper Formats', exportStart);
let block = s.slice(exportStart, exportEnd);
block = block.replace('const exportarCSV = () => {', 'const exportarCSV = async () => {');
block = block.replace('    const rows: string[][] = [];', `    setExporting(true);
    try {
    let exportData = dadosAtuais;
    if (dadosAtuais.paginacao && dadosAtuais.paginacao.totalPaginas > 1) {
      const key = relAtivo === 'inadimplencia' ? 'inadimplentes' : relAtivo === 'cancelamentos' ? 'cancelamentos' : 'reservas';
      const all: NonNullable<ReportData['reservas']> = [];
      let page = 1;
      let pages = 1;
      do {
        const params = new URLSearchParams({ data_inicio: applied.inicio, data_fim: applied.fim, pagina: String(page), limite: '100' });
        if (applied.quadra) params.set('quadra_id', applied.quadra);
        const response = await fetch('/api/relatorios/' + applied.tab + '?' + params);
        const result: ReportData & { error?: string } = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível exportar o relatório.');
        all.push(...(result[key] || []));
        pages = result.paginacao?.totalPaginas || 1;
        page++;
      } while (page <= pages);
      exportData = { ...dadosAtuais, [key]: all };
    }
    const rows: string[][] = [];`);
for (const key of ['reservas', 'quadras', 'inadimplentes', 'cancelamentos']) block = block.replaceAll(`dadosAtuais.${key}?.forEach`, `exportData.${key}?.forEach`);
block = block.replace('${dataInicio}_${dataFim}', '${applied.inicio}_${applied.fim}');
block = block.replace('val.replace(/"/g, \'""\')', 'String(val ?? "").replace(/^[=+@-]/, "\\\'$&").replace(/"/g, \'""\')');
block = block.replace('    URL.revokeObjectURL(url);', `    URL.revokeObjectURL(url);
    showToast('Relatório exportado.', 'success');
    } catch (error) {
      showToast(errorMessage(error) || 'Não foi possível exportar o relatório.', 'error');
    } finally {
      setExporting(false);
    }`);
s = s.slice(0, exportStart) + block + s.slice(exportEnd);
const start = s.indexOf('  return (\n    <div className="admin-relatorios-page">');
if (start < 0) throw new Error('Main render missing');
s = s.slice(0, start) + `  const selectTab = (tab: string) => {
    setRelAtivo(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('aba', tab);
    window.history.replaceState({}, '', url);
  };

  return (
    <div className="admin-relatorios-page">
      <AdminTopbar
        onToggleSidebar={() => outlet?.onToggleSidebar()}
        customTitle={<div className="report-heading"><p>Análises / {REPORT_TABS.find(tab => tab.id === relAtivo)?.label}</p><h1>Relatórios</h1></div>}
        actions={showExportBtn && <button className="report-export" onClick={exportarCSV} disabled={loading || exporting || !dadosAtuais} title="Exportar todos os registros do relatório em CSV"><Download size={15} />{exporting ? 'Exportando...' : 'Exportar relatório'}</button>}
      />

      {toast && <div role="status" className={\`report-toast \${toast.type}\`}>{toast.message}</div>}

      <div className="report-tabs" role="tablist" aria-label="Tipos de relatório">
        {REPORT_TABS.map(({ id, label, icon: Icon }, index) => <button
          key={id} type="button" id={\`report-tab-\${id}\`} role="tab"
          aria-selected={relAtivo === id} aria-controls="report-content"
          tabIndex={relAtivo === id ? 0 : -1}
          className={relAtivo === id ? 'active' : ''}
          onClick={() => selectTab(id)}
          onKeyDown={event => {
            const target = event.key === 'ArrowRight' ? (index + 1) % REPORT_TABS.length
              : event.key === 'ArrowLeft' ? (index + REPORT_TABS.length - 1) % REPORT_TABS.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? REPORT_TABS.length - 1 : -1;
            if (target < 0) return;
            event.preventDefault();
            selectTab(REPORT_TABS[target].id);
            document.getElementById('report-tab-' + REPORT_TABS[target].id)?.focus();
          }}
        ><Icon size={15} aria-hidden="true" />{label}</button>)}
      </div>

      <form className="report-filters" onSubmit={event => { event.preventDefault(); setCurrentPage(1); gerarRelatorio(relAtivo, 1); }}>
        <label htmlFor="rel-inicio">De<input required type="date" id="rel-inicio" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></label>
        <label htmlFor="rel-fim">Até<input required type="date" id="rel-fim" value={dataFim} min={dataInicio} onChange={e => setDataFim(e.target.value)} /></label>
        <label htmlFor="rel-quadra">Quadra<select id="rel-quadra" value={filterQuadraId} onChange={e => setFilterQuadraId(e.target.value)}>
          <option value="">Todas as quadras</option>
          {quadras.map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}
        </select></label>
        <button type="submit" className="report-generate" disabled={loading}><SlidersHorizontal size={15} />{loading ? 'Gerando...' : 'Gerar Relatório'}</button>
      </form>

      <section id="report-content" role="tabpanel" aria-labelledby={\`report-tab-\${relAtivo}\`} aria-busy={loading}>
        {renderContent()}
      </section>
      {!loading && dadosAtuais?.paginacao && (
        <Pagination page={dadosAtuais.paginacao.pagina} totalPages={dadosAtuais.paginacao.totalPaginas} onPage={changePage} />
      )}
    </div>
  );
}
`;
fs.writeFileSync(path, s);
