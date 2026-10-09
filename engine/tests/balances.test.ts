import { describe, expect, it } from 'vitest';
import { getDb } from '../db/client';
import { drawdowns, suppliers } from '../db/schema';
import { getBalances, getSystemAccountId, postEntry, TraderNotFound } from '../lib/ledger';
import { createTestTrader, lend, payIntoWallet, uniqueKey } from './helpers';

async function pendingDrawdown(traderId: string, amountKobo: bigint, feeKobo: bigint, expiresInMs = 600_000) {
  const db = getDb();
  const [supplier] = await db
    .insert(suppliers)
    .values({ traderId, name: 'Alhaji Musa', bankCode: '058', accountNumber: String(Math.floor(Math.random() * 1e10)).padStart(10, '0') })
    .returning();
  await db.insert(drawdowns).values({
    traderId,
    supplierId: supplier!.id,
    amountKobo,
    feeKobo,
    approvalTokenHash: uniqueKey('hash'),
    tokenExpiresAt: new Date(Date.now() + expiresInMs),
  });
}

describe('getBalances', () => {
  it('is all zeros for a new trader with a zero limit', async () => {
    const t = await createTestTrader();
    expect(await getBalances(t.id)).toEqual({
      walletKobo: 0n,
      savingsKobo: 0n,
      loanOutstandingKobo: 0n,
      pendingDrawdownsKobo: 0n,
      creditLimitKobo: 0n,
      availableCreditKobo: 0n,
    });
  });

  it('throws TraderNotFound for an unknown trader', async () => {
    await expect(getBalances(crypto.randomUUID())).rejects.toBeInstanceOf(TraderNotFound);
  });

  it('derives wallet, loan and savings from postings', async () => {
    const t = await createTestTrader({ limitKobo: 100_000_000n });
    await payIntoWallet(t, 500_000n);
    await lend(t, 45_000_000n);
    const clearing = await getSystemAccountId('provider_clearing');
    // loan repayment of 50_000 out of a 500_000 customer payment
    await postEntry({
      idempotencyKey: uniqueKey('split'),
      kind: 'incoming_payment',
      traderId: t.id,
      postings: [
        { accountId: clearing, direction: 'debit', amountKobo: 500_000n },
        { accountId: t.accounts.loan, direction: 'credit', amountKobo: 50_000n },
        { accountId: t.accounts.wallet, direction: 'credit', amountKobo: 450_000n },
      ],
    });
    // sweep 400_000 to savings
    await postEntry({
      idempotencyKey: uniqueKey('sweep'),
      kind: 'savings_sweep',
      traderId: t.id,
      postings: [
        { accountId: t.accounts.wallet, direction: 'debit', amountKobo: 400_000n },
        { accountId: t.accounts.savings, direction: 'credit', amountKobo: 400_000n },
      ],
    });

    const b = await getBalances(t.id);
    expect(b.walletKobo).toBe(500_000n + 450_000n - 400_000n);
    expect(b.savingsKobo).toBe(400_000n);
    expect(b.loanOutstandingKobo).toBe(45_000_000n - 50_000n);
    expect(b.creditLimitKobo).toBe(100_000_000n);
    expect(b.availableCreditKobo).toBe(100_000_000n - (45_000_000n - 50_000n));
  });

  it('subtracts unexpired pending drawdowns (amount + fee) from available credit, ignores expired ones', async () => {
    const t = await createTestTrader({ limitKobo: 1_000_000n });
    await lend(t, 300_000n);
    await pendingDrawdown(t.id, 200_000n, 2_000n);
    await pendingDrawdown(t.id, 999_999n, 9_999n, -1_000); // expired token
    const b = await getBalances(t.id);
    expect(b.pendingDrawdownsKobo).toBe(202_000n);
    expect(b.availableCreditKobo).toBe(1_000_000n - 300_000n - 202_000n);
  });

  it('never reports negative available credit when the limit drops below what is owed', async () => {
    const t = await createTestTrader({ limitKobo: 100_000n });
    await lend(t, 500_000n);
    const b = await getBalances(t.id);
    expect(b.loanOutstandingKobo).toBe(500_000n);
    expect(b.availableCreditKobo).toBe(0n);
  });
});
