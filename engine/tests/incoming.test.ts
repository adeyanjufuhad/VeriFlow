import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDb } from '../db/client';
import { creditLines, journalEntries, outboxEvents, postings } from '../db/schema';
import { getBalances, getSystemAccountId } from '../lib/ledger';
import { recordIncomingPayment } from '../lib/money/incoming';
import { newTrader, uniqueKey } from './helpers';

const pay = (virtualAccountNumber: string, amountKobo: bigint, providerEventId = uniqueKey('evt')) =>
  recordIncomingPayment({ providerEventId, virtualAccountNumber, amountKobo, payerName: 'Customer', paidAt: new Date() });

async function postingsFor(entryId: string) {
  return getDb().select().from(postings).where(eq(postings.entryId, entryId));
}

describe('recordIncomingPayment: split settlement', () => {
  it('₦5,000 with a loan owed -> ₦500 to loan, ₦4,500 to wallet, one balanced entry', async () => {
    const t = await newTrader({ limitKobo: 100_000_000n, loanKobo: 45_000_000n });
    const result = await pay(t.virtualAccountNumber, 500_000n);

    expect(result.status).toBe('processed');
    if (result.status === 'unmatched') throw new Error('unexpected');
    expect(result.loanShareKobo).toBe(50_000n);
    expect(result.walletShareKobo).toBe(450_000n);
    expect(result.loanOutstandingAfterKobo).toBe(44_950_000n);
    expect(result.walletBalanceAfterKobo).toBe(450_000n);

    const rows = await postingsFor(result.entryId);
    expect(rows).toHaveLength(3);
    const clearing = await getSystemAccountId('provider_clearing');
    const debit = rows.find((r) => r.direction === 'debit');
    expect(debit?.accountId).toBe(clearing);
    expect(debit?.amountKobo).toBe(500_000n);

    const b = await getBalances(t.id);
    expect(b.walletKobo).toBe(450_000n);
    expect(b.loanOutstandingKobo).toBe(44_950_000n);
  });

  it('no loan outstanding -> the whole payment goes to the wallet (two postings)', async () => {
    const t = await newTrader();
    const result = await pay(t.virtualAccountNumber, 500_000n);
    if (result.status === 'unmatched') throw new Error('unexpected');
    expect(result.loanShareKobo).toBe(0n);
    expect(result.walletShareKobo).toBe(500_000n);
    expect(await postingsFor(result.entryId)).toHaveLength(2);
  });

  it('loan smaller than the share -> loan cleared exactly, rest to wallet', async () => {
    const t = await newTrader({ limitKobo: 1_000_000n, loanKobo: 20_000n });
    const result = await pay(t.virtualAccountNumber, 500_000n);
    if (result.status === 'unmatched') throw new Error('unexpected');
    expect(result.loanShareKobo).toBe(20_000n);
    expect(result.walletShareKobo).toBe(480_000n);
    expect((await getBalances(t.id)).loanOutstandingKobo).toBe(0n);
  });

  it('odd amount ₦1,234.57 never creates or loses a kobo', async () => {
    const t = await newTrader({ limitKobo: 10_000_000n, loanKobo: 10_000_000n });
    const result = await pay(t.virtualAccountNumber, 123_457n);
    if (result.status === 'unmatched') throw new Error('unexpected');
    expect(result.loanShareKobo).toBe(12_345n);
    expect(result.walletShareKobo).toBe(111_112n);
    const b = await getBalances(t.id);
    expect(b.walletKobo + (10_000_000n - b.loanOutstandingKobo)).toBe(123_457n);
  });

  it('uses the trader’s own sweep rate and still repays when the credit line is paused', async () => {
    const t = await newTrader({ limitKobo: 5_000_000n, loanKobo: 1_000_000n, sweepRateBps: 2500 });
    await getDb().update(creditLines).set({ status: 'paused' }).where(eq(creditLines.traderId, t.id));
    const result = await pay(t.virtualAccountNumber, 400_000n);
    if (result.status === 'unmatched') throw new Error('unexpected');
    expect(result.loanShareKobo).toBe(100_000n);
  });
});

describe('recordIncomingPayment: idempotency and unknown accounts', () => {
  it('a repeated provider event changes nothing and reports the original split', async () => {
    const t = await newTrader({ limitKobo: 100_000_000n, loanKobo: 1_000_000n });
    const eventId = uniqueKey('evt');
    const first = await pay(t.virtualAccountNumber, 500_000n, eventId);
    await pay(t.virtualAccountNumber, 500_000n); // a different payment changes the loan balance in between
    const again = await pay(t.virtualAccountNumber, 500_000n, eventId);

    expect(first.status).toBe('processed');
    expect(again.status).toBe('duplicate');
    if (first.status === 'unmatched' || again.status === 'unmatched') throw new Error('unexpected');
    expect(again.entryId).toBe(first.entryId);
    expect(again.loanShareKobo).toBe(first.loanShareKobo);
    expect(again.walletShareKobo).toBe(first.walletShareKobo);

    const entries = await getDb().select().from(journalEntries).where(eq(journalEntries.traderId, t.id));
    expect(entries).toHaveLength(3); // the starting loan + the two distinct payments, not four
    const events = await getDb().select().from(outboxEvents).where(eq(outboxEvents.traderId, t.id));
    expect(events).toHaveLength(2); // no extra WhatsApp message for the duplicate
  });

  it('8 simultaneous deliveries of one webhook count the money once', async () => {
    const t = await newTrader({ limitKobo: 100_000_000n, loanKobo: 1_000_000n });
    const eventId = uniqueKey('evt');
    const results = await Promise.all(Array.from({ length: 8 }, () => pay(t.virtualAccountNumber, 500_000n, eventId)));
    expect(results.filter((r) => r.status === 'processed')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'duplicate')).toHaveLength(7);
    const b = await getBalances(t.id);
    expect(b.walletKobo).toBe(450_000n);
    expect(b.loanOutstandingKobo).toBe(950_000n);
    expect(await getDb().select().from(outboxEvents).where(eq(outboxEvents.traderId, t.id))).toHaveLength(1);
  });

  it('simultaneous different payments never repay more than is owed (credit line is locked)', async () => {
    const t = await newTrader({ limitKobo: 10_000_000n, loanKobo: 1_200n });
    // each 5,000 kobo payment would repay 500 kobo; 6 of them would try to repay 3,000 against 1,200 owed
    const results = await Promise.all(Array.from({ length: 6 }, () => pay(t.virtualAccountNumber, 5_000n)));
    const loanShares = results.map((r) => (r.status === 'unmatched' ? 0n : r.loanShareKobo));
    expect(loanShares.reduce((a, b) => a + b, 0n)).toBe(1_200n);
    const b = await getBalances(t.id);
    expect(b.loanOutstandingKobo).toBe(0n);
    expect(b.walletKobo).toBe(6n * 5_000n - 1_200n);
  });

  it('a payment to an unknown virtual account is reported unmatched and posts nothing', async () => {
    const before = await getDb().select().from(journalEntries);
    const result = await pay('0000000000', 500_000n);
    expect(result).toEqual({ status: 'unmatched', amountKobo: 500_000n });
    expect(await getDb().select().from(journalEntries)).toHaveLength(before.length);
  });

  it('rejects zero and negative amounts', async () => {
    const t = await newTrader();
    await expect(pay(t.virtualAccountNumber, 0n)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(pay(t.virtualAccountNumber, -100n)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});

describe('recordIncomingPayment: outbox', () => {
  it('queues one payment.received event in the same transaction, with amounts as strings', async () => {
    const t = await newTrader({ limitKobo: 100_000_000n, loanKobo: 45_000_000n });
    await pay(t.virtualAccountNumber, 500_000n);
    const [event] = await getDb().select().from(outboxEvents).where(eq(outboxEvents.traderId, t.id));
    expect(event?.type).toBe('payment.received');
    expect(event?.deliveredAt).toBeNull();
    expect(event?.payload).toMatchObject({
      amountKobo: '500000',
      loanShareKobo: '50000',
      walletShareKobo: '450000',
      loanOutstandingKobo: '44950000',
      walletBalanceKobo: '450000',
      traderFirstName: 'Mama',
      payerName: 'Customer',
    });
  });
});
