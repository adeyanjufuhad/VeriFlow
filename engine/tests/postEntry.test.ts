import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDb } from '../db/client';
import { journalEntries, postings } from '../db/schema';
import { getSystemAccountId, postEntry, UnbalancedEntry, InvalidAmount, InvalidEntry } from '../lib/ledger';
import { createTestTrader, expectPgError, uniqueKey } from './helpers';

async function twoAccounts() {
  const trader = await createTestTrader();
  const clearing = await getSystemAccountId('provider_clearing');
  return { trader, clearing, wallet: trader.accounts.wallet };
}

describe('postEntry validation', () => {
  it('refuses an unbalanced entry and writes nothing', async () => {
    const { clearing, wallet } = await twoAccounts();
    const key = uniqueKey();
    await expect(
      postEntry({
        idempotencyKey: key,
        kind: 'test',
        postings: [
          { accountId: clearing, direction: 'debit', amountKobo: 1000n },
          { accountId: wallet, direction: 'credit', amountKobo: 999n },
        ],
      }),
    ).rejects.toBeInstanceOf(UnbalancedEntry);
    const rows = await getDb().select().from(journalEntries).where(eq(journalEntries.idempotencyKey, key));
    expect(rows).toHaveLength(0);
  });

  it('refuses zero and negative amounts', async () => {
    const { clearing, wallet } = await twoAccounts();
    for (const amountKobo of [0n, -500n]) {
      await expect(
        postEntry({
          idempotencyKey: uniqueKey(),
          kind: 'test',
          postings: [
            { accountId: clearing, direction: 'debit', amountKobo },
            { accountId: wallet, direction: 'credit', amountKobo },
          ],
        }),
      ).rejects.toBeInstanceOf(InvalidAmount);
    }
  });

  it('refuses a single-sided entry and non-bigint amounts (no floats)', async () => {
    const { clearing, wallet } = await twoAccounts();
    await expect(
      postEntry({ idempotencyKey: uniqueKey(), kind: 'test', postings: [{ accountId: clearing, direction: 'debit', amountKobo: 5n }] }),
    ).rejects.toBeInstanceOf(InvalidEntry);
    await expect(
      postEntry({
        idempotencyKey: uniqueKey(),
        kind: 'test',
        postings: [
          { accountId: clearing, direction: 'debit', amountKobo: 12.5 as unknown as bigint },
          { accountId: wallet, direction: 'credit', amountKobo: 12.5 as unknown as bigint },
        ],
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('refuses unknown accounts and secrets in metadata', async () => {
    const { clearing, wallet } = await twoAccounts();
    await expect(
      postEntry({
        idempotencyKey: uniqueKey(),
        kind: 'test',
        postings: [
          { accountId: clearing, direction: 'debit', amountKobo: 5n },
          { accountId: crypto.randomUUID(), direction: 'credit', amountKobo: 5n },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidEntry);
    await expect(
      postEntry({
        idempotencyKey: uniqueKey(),
        kind: 'test',
        metadata: { pin: '1234' },
        postings: [
          { accountId: clearing, direction: 'debit', amountKobo: 5n },
          { accountId: wallet, direction: 'credit', amountKobo: 5n },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidEntry);
  });
});

describe('postEntry writes', () => {
  it('stores postings with the trader id and bigint metadata as strings', async () => {
    const { trader, clearing, wallet } = await twoAccounts();
    const entry = await postEntry({
      idempotencyKey: uniqueKey(),
      kind: 'incoming_payment',
      traderId: trader.id,
      reference: 'ref-1',
      metadata: { amountKobo: 500000n, payer: 'Customer' },
      postings: [
        { accountId: clearing, direction: 'debit', amountKobo: 500000n },
        { accountId: wallet, direction: 'credit', amountKobo: 500000n },
      ],
    });
    expect(entry.created).toBe(true);
    expect(entry.metadata).toEqual({ amountKobo: '500000', payer: 'Customer' });
    expect(entry.postings).toHaveLength(2);
    const walletPosting = entry.postings.find((p) => p.accountId === wallet);
    const clearingPosting = entry.postings.find((p) => p.accountId === clearing);
    expect(walletPosting?.traderId).toBe(trader.id);
    expect(clearingPosting?.traderId).toBeNull();
    expect(typeof walletPosting?.amountKobo).toBe('bigint');
  });

  it('is idempotent: the same key twice returns the same entry and posts once', async () => {
    const { clearing, wallet } = await twoAccounts();
    const input = {
      idempotencyKey: uniqueKey('webhook'),
      kind: 'incoming_payment',
      postings: [
        { accountId: clearing, direction: 'debit' as const, amountKobo: 700n },
        { accountId: wallet, direction: 'credit' as const, amountKobo: 700n },
      ],
    };
    const first = await postEntry(input);
    const second = await postEntry(input);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);
    expect(second.postings.map((p) => p.id)).toEqual(first.postings.map((p) => p.id));
    const rows = await getDb().select().from(postings).where(eq(postings.entryId, first.id));
    expect(rows).toHaveLength(2);
  });

  it('is idempotent under concurrency: 10 simultaneous posts of one key write one entry', async () => {
    const { clearing, wallet } = await twoAccounts();
    const input = {
      idempotencyKey: uniqueKey('race'),
      kind: 'incoming_payment',
      postings: [
        { accountId: clearing, direction: 'debit' as const, amountKobo: 123n },
        { accountId: wallet, direction: 'credit' as const, amountKobo: 123n },
      ],
    };
    const results = await Promise.all(Array.from({ length: 10 }, () => postEntry(input)));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    const rows = await getDb().select().from(postings).where(eq(postings.entryId, results[0]!.id));
    expect(rows).toHaveLength(2);
  });

  it('rolls back with the surrounding transaction', async () => {
    const { clearing, wallet } = await twoAccounts();
    const key = uniqueKey('rollback');
    await expect(
      getDb().transaction(async (tx) => {
        await postEntry(
          {
            idempotencyKey: key,
            kind: 'test',
            postings: [
              { accountId: clearing, direction: 'debit', amountKobo: 50n },
              { accountId: wallet, direction: 'credit', amountKobo: 50n },
            ],
          },
          tx,
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const rows = await getDb().select().from(journalEntries).where(eq(journalEntries.idempotencyKey, key));
    expect(rows).toHaveLength(0);
  });
});

describe('database-level ledger guards', () => {
  it('rejects an unbalanced entry at commit even if application code is bypassed', async () => {
    const { clearing, wallet } = await twoAccounts();
    await expect(
      getDb().transaction(async (tx) => {
        const [e] = await tx.insert(journalEntries).values({ idempotencyKey: uniqueKey('raw'), kind: 'raw' }).returning();
        await tx.insert(postings).values([
          { entryId: e!.id, accountId: clearing, direction: 'debit', amountKobo: 100n },
          { entryId: e!.id, accountId: wallet, direction: 'credit', amountKobo: 90n },
        ]);
      }),
    ).rejects.toThrow(/unbalanced journal entry/);
  });

  it('rejects an entry with no postings at commit', async () => {
    await expect(
      getDb().transaction(async (tx) => {
        await tx.insert(journalEntries).values({ idempotencyKey: uniqueKey('empty'), kind: 'raw' });
      }),
    ).rejects.toThrow(/unbalanced journal entry/);
  });

  it('rejects zero amounts at the database', async () => {
    const { clearing, wallet } = await twoAccounts();
    await expect(
      getDb().transaction(async (tx) => {
        const [e] = await tx.insert(journalEntries).values({ idempotencyKey: uniqueKey('zero'), kind: 'raw' }).returning();
        await tx.insert(postings).values([
          { entryId: e!.id, accountId: clearing, direction: 'debit', amountKobo: 0n },
          { entryId: e!.id, accountId: wallet, direction: 'credit', amountKobo: 0n },
        ]);
      }),
    ).rejects.toThrow();
  });

  it('is append-only: update, delete and truncate are refused', async () => {
    const { clearing, wallet } = await twoAccounts();
    const entry = await postEntry({
      idempotencyKey: uniqueKey(),
      kind: 'test',
      postings: [
        { accountId: clearing, direction: 'debit', amountKobo: 10n },
        { accountId: wallet, direction: 'credit', amountKobo: 10n },
      ],
    });
    const db = getDb();
    await expectPgError(db.update(postings).set({ amountKobo: 11n }).where(eq(postings.entryId, entry.id)), /append-only/);
    await expectPgError(db.delete(postings).where(eq(postings.entryId, entry.id)), /append-only/);
    await expectPgError(db.update(journalEntries).set({ kind: 'x' }).where(eq(journalEntries.id, entry.id)), /append-only/);
    await expectPgError(db.delete(journalEntries).where(eq(journalEntries.id, entry.id)), /append-only/);
    await expectPgError(db.execute(sql`TRUNCATE postings`), /append-only/);
  });
});
