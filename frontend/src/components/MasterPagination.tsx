import { ChevronLeft, ChevronRight } from 'lucide-react';

export function MasterPagination({ page, totalPages, onPage, label }: Readonly<{ page: number; totalPages: number; onPage: (page: number) => void; label: string }>) {
  const last = Math.max(1, totalPages);
  const pages = [...new Set([1, ...[page - 1, page, page + 1].filter(p => p > 1 && p < last), last])].sort((a, b) => a - b);
  return <div className="master-pagination"><span>{label}</span><nav aria-label="Paginação">
    <button aria-label="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={13} /></button>
    {pages.map((p, index) => <span key={p}>{index > 0 && p - pages[index - 1] > 1 && <span className="master-pagination-gap">…</span>}<button aria-label={`Página ${p}`} aria-current={page === p ? 'page' : undefined} onClick={() => onPage(p)}>{p}</button></span>)}
    <button aria-label="Próxima página" disabled={page >= last} onClick={() => onPage(page + 1)}><ChevronRight size={13} /></button>
  </nav></div>;
}
