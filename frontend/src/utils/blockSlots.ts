export const timeMinutes = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};
export const minutesTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function blockSlots(open: string, close: string, occupied: { hora_inicio: string; hora_fim: string }[], elapsed = -1) {
  const first = timeMinutes(open), last = timeMinutes(close);
  const boundaries = new Set<number>([first, last]);
  for (let minute = Math.ceil(first / 60) * 60; minute < last; minute += 60) boundaries.add(minute);
  occupied.forEach(item => {
    boundaries.add(timeMinutes(item.hora_inicio));
    boundaries.add(timeMinutes(item.hora_fim));
  });
  const points = [...boundaries].filter(m => m >= first && m <= last).sort((a, b) => a - b);
  const free = (start: number, end: number) => !occupied.some(item => timeMinutes(item.hora_inicio) < end && timeMinutes(item.hora_fim) > start);
  const starts = points.filter((m, i) => i < points.length - 1 && points[i + 1] > elapsed && free(m, points[i + 1])).map(minutesTime);
  const ends = (start: string) => {
    if (!starts.includes(start)) return [];
    const from = timeMinutes(start);
    return points.filter(m => m > from && m > elapsed && free(from, m)).map(minutesTime);
  };
  return { starts, ends };
}
