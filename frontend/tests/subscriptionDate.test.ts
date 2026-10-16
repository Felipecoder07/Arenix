import { expect, it } from 'vitest';
import { subscriptionDate } from '../src/utils/subscriptionDate';

it.each([undefined, null, '', 'inválida', '2026-02-29', '2026-13-10', '2026-04-31'])('não inventa vencimento para %s', value => {
  expect(subscriptionDate(value)).toBeNull();
});

it('preserva o dia de calendário e aceita fevereiro bissexto', () => {
  expect(subscriptionDate('2028-02-29')).toEqual({ dia: '29', mes: 'FEV', formatada: '29/02/2028' });
  expect(subscriptionDate('2026-10-10T00:00:00Z')?.formatada).toBe('10/10/2026');
});
