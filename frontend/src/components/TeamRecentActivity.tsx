import { useCallback, useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';

interface Activity {
  id: number;
  evento: string;
  usuario_nome: string;
  criado_em: string;
}

function activityDate(value: string) {
  // SQLite CURRENT_TIMESTAMP is UTC, even when it contains no zone suffix.
  const iso = value.replace(' ', 'T');
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function TeamRecentActivity({ refreshKey }: { refreshKey?: unknown }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const reload = useCallback(() => setRetry(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    apiFetch('/api/usuarios/atividades', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Atividade indisponível');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Resposta inválida');
      if (!controller.signal.aborted) setActivities(data);
    }).catch(() => {
      if (!controller.signal.aborted) { setActivities([]); setError(true); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refreshKey, retry]);

  if (loading) return <p role="status" className="text-xs text-[#6F766F]">Carregando atividade recente...</p>;
  if (error) return <div role="alert" className="text-xs text-[#6F766F]">Não foi possível carregar a atividade recente. <button type="button" onClick={reload} className="underline">Tentar novamente</button></div>;
  if (!activities.length) return <p className="text-xs text-[#6F766F]">Nenhuma atividade registrada para a equipe.</p>;
  return <div className="flex w-full flex-col gap-2">
    {activities.map(activity => <div key={activity.id} className="flex w-full min-h-[36px] items-center gap-[10px] rounded-[9px] bg-[#FAF8F4] px-[10px] py-1">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-[#E5F2BF]"><Clock size={14} className="text-[#637A20]" /></div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span title={`${activity.usuario_nome} · ${activity.evento}`} className="truncate text-[11px] font-bold text-[#394236]">{activity.usuario_nome} · {activity.evento}</span>
        <time dateTime={activity.criado_em} className="shrink-0 text-[10px] text-[#6F766F]">{activityDate(activity.criado_em)}</time>
      </div>
    </div>)}
  </div>;
}
