import { describe, expect, it } from 'vitest';
import { containsSecretKey, maskAccount, redact } from '../lib/log';

describe('log redaction (rule 9)', () => {
  it('redacts PINs, BVN/NIN, tokens, keys and signatures by key name', () => {
    const out = redact({
      pin: '1234',
      pinHash: 'x',
      bvn: '12345678901',
      NIN: '1',
      apiKey: 'sk_test_1',
      authorization: 'Bearer abc',
      'x-paystack-signature': 'sig',
      approvalToken: 't',
      amountKobo: 500n,
    }) as Record<string, unknown>;
    for (const k of ['pin', 'pinHash', 'bvn', 'NIN', 'apiKey', 'authorization', 'x-paystack-signature', 'approvalToken']) {
      expect(out[k], k).toBe('[redacted]');
    }
    expect(out.amountKobo).toBe('500');
  });

  it('masks account numbers, including nested ones', () => {
    const out = redact({ supplier: { accountNumber: '0123456789', name: 'Musa' } }) as { supplier: Record<string, string> };
    expect(out.supplier.accountNumber).toBe('******6789');
    expect(out.supplier.name).toBe('Musa');
    expect(maskAccount('12')).toBe('****');
  });

  it('does not flag harmless keys that merely contain the letters', () => {
    expect(containsSecretKey({ shipping: 1, spinning: 2, mapping: 3, business: 4 })).toBeNull();
    expect(containsSecretKey({ a: { b: { pin: '1' } } })).toBe('pin');
  });
});
