import { describe, it, expect } from 'vitest';
import {
  brl,
  maskPhone,
  maskCPF,
  formatLongDate,
  formatShortDate,
  mmss,
  getLocalDateISO,
} from '../lib/format';

describe('Format Utilities (format.ts)', () => {
  describe('brl()', () => {
    it('deve formatar valores numéricos em moeda brasileira (R$)', () => {
      const formatted = brl(100);
      expect(formatted).toMatch(/R\$\s?100,00/);
    });

    it('deve formatar valores com centavos corretamente', () => {
      const formatted = brl(85.5);
      expect(formatted).toMatch(/R\$\s?85,50/);
    });

    it('deve formatar zero corretamente', () => {
      const formatted = brl(0);
      expect(formatted).toMatch(/R\$\s?0,00/);
    });
  });

  describe('maskPhone()', () => {
    it('deve aplicar máscara de telefone celular com 11 dígitos', () => {
      expect(maskPhone('11999998888')).toBe('(11) 99999-8888');
    });

    it('deve formatar DDD parcial', () => {
      expect(maskPhone('11')).toBe('(11');
    });

    it('deve retornar vazio se string for vazia', () => {
      expect(maskPhone('')).toBe('');
    });

    it('deve formatar telefone com caracteres pré-existentes', () => {
      expect(maskPhone('(11) 98888-7777')).toBe('(11) 98888-7777');
    });
  });

  describe('maskCPF()', () => {
    it('deve formatar CPF completo com 11 dígitos', () => {
      expect(maskCPF('12345678901')).toBe('123.456.789-01');
    });

    it('deve formatar CPF parcial', () => {
      expect(maskCPF('123')).toBe('123');
      expect(maskCPF('123456')).toBe('123.456');
      expect(maskCPF('123456789')).toBe('123.456.789');
    });
  });

  describe('formatLongDate()', () => {
    it('deve formatar data ISO em formato longo legível', () => {
      // 2026-08-24 é uma Segunda-feira
      const result = formatLongDate('2026-08-24');
      expect(result).toBe('Segunda, 24 de ago');
    });
  });

  describe('formatShortDate()', () => {
    it('deve formatar data ISO em formato curto DD/MM', () => {
      expect(formatShortDate('2026-08-24')).toBe('24/08');
      expect(formatShortDate('2026-12-05')).toBe('05/12');
    });
  });

  describe('mmss()', () => {
    it('deve formatar segundos em MM:SS', () => {
      expect(mmss(65)).toBe('01:05');
      expect(mmss(600)).toBe('10:00');
      expect(mmss(0)).toBe('00:00');
      expect(mmss(9)).toBe('00:09');
    });
  });

  describe('getLocalDateISO()', () => {
    it('deve retornar data no formato YYYY-MM-DD', () => {
      const testDate = new Date(2026, 7, 24); // Mês 7 = Agosto no JS
      expect(getLocalDateISO(testDate)).toBe('2026-08-24');
    });
  });
});
