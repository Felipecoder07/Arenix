import { apiFetch as fetch } from '../../utils/apiFetch';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Reserva {
  id: number;
  hora_inicio: string;
  hora_fim: string;
  cliente_nome: string;
  quadra_nome: string;
  status_pagamento: string;
  data_reserva: string;
}

interface Alerta {
  cliente_nome: string;
  quadra_nome: string;
  hora_inicio: string;
}

interface Inadimplente {
  nome: string;
  deve: number;
}

interface QuadrasStatus {
  nome: string;
  cliente?: string;
  estado: string;
}

interface DashboardData {
  hoje: string;
  faturamentoDia: number;
  faturamentoPendente: number;
  reservasPendentesDia: number;
  reservasDia: number;
  taxaOcupacao: number;
  proximasReservas: Reserva[];
  alertas: Alerta[];
  faturamentoMes: number;
  inadimplentes: Inadimplente[];
  quadrasStatus: QuadrasStatus[];
}

interface GradeData {
  quadras: Array<{
    id: number;
    nome: string;
    tipo: string;
    hora_abertura: string;
    hora_fechamento: string;
  }>;
  reservas: Array<{
    quadra_id: number;
    hora_inicio: string;
    hora_fim: string;
    cliente_nome: string;
    status_pagamento: string;
  }>;
  bloqueios: Array<{
    quadra_id: number;
    hora_inicio: string;
    hora_fim: string;
    motivo?: string;
  }>;
}

interface DashboardMiniSlotProps {
  quadra: GradeData['quadras'][number];
  horaStr: string;
  isPastHour: boolean;
  reservas: GradeData['reservas'];
  bloqueios: GradeData['bloqueios'];
}

function DashboardMiniSlot({
  quadra: q,
  horaStr,
  isPastHour,
  reservas,
  bloqueios,
}: Readonly<DashboardMiniSlotProps>) {
  if (horaStr < q.hora_abertura || horaStr >= q.hora_fechamento) {
    return <div key={q.id} className="h-[34px] bg-transparent" />;
  }

  const r = (reservas || []).find(
    (res) => res.quadra_id === q.id && res.hora_inicio <= horaStr && res.hora_fim > horaStr
  );
  const b = (bloqueios || []).find(
    (bl) => bl.quadra_id === q.id && bl.hora_inicio <= horaStr && bl.hora_fim > horaStr
  );

  if (b) {
    return (
      <div
        key={q.id}
        className={`h-[34px] flex items-center justify-center rounded-[6px] text-[11px] font-bold text-white shadow-sm ${
          isPastHour ? 'bg-[#152238]/60 text-white/70' : 'bg-[#152238]'
        }`}
        title={b.motivo || 'Bloqueado'}
      >
        ⊘
      </div>
    );
  }

  if (r) {
    let bgClass = 'bg-[#C8661A] text-white';
    if (r.status_pagamento === 'Pago') bgClass = 'bg-[#138A4B] text-white';
    if (r.status_pagamento === 'Parcial') bgClass = 'bg-[#2E5BFF] text-white';

    return (
      <div
        key={q.id}
        className={`h-[34px] px-1.5 flex items-center justify-center rounded-[6px] text-[11px] font-semibold truncate shadow-sm ${bgClass}`}
        title={`${r.cliente_nome} (${r.status_pagamento})`}
      >
        <span className="truncate">{r.cliente_nome || '—'}</span>
      </div>
    );
  }

  if (isPastHour) {
    return (
      <div
        key={q.id}
        className="h-[34px] bg-[#EFEAE2] outline outline-1 outline-[#D8D0C5] -outline-offset-1 rounded-[6px] opacity-60"
        title="Livre (Passado)"
      />
    );
  }

  return (
    <div
      key={q.id}
      className="h-[34px] bg-[#F4F0EA] outline outline-1 outline-[#BDB4A9] -outline-offset-1 rounded-[6px] hover:border-[#071915] transition-colors"
      title="Livre"
    />
  );
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [grade, setGrade] = useState<GradeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingGrade, setLoadingGrade] = useState(true);

  const formatCurrency = (val: number) => {
    return (
      'R$ ' +
      (val / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/dashboard/resumo', { headers: {} });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Erro ao carregar resumo do dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchGrade = async () => {
      try {
        const tzOffset = new Date().getTimezoneOffset() * 60000;
        const hoje = new Date(Date.now() - tzOffset).toISOString().split('T')[0];
        const res = await fetch(`/api/reservas/grade?data=${hoje}`, {
          headers: { 'Cache-Control': 'no-store' },
        });
        if (res.ok) {
          const json = await res.json();
          setGrade(json);
        }
      } catch (err) {
        console.error('Erro ao carregar grade do dia:', err);
      } finally {
        setLoadingGrade(false);
      }
    };

    fetchDashboard();
    fetchGrade();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-[#4F5550] text-sm">
        Carregando dados do painel...
      </div>
    );
  }

  // KPIs
  const faturamentoDia = data?.faturamentoDia ?? 0;
  const faturamentoPendente = data?.faturamentoPendente ?? 0;
  const reservasPendentesDia = data?.reservasPendentesDia ?? 0;
  const reservasDia = data?.reservasDia ?? 0;
  const taxaOcupacao = data?.taxaOcupacao ?? 0;
  const faturamentoMes = data?.faturamentoMes ?? 0;

  const isEndOfDay = new Date().getHours() >= 20;
  const totalInadimplente = data?.inadimplentes?.reduce((sum, item) => sum + item.deve, 0) ?? 0;

  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' });
  const year = new Date().getFullYear();
  const currentMonthFormatted = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;

  const renderMiniGrade = () => {
    if (loadingGrade) {
      return <div className="p-5 text-center text-[#4F5550] text-xs">Carregando grade do dia...</div>;
    }
    if (!grade || !grade.quadras || grade.quadras.length === 0) {
      return <div className="p-5 text-center text-[#4F5550] text-xs">Nenhuma quadra disponível.</div>;
    }

    const { quadras, reservas, bloqueios } = grade;

    let earliest = '23:59';
    let latest = '00:00';
    quadras.forEach((q) => {
      if (q.hora_abertura && q.hora_abertura < earliest) earliest = q.hora_abertura;
      if (q.hora_fechamento && q.hora_fechamento > latest) latest = q.hora_fechamento;
    });
    const minHour = earliest !== '23:59' ? Number.parseInt(earliest.split(':')[0], 10) : 8;
    let maxHour = latest !== '00:00' ? Number.parseInt(latest.split(':')[0], 10) : 22;

    if (latest.endsWith(':00')) maxHour--;

    const nowLocal = new Date();
    const tzOffsetLocal = nowLocal.getTimezoneOffset() * 60000;
    const nowISOLocal = new Date(Date.now() - tzOffsetLocal).toISOString();
    const currentHour = nowISOLocal.split('T')[1].substring(0, 5);

    const rows = [];
    for (let h = minHour; h <= maxHour; h++) {
      const horaStr = h.toString().padStart(2, '0') + ':00';
      const isPastHour = horaStr < currentHour;
      const rowSlots = quadras.map((q) => (
        <DashboardMiniSlot
          key={q.id}
          quadra={q}
          horaStr={horaStr}
          isPastHour={isPastHour}
          reservas={reservas}
          bloqueios={bloqueios}
        />
      ));

      rows.push(
        <div
          key={horaStr}
          className="w-full flex flex-row gap-[5px] items-center"
        >
          <div
            className="w-[52px] shrink-0 text-center text-[12px] text-[#4F5550] font-[Inter,system-ui,sans-serif]"
            style={isPastHour ? { opacity: 0.45 } : undefined}
          >
            {horaStr}
          </div>
          <div className="flex-1 grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${quadras.length}, 1fr)` }}>
            {rowSlots}
          </div>
        </div>
      );
    }

    return (
      <div className="w-full flex flex-col gap-[5px] min-w-[500px]">
        {/* Cabeçalho Quadras */}
        <div className="w-full flex flex-row gap-[5px] items-center pb-1">
          <div className="w-[52px] shrink-0" />
          <div className="flex-1 grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${quadras.length}, 1fr)` }}>
            {quadras.map((q) => (
              <div
                key={q.id}
                className="text-center text-[13px] font-[Inter,system-ui,sans-serif] text-[#071915] truncate"
              >
                {q.nome.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
        {rows}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-[16px]">
      {/* Cards Resumo Dashboard */}
      <section
        className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]"
        aria-label="Indicadores do dia"
      >
        {/* Card 1: FATURAMENTO DO DIA */}
        <div className="box-border flex flex-col gap-[8px] p-[20px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm">
          <div className="text-[13px] leading-tight text-[#4F5550] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.6px] whitespace-nowrap">
            FATURAMENTO DO DIA
          </div>
          <div className="text-[30px] leading-tight text-[#071915] font-[Inter,system-ui,sans-serif] font-normal whitespace-nowrap">
            {formatCurrency(faturamentoDia)}
          </div>
          <div className="text-[13px] leading-tight text-[#4F5550] font-[Inter,system-ui,sans-serif] font-normal whitespace-nowrap">
            hoje
          </div>
        </div>

        {/* Card 2: FATURAMENTO PENDENTE */}
        <div className="box-border min-w-0 flex flex-col gap-[8px] p-[20px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm">
          <div className="text-[13px] leading-tight text-[#4F5550] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.6px] whitespace-nowrap">
            FATURAMENTO PENDENTE
          </div>
          <div className="text-[30px] leading-tight text-[#071915] font-[Inter,system-ui,sans-serif] font-normal whitespace-nowrap">
            {formatCurrency(faturamentoPendente)}
          </div>
          <div className="max-w-full text-[13px] leading-snug text-[#4F5550] font-[Inter,system-ui,sans-serif] font-normal whitespace-normal break-words">
            {reservasPendentesDia} reserva(s) com saldo pendente hoje
          </div>
        </div>

        {/* Card 3: RESERVAS DO DIA */}
        <div className="box-border flex flex-col gap-[8px] p-[20px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm">
          <div className="text-[13px] leading-tight text-[#4F5550] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.6px] whitespace-nowrap">
            RESERVAS DO DIA
          </div>
          <div className="text-[30px] leading-tight text-[#071915] font-[Inter,system-ui,sans-serif] font-normal whitespace-nowrap">
            {reservasDia}
          </div>
          <div className="text-[13px] leading-tight text-[#4F5550] font-[Inter,system-ui,sans-serif] font-normal whitespace-nowrap">
            no dia de hoje
          </div>
        </div>

        {/* Card 4: TAXA DE OCUPAÇÃO */}
        <div className="box-border flex flex-col gap-[8px] p-[20px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm">
          <div className="text-[13px] leading-tight text-[#4F5550] font-[Inter,system-ui,sans-serif] font-normal tracking-[0.6px] whitespace-nowrap">
            TAXA DE OCUPAÇÃO
          </div>
          <div className="text-[30px] leading-tight text-[#071915] font-[Inter,system-ui,sans-serif] font-normal whitespace-nowrap">
            {taxaOcupacao}%
          </div>
          <div className="text-[13px] leading-tight text-[#4F5550] font-[Inter,system-ui,sans-serif] font-normal whitespace-nowrap">
            da capacidade hoje
          </div>
          <div className="w-full h-[4px] bg-[#E8E1D6] rounded-[4px] overflow-hidden mt-1">
            <div
              className="h-full rounded-[4px] transition-all duration-300"
              style={{
                width: `${Math.min(taxaOcupacao, 100)}%`,
                backgroundColor:
                  taxaOcupacao >= 80 ? '#138A4B' : taxaOcupacao >= 40 ? '#C8661A' : '#2E5BFF',
              }}
            />
          </div>
        </div>
      </section>

      {/* Miolo Dashboard */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[738px_1fr] gap-[18px] items-start">
        {/* Grade do Dia Hoje */}
        <div className="box-border w-full flex flex-col gap-[14px] p-[24px] justify-start items-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm">
          <div className="w-full flex justify-between items-center">
            <div className="text-[16px] text-[#071915] font-[Inter,system-ui,sans-serif] font-normal">
              Grade do Dia — Hoje
            </div>
            <Link
              to="/admin/reservas"
              className="h-[32px] px-[12px] flex items-center justify-center bg-[#F7F2EA] outline outline-1 outline-[#9F978E] -outline-offset-1 rounded-[8px] text-[13px] text-[#071915] hover:bg-[#EFEAE2] transition-colors"
            >
              Ver grade completa →
            </Link>
          </div>

          <div className="w-full h-[1px] bg-[#E6DED2]" />

          {/* Legenda Grade Simples */}
          <div className="w-full flex flex-wrap gap-[16px] justify-center items-center py-0.5">
            <div className="flex items-center gap-[6px]">
              <div className="w-[10px] h-[10px] bg-[#138A4B] rounded-full" />
              <span className="text-[13px] text-[#4F5550]">Pago</span>
            </div>
            <div className="flex items-center gap-[6px]">
              <div className="w-[10px] h-[10px] bg-[#C8661A] rounded-full" />
              <span className="text-[13px] text-[#4F5550]">Pendente</span>
            </div>
            <div className="flex items-center gap-[6px]">
              <div className="w-[10px] h-[10px] bg-[#2E5BFF] rounded-full" />
              <span className="text-[13px] text-[#4F5550]">Parcial</span>
            </div>
            <div className="flex items-center gap-[6px]">
              <div className="w-[10px] h-[10px] bg-[#F7F2EA] outline outline-1 outline-[#BBB2A6] -outline-offset-1 rounded-full" />
              <span className="text-[13px] text-[#4F5550]">Livre</span>
            </div>
            <div className="flex items-center gap-[6px]">
              <div className="w-[10px] h-[10px] bg-[#152238] rounded-full" />
              <span className="text-[13px] text-[#4F5550]">Bloqueado</span>
            </div>
          </div>

          <div className="w-full h-[1px] bg-[#E6DED2]" />

          {/* Mini Grade Horários */}
          <div className="w-full overflow-x-auto custom-scrollbar pt-1">
            {renderMiniGrade()}
          </div>
        </div>

        {/* Coluna Ações Dashboard */}
        <div className="flex flex-col gap-[16px] w-full">
          {/* Próximas Reservas */}
          <div className="box-border w-full min-h-[280px] p-[24px] bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] flex flex-col justify-between shadow-sm">
            <div>
              <div className="text-[16px] text-[#071915] font-[Inter,system-ui,sans-serif] font-normal mb-3">
                Próximas Reservas
              </div>

              {!data?.proximasReservas || data.proximasReservas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="text-[28px] mb-2">{isEndOfDay ? '🌙' : '☀️'}</div>
                  <div className="text-[15px] text-[#071915] font-medium">
                    {isEndOfDay ? 'Dia encerrado por aqui!' : 'Nenhuma reserva futura hoje'}
                  </div>
                  <div className="text-[13px] text-[#4F5550] mt-1">
                    {isEndOfDay ? 'Bom descanso. Amanhã tem mais!' : 'Que tal criar uma nova reserva?'}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                  {data.proximasReservas.map((r) => {
                    let badgeBg = 'bg-[#C8661A] text-white';
                    if (r.status_pagamento === 'Pago') badgeBg = 'bg-[#138A4B] text-white';
                    if (r.status_pagamento === 'Parcial') badgeBg = 'bg-[#2E5BFF] text-white';

                    return (
                      <div
                        key={r.id}
                        className="p-2.5 rounded-lg bg-[#F7F2EA]/70 border border-[#E6DED2] flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-mono font-bold text-[#071915]">{r.hora_inicio}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#071915] truncate">{r.cliente_nome}</p>
                          <p className="text-[11px] text-[#4F5550] truncate">{r.quadra_nome}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeBg}`}>
                          {r.status_pagamento}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Link
              to="/admin/reservas"
              className="w-full h-[38px] flex items-center justify-center bg-[#171512] hover:bg-[#2A2621] text-[#FFFFFF] text-[14px] rounded-[7px] font-normal transition-colors mt-3"
            >
              + Nova Reserva
            </Link>
          </div>

          {/* Atenção Sem Alertas */}
          <div className="box-border w-full p-[24px] bg-[#FFF9ED] outline outline-1 outline-[#FFB545] -outline-offset-1 rounded-[14px] flex flex-col gap-[12px] shadow-sm">
            <div className="text-[15px] text-[#071915] font-medium flex items-center gap-1.5">
              <span>⚠</span> Atenção
            </div>
            {!data?.alertas || data.alertas.length === 0 ? (
              <div className="text-[14px] text-[#4F5550]">
                Nenhum alerta pendente.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
                {data.alertas.map((a, i) => (
                  <div key={i} className="text-[13px] text-[#4F5550] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C8661A] shrink-0" />
                    <span>
                      {a.cliente_nome} · {a.quadra_nome} · {a.hora_inicio} — pagamento pendente
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Cards Rodapé Dashboard */}
      <section className="w-full grid grid-cols-1 md:grid-cols-3 gap-[16px] items-stretch">
        {/* Faturamento do Mês */}
        <div className="box-border flex flex-col gap-[8px] p-[16px] justify-between bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm">
          <div>
            <div className="w-full flex justify-between items-center mb-1">
              <div className="text-[16px] text-[#071915] font-[Inter,system-ui,sans-serif] font-normal">
                Faturamento do Mês
              </div>
              <div className="h-[28px] px-[12px] flex items-center justify-center bg-[#EFEAE2] rounded-[14px] text-[12px] text-[#6F766F] capitalize">
                {currentMonthFormatted}
              </div>
            </div>
            <div className="text-[31px] text-[#071915] font-[Inter,system-ui,sans-serif] font-normal leading-tight">
              {formatCurrency(faturamentoMes)}
            </div>
            <div className="text-[13px] text-[#4F5550] mt-1">
              No mês vigente
            </div>
          </div>
          <div className="text-[13px] leading-[18px] text-[#4F5550] pt-2">
            Quebra por método de pagamento em desenvolvimento.
          </div>
        </div>

        {/* Inadimplência */}
        <div className="box-border flex flex-col gap-[8px] p-[16px] justify-between bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm">
          <div>
            <div className="w-full flex justify-between items-center mb-1">
              <div className="text-[16px] text-[#071915] font-[Inter,system-ui,sans-serif] font-normal">
                Inadimplência
              </div>
              <Link
                to="/admin/relatorios"
                className="h-[32px] px-[12px] flex items-center justify-center bg-[#F7F2EA] outline outline-1 outline-[#9F978E] -outline-offset-1 rounded-[8px] text-[13px] text-[#071915] hover:bg-[#EFEAE2] transition-colors"
              >
                Ver relatório →
              </Link>
            </div>
            <div className="text-[31px] text-[#B32323] font-[Inter,system-ui,sans-serif] font-normal leading-tight">
              {formatCurrency(totalInadimplente)}
            </div>
            <div className="text-[13px] text-[#4F5550] mt-1">
              {data?.inadimplentes?.length || 0} reservas em aberto
            </div>
          </div>
          <div className="pt-2">
            {!data?.inadimplentes || data.inadimplentes.length === 0 ? (
              <div className="text-[14px] text-[#4F5550]">
                Sem inadimplentes.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[90px] overflow-y-auto custom-scrollbar">
                {data.inadimplentes.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-[#4F5550]">
                    <span className="truncate">{item.nome}</span>
                    <span className="font-semibold text-[#B32323]">{formatCurrency(item.deve)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status das Quadras Simples */}
        <div className="box-border flex flex-col gap-[10px] p-[16px] justify-start bg-[#FFFFFF] outline outline-1 outline-[#E6DED2] -outline-offset-1 rounded-[16px] shadow-sm">
          <div className="text-[16px] text-[#071915] font-[Inter,system-ui,sans-serif] font-normal">
            Status das Quadras
          </div>
          <div className="flex flex-col gap-[8px] w-full mt-1">
            {!data?.quadrasStatus || data.quadrasStatus.length === 0 ? (
              <div className="text-[13px] text-[#4F5550]">Nenhuma quadra cadastrada.</div>
            ) : (
              data.quadrasStatus.map((q, idx) => (
                <div key={idx} className="w-full flex justify-between items-center py-0.5">
                  <div className="text-[14px] text-[#071915]">
                    {q.nome}
                    {q.cliente && (
                      <span className="text-[11px] text-[#4F5550] block">{q.cliente}</span>
                    )}
                  </div>
                  <div
                    className={`h-[28px] px-[12px] flex items-center justify-center rounded-[14px] text-[12px] ${
                      q.estado === 'Em uso'
                        ? 'bg-[#ECFFF4] text-[#007A50] font-semibold'
                        : 'bg-[#EFEAE2] text-[#4F5550]'
                    }`}
                  >
                    {q.estado}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
