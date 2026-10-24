import { expect, test } from 'vitest';
import { parseCourtPrice } from '../src/utils/courtPrice';

test.each([
  ['125,50', 125.5], ['125.50', 125.5], ['125', 125],
  ['1.250,50', 1250.5], ['1.250', 1250], [' 0,01 ', 0.01],
])('interpreta o preço %s como %s reais', (input, expected) => {
  expect(parseCourtPrice(input)).toBe(expected);
});

test.each(['', ' ', '0', '0,00', '-10', '10abc', '1,2,3', '1,234', '12.3456', 'Infinity', '1e3', '999999999999999999999'])('rejeita o preço inválido %s', input => {
  expect(parseCourtPrice(input)).toBeNaN();
});
