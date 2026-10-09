import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, type DbOrTx, type Tx } from '@/db/client';
import { journalEntries, ledgerAccounts, postings, type JournalEntryRow, type PostingRow } from '@/db/schema';
import { jsonSafe } from '../json';
import { containsSecretKey } from '../log';
import { InvalidAmount, InvalidEntry, UnbalancedEntry } from './errors';

export const PostingInputSchema = z.object({
  accountId: z.uuid(),
  direction: z.enum(['debit', 'credit']),
  amountKobo: z.bigint(),
});

export const PostEntryInputSchema = z.object({
  idempotencyKey: z.string().min(1).max(200),
  kind: z.string().min(1).max(60),
  traderId: z.uuid().optional(),
  reference: z.string().max(200).optional(),
  postings: z.array(PostingInputSchema).min(2, 'An entry needs at least two postings'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type PostEntryInput = z.input<typeof PostEntryInputSchema>;

export type JournalEntry = JournalEntryRow & {
  postings: PostingRow[];
  /** true when this call wrote the entry; false when the idempotency key already existed. */
  created: boolean;
};

/**
 * The only way money moves. Writes a journal entry and all its postings atomically.
 *
 * - Refuses unbalanced entries and non-positive amounts (before touching the database).
 * - Idempotent: re-posting an existing `idempotencyKey` returns the original entry and writes nothing.
 * - Pass `tx` to make the entry part of a larger transaction (drawdown status, outbox row, ...).
 *   Without `tx`, it opens its own transaction.
 */
export async function postEntry(input: PostEntryInput, tx?: DbOrTx): Promise<JournalEntry> {
  const parsed = PostEntryInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === 'postings' && issue.path[2] === 'amountKobo') throw new InvalidAmount();
    throw new InvalidEntry(issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid entry');
  }
  const entry = parsed.data;

  let debits = 0n;
  let credits = 0n;
  for (const p of entry.postings) {
    if (p.amountKobo <= 0n) throw new InvalidAmount();
    if (p.direction === 'debit') debits += p.amountKobo;
    else credits += p.amountKobo;
  }
  if (debits !== credits) throw new UnbalancedEntry(debits, credits);

  if (entry.metadata) {
    const bad = containsSecretKey(entry.metadata);
    if (bad) throw new InvalidEntry(`metadata must not contain secrets or account numbers (key: ${bad})`);
  }

  if (tx) return writeEntry(tx as Tx, entry);
  return getDb().transaction((t) => writeEntry(t, entry));
}

async function writeEntry(tx: Tx, entry: z.output<typeof PostEntryInputSchema>): Promise<JournalEntry> {
  const [inserted] = await tx
    .insert(journalEntries)
    .values({
      idempotencyKey: entry.idempotencyKey,
      kind: entry.kind,
      traderId: entry.traderId ?? null,
      reference: entry.reference ?? null,
      metadata: jsonSafe(entry.metadata ?? {}),
    })
    .onConflictDoNothing({ target: journalEntries.idempotencyKey })
    .returning();

  if (!inserted) {
    // Same key already posted (possibly by a concurrent transaction that has now committed).
    const [existing] = await tx.select().from(journalEntries).where(eq(journalEntries.idempotencyKey, entry.idempotencyKey));
    if (!existing) throw new InvalidEntry('Idempotency key conflict could not be resolved');
    const existingPostings = await tx.select().from(postings).where(eq(postings.entryId, existing.id)).orderBy(postings.id);
    return { ...existing, postings: existingPostings, created: false };
  }

  const accountIds = [...new Set(entry.postings.map((p) => p.accountId))];
  const accounts = await tx
    .select({ id: ledgerAccounts.id, ownerId: ledgerAccounts.ownerId })
    .from(ledgerAccounts)
    .where(inArray(ledgerAccounts.id, accountIds));
  const ownerByAccount = new Map(accounts.map((a) => [a.id, a.ownerId]));
  const missing = accountIds.filter((id) => !ownerByAccount.has(id));
  if (missing.length > 0) throw new InvalidEntry('Unknown ledger account', { accountIds: missing });

  const rows = await tx
    .insert(postings)
    .values(
      entry.postings.map((p) => ({
        entryId: inserted.id,
        accountId: p.accountId,
        traderId: ownerByAccount.get(p.accountId) ?? null,
        direction: p.direction,
        amountKobo: p.amountKobo,
      })),
    )
    .returning();

  return { ...inserted, postings: rows.sort((a, b) => (a.id < b.id ? -1 : 1)), created: true };
}
