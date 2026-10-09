import { randomInt } from 'node:crypto';
import { expect } from 'vitest';
import { getDb } from '../db/client';
import { creditLines, traders } from '../db/schema';
import { createTraderAccounts, getSystemAccountId, postEntry, type TraderAccountIds } from '../lib/ledger';

export type TestTrader = { id: string; accounts: TraderAccountIds };

/** Direct inserts: the real createTrader (with provider virtual account) arrives in Phase 2. */
export async function createTestTrader(opts: { limitKobo?: bigint; sweepRateBps?: number } = {}): Promise<TestTrader> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const phone = `+23480${String(randomInt(10_000_000, 99_999_999))}`;
    const [trader] = await tx.insert(traders).values({ name: 'Mama Ngozi Test', phone }).returning({ id: traders.id });
    if (!trader) throw new Error('trader insert failed');
    const accounts = await createTraderAccounts(trader.id, tx);
    await tx.insert(creditLines).values({
      traderId: trader.id,
      limitKobo: opts.limitKobo ?? 0n,
      sweepRateBps: opts.sweepRateBps ?? 1000,
    });
    return { id: trader.id, accounts };
  });
}

let counter = 0;
export const uniqueKey = (prefix = 'k') => `${prefix}:${Date.now()}:${++counter}:${randomInt(1_000_000)}`;

/** Customer pays the trader: provider_clearing debit, wallet credit. */
export async function payIntoWallet(trader: TestTrader, amountKobo: bigint) {
  const clearing = await getSystemAccountId('provider_clearing');
  return postEntry({
    idempotencyKey: uniqueKey('pay'),
    kind: 'incoming_payment',
    traderId: trader.id,
    postings: [
      { accountId: clearing, direction: 'debit', amountKobo },
      { accountId: trader.accounts.wallet, direction: 'credit', amountKobo },
    ],
  });
}

/** Lends the trader money: loan_receivable debit against payouts_pending credit (as a drawdown approval does). */
export async function lend(trader: TestTrader, amountKobo: bigint) {
  const pending = await getSystemAccountId('payouts_pending');
  return postEntry({
    idempotencyKey: uniqueKey('lend'),
    kind: 'drawdown_approved',
    traderId: trader.id,
    postings: [
      { accountId: trader.accounts.loan, direction: 'debit', amountKobo },
      { accountId: pending, direction: 'credit', amountKobo },
    ],
  });
}

/** Drizzle wraps driver errors ("Failed query: ..."); the Postgres message lives on `.cause`. */
export async function expectPgError(promise: Promise<unknown>, pattern: RegExp) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, 'expected the query to fail').not.toBeNull();
  const messages: string[] = [];
  for (let e: unknown = err; e instanceof Error; e = (e as { cause?: unknown }).cause) messages.push(e.message);
  expect(messages.join(' | ')).toMatch(pattern);
}
