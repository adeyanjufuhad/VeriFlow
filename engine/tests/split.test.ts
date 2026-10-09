import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidAmount } from '../lib/ledger/errors';
import { formatNaira, nairaToKobo, parseKobo } from '../lib/money/kobo';
import { computeSplit } from '../lib/money/split';

describe('computeSplit', () => {
  it('10% of ₦5,000 with a big loan -> ₦500 to loan, ₦4,500 to wallet', () => {
    expect(computeSplit(500_000n, 1000, 45_000_000n)).toEqual({ loanShareKobo: 50_000n, walletShareKobo: 450_000n });
  });

  it('caps the loan share at what is still owed', () => {
    expect(computeSplit(500_000n, 1000, 20_000n)).toEqual({ loanShareKobo: 20_000n, walletShareKobo: 480_000n });
  });

  it('sends everything to the wallet when nothing is owed', () => {
    expect(computeSplit(500_000n, 1000, 0n)).toEqual({ loanShareKobo: 0n, walletShareKobo: 500_000n });
  });

  it('floors odd amounts: ₦1,234.57 at 10% -> 12345 kobo to loan (not 12346)', () => {
    const amount = nairaToKobo('1,234.57');
    expect(amount).toBe(123_457n);
    const split = computeSplit(amount, 1000, 10_000_000n);
    expect(split.loanShareKobo).toBe(12_345n);
    expect(split.walletShareKobo).toBe(111_112n);
    expect(split.loanShareKobo + split.walletShareKobo).toBe(amount);
  });

  it('handles 0% and 100% rates and tiny amounts', () => {
    expect(computeSplit(100n, 0, 1_000n).loanShareKobo).toBe(0n);
    expect(computeSplit(100n, 10_000, 1_000n).loanShareKobo).toBe(100n);
    expect(computeSplit(9n, 1000, 1_000n)).toEqual({ loanShareKobo: 0n, walletShareKobo: 9n });
  });

  it('rejects non-positive amounts and bad rates', () => {
    expect(() => computeSplit(0n, 1000, 1n)).toThrow(InvalidAmount);
    expect(() => computeSplit(-5n, 1000, 1n)).toThrow(InvalidAmount);
    expect(() => computeSplit(5n, 10_001, 1n)).toThrow(InvalidAmount);
    expect(() => computeSplit(5n, 1.5, 1n)).toThrow(InvalidAmount);
  });

  it('property: never creates or loses a kobo, never over-repays, never negative', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 10n ** 15n }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.bigInt({ min: 0n, max: 10n ** 15n }),
        (amount, bps, outstanding) => {
          const { loanShareKobo, walletShareKobo } = computeSplit(amount, bps, outstanding);
          expect(loanShareKobo + walletShareKobo).toBe(amount);
          expect(loanShareKobo >= 0n && walletShareKobo >= 0n).toBe(true);
          expect(loanShareKobo <= outstanding).toBe(true);
          expect(loanShareKobo <= (amount * BigInt(bps)) / 10_000n).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe('kobo helpers', () => {
  it('parses naira strings exactly, without floats', () => {
    expect(nairaToKobo('5000')).toBe(500_000n);
    expect(nairaToKobo('₦5,000.5')).toBe(500_050n);
    expect(nairaToKobo('0.07')).toBe(7n);
    expect(nairaToKobo('0.1')).toBe(10n); // the classic float trap
    expect(nairaToKobo('19.99')).toBe(1_999n);
  });

  it('rejects junk, negatives and more than two decimals', () => {
    for (const bad of ['', 'abc', '-5', '1.234', '1e5', '5,00,0.', '₦']) {
      expect(() => nairaToKobo(bad), bad).toThrow(InvalidAmount);
    }
  });

  it('formats kobo as naira', () => {
    expect(formatNaira(123_457n)).toBe('₦1,234.57');
    expect(formatNaira(500_000n)).toBe('₦5,000.00');
    expect(formatNaira(5n)).toBe('₦0.05');
    expect(formatNaira(0n)).toBe('₦0.00');
    expect(formatNaira(100_000_000_000n)).toBe('₦1,000,000,000.00');
  });

  it('round-trips format -> parse', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 14n }), (k) => nairaToKobo(formatNaira(k)) === k),
      { numRuns: 300 },
    );
  });

  it('parseKobo accepts digit strings and safe integers only', () => {
    expect(parseKobo('500000')).toBe(500_000n);
    expect(parseKobo(500000)).toBe(500_000n);
    for (const bad of [12.5, '12.5', '-1', 'abc', null, undefined, Number.MAX_SAFE_INTEGER + 2]) {
      expect(() => parseKobo(bad), String(bad)).toThrow(InvalidAmount);
    }
  });
});
