import type { Court } from '../types';
import { brl } from '../lib/format';

interface Props {
  courts: Court[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function CourtSelector({ courts, selectedId, onSelect }: Props) {
  return (
    <section className="px-4 pt-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-bold text-charcoal">Escolha a quadra</h2>
        <span className="text-xs text-muted">{courts.length} disponíveis</span>
      </div>
      <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-2.5 pb-1 w-max">
          {courts.map((c) => {
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`tap flex flex-col items-start gap-1 rounded-2xl px-4 py-3 min-w-[150px] border transition-all active:scale-[0.98] ${
                  active
                    ? 'bg-charcoal text-white border-charcoal shadow-soft'
                    : 'bg-card text-charcoal border-edge'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{c.name}</span>
                </div>
                {c.surface && (
                  <span className={`text-xs ${active ? 'text-white/70' : 'text-muted'}`}>{c.surface}</span>
                )}
                <span
                  className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    active ? 'bg-white/15 text-white' : 'bg-available-bg text-available-text'
                  }`}
                >
                  {brl(c.pricePerHour)}/h
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
