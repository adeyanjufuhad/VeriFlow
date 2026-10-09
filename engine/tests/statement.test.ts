import { describe, expect, it } from 'vitest';
import { getStatement } from '../lib/ledger';
import { createTestTrader, lend, payIntoWallet } from './helpers';

describe('getStatement', () => {
  it('lists the wallet newest first with a running balance', async () => {
    const t = await createTestTrader();
    await payIntoWallet(t, 100_000n);
    await payIntoWallet(t, 250_000n);
    await payIntoWallet(t, 50_000n);

    const lines = await getStatement(t.id);
    expect(lines.map((l) => l.amountKobo)).toEqual([50_000n, 250_000n, 100_000n]);
    expect(lines.map((l) => l.balanceAfterKobo)).toEqual([400_000n, 350_000n, 100_000n]);
    expect(lines.every((l) => l.signedKobo === l.amountKobo)).toBe(true);
    expect(lines[0]?.description).toBe('Payment received');
  });

  it('reports the loan account with debits as increases', async () => {
    const t = await createTestTrader();
    await lend(t, 900_000n);
    const [line] = await getStatement(t.id, { account: 'loan' });
    expect(line?.direction).toBe('debit');
    expect(line?.signedKobo).toBe(900_000n);
    expect(line?.balanceAfterKobo).toBe(900_000n);
  });

  it('keeps the running balance correct when a window or limit is applied', async () => {
    const t = await createTestTrader();
    for (const n of [1n, 2n, 3n, 4n]) await payIntoWallet(t, n * 1000n);
    const lines = await getStatement(t.id, { limit: 2 });
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.balanceAfterKobo)).toEqual([10_000n, 6_000n]);

    const future = await getStatement(t.id, { from: new Date(Date.now() + 3_600_000) });
    expect(future).toHaveLength(0);
    const past = await getStatement(t.id, { to: new Date(Date.now() - 3_600_000) });
    expect(past).toHaveLength(0);
    const all = await getStatement(t.id, { from: new Date(Date.now() - 3_600_000), to: new Date(Date.now() + 3_600_000) });
    expect(all).toHaveLength(4);
  });

  it('only shows this trader\'s postings', async () => {
    const a = await createTestTrader();
    const b = await createTestTrader();
    await payIntoWallet(a, 1_000n);
    await payIntoWallet(b, 2_000n);
    const lines = await getStatement(a.id);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.amountKobo).toBe(1_000n);
  });
});
