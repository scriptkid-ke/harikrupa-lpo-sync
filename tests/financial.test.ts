import { describe, it, expect } from 'vitest';
import { calculateLpoTotals, formatLpoNumber, round2 } from '@/utils/financial';

describe('calculateLpoTotals', () => {
  it('computes subtotal, VAT, and total at the default 16% rate', () => {
    const { subtotal, vatAmount, total } = calculateLpoTotals(220, 650, 16);
    expect(subtotal).toBe(143000);
    expect(vatAmount).toBe(22880);
    expect(total).toBe(165880);
  });

  it('handles a zero VAT rate', () => {
    const { subtotal, vatAmount, total } = calculateLpoTotals(10, 100, 0);
    expect(subtotal).toBe(1000);
    expect(vatAmount).toBe(0);
    expect(total).toBe(1000);
  });

  it('rounds to 2 decimal places consistently with the DB constraint', () => {
    const { subtotal, vatAmount, total } = calculateLpoTotals(3, 33.333, 16);
    expect(subtotal).toBe(round2(3 * 33.333));
    expect(Number.isFinite(vatAmount)).toBe(true);
    expect(total).toBe(round2(subtotal + vatAmount));
  });

  it('never produces a negative total for valid positive inputs', () => {
    const { total } = calculateLpoTotals(1, 0, 16);
    expect(total).toBe(0);
  });
});

describe('formatLpoNumber', () => {
  it('formats the first sequence value as LPO-0001', () => {
    expect(formatLpoNumber(1)).toBe('LPO-0001');
  });

  it('formats large sequence values without truncating digits', () => {
    expect(formatLpoNumber(12345)).toBe('LPO-12345');
  });

  it('respects a custom prefix and padding', () => {
    expect(formatLpoNumber(7, 'HK-', 3)).toBe('HK-007');
  });
});

describe('round2', () => {
  it('rounds half-cent values up consistently', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });
});
