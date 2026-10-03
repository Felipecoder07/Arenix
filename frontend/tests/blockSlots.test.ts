import { describe, expect, it } from 'vitest';
import { blockSlots } from '../src/utils/blockSlots';

describe('block availability', () => {
  it('does not cross reservations or blocks and preserves minute boundaries', () => {
    const slots = blockSlots('08:30', '18:30', [{ hora_inicio: '10:00', hora_fim: '11:30' }]);
    expect(slots.starts).not.toContain('08:00');
    expect(slots.starts).not.toContain('10:00');
    expect(slots.starts).toContain('11:30');
    expect(slots.ends('09:00').at(-1)).toBe('10:00');
    expect(slots.ends('17:00').at(-1)).toBe('18:30');
  });
  it('returns no selections for a fully occupied day or invalid start', () => {
    const slots = blockSlots('08:00', '18:00', [{ hora_inicio: '08:00', hora_fim: '18:00' }]);
    expect(slots.starts).toEqual([]);
    expect(slots.ends('14:00')).toEqual([]);
  });
  it('excludes elapsed periods while allowing the current period', () => {
    const slots = blockSlots('08:00', '18:00', [], 14 * 60 + 15);
    expect(slots.starts).not.toContain('13:30');
    expect(slots.starts).toContain('14:00');
    expect(slots.ends('14:00')[0]).toBe('15:00');
  });
});
