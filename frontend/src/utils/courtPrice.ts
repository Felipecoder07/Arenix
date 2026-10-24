// Accept decimal commas/dots and Brazilian thousands separators without
// silently discarding invalid characters or extra decimal places.
export function parseCourtPrice(value: string): number {
  const text = value.trim();
  const decimal = /^\d+(?:[.,]\d{1,2})?$/;
  const grouped = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/;
  if (!decimal.test(text) && !grouped.test(text)) return NaN;
  const normalized = grouped.test(text) ? text.replace(/\./g, '').replace(',', '.') : text.replace(',', '.');
  const price = Number(normalized);
  const cents = Math.round(price * 100);
  return price > 0 && Number.isSafeInteger(cents) && cents > 0 ? price : NaN;
}
export function formatCourtPriceInput(value: string): string {
  if (value === '') return '';
  if (!/^\d+(?:[.,]\d*)?$/.test(value)) return value;
  const digits = value.replace(/[.,]/g, '').replace(/^0+(?=\d)/, '').padStart(3, '0');
  return `${digits.slice(0, -2)},${digits.slice(-2)}`;
}

