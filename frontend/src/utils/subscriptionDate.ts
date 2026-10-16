export function subscriptionDate(value?: string | null) {
  if (!value) return null;
  const day = value.trim().split(/[T ]/)[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parsed = new Date(`${day}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return null;
  const [year, month, date] = day.split('-');
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  return { dia: date, mes: months[Number(month) - 1], formatada: `${date}/${month}/${year}` };
}
