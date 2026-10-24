interface CourtTimeSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));

export function CourtTimeSelect({ id, label, value, onChange }: CourtTimeSelectProps) {
  const [hour] = value.split(':');
  const hourOptions = hour === '24' ? [...hours, '24'] : hours;
  const selectClass = 'min-w-0 flex-1 h-[44px] px-3 bg-[#FBFAF7] border border-[#DED6CA] rounded-[10px] text-[14px] font-semibold text-[#071915] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#071915]/30';

  return (
    <fieldset className="min-w-0 flex-1">
      <legend className="mb-[7px] text-[12px] font-bold text-[#071915]">{label} *</legend>
      <div className="flex items-center gap-2">
        <label htmlFor={`${id}-hora`} className="sr-only">{label}: hora</label>
        <select id={`${id}-hora`} value={hour} onChange={event => onChange(`${event.target.value}:00`)} required className={selectClass}>
          {hourOptions.map(option => <option key={option} value={option}>{option} h</option>)}
        </select>
      </div>
    </fieldset>
  );
}
