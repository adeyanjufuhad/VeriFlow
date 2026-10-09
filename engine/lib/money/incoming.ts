import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, type Tx } from '@/db/client';
import { creditLines, traders } from '@/db/schema';
import { getSystemAccountId, getTraderAccountIds } from '../ledger/accounts';
import { getBalances } from '../ledger/balances';
import { TraderNotFound } from '../ledger/errors';
import { postEntry } from '../ledger/postEntry';
import { log } from '../log';
import { InvalidInput } from './errors';
import { enqueueOutbox, type OutboxEventType } from './outbox';
import { computeSplit } from './split';

export const RecordIncomingInputSchema = z.object({
  /** The provider's unique event id (or reference). It is the idempotency key: a repeated webhook never double-counts. */
  providerEventId: z.string().min(1).max(200),
  virtualAccountNumber: z.string().min(1).max(40),
  amountKobo: z.bigint().positive(),
  payerName: z.string().max(200).optional(),
  paidAt: z.date(),
  reference: z.string().max(200).optional(),
});
export type RecordIncomingInput = z.input<typeof RecordIncomingInputSchema>;

export type IncomingPaymentResult =
  | {
      /** 'duplicate': this event was already recorded; nothing changed and the figures are the original split. */
      status: 'processed' | 'duplicate';
      entryId: string;
      traderId: string;
      amountKobo: bigint;
      loanShareKobo: bigint;
      walletShareKobo: bigint;
      /** Balances right after processing (for a duplicate: current balances). */
      loanOutstandingAfterKobo: bigint;
      walletBalanceAfterKobo: bigint;
    }
  | { status: 'unmatched'; amountKobo: bigint };

export type ApplyIncomingParams = {
  traderId: string;
  idempotencyKey: string;
  kind: 'incoming_payment' | 'debt_payment';
  outboxType: OutboxEventType;
  amountKobo: bigint;
  payerName?: string;
  paidAt: Date;
  reference?: string;
  /** Extra non-secret fields recorded on the entry and the outbox payload (e.g. debtId). */
  extra?: Record<string, unknown>;
};

/**
 * Shared settlement used by every inbound customer payment (virtual account or debt link).
 * Must run inside a transaction. Locks the trader's credit-line row, so concurrent payments, drawdowns
 * and sweeps for one trader are serialised and the split always sees the true loan balance.
 */
export async function applyIncomingPayment(tx: Tx, p: ApplyIncomingParams): Promise<IncomingPaymentResult> {
  const [line] = await tx.select().from(creditLines).where(eq(creditLines.traderId, p.traderId)).for('update');
  if (!line) throw new TraderNotFound();

  const before = await getBalances(p.traderId, tx);
  const split = computeSplit(p.amountKobo, line.sweepRateBps, before.loanOutstandingKobo);

  const [clearing, accounts] = await Promise.all([
    getSystemAccountId('provider_clearing', tx),
    getTraderAccountIds(p.traderId, tx),
  ]);

  const postingLines = [
    { accountId: clearing, direction: 'debit' as const, amountKobo: p.amountKobo },
    ...(split.loanShareKobo > 0n
      ? [{ accountId: accounts.loan, direction: 'credit' as const, amountKobo: split.loanShareKobo }]
      : []),
    ...(split.walletShareKobo > 0n
      ? [{ accountId: accounts.wallet, direction: 'credit' as const, amountKobo: split.walletShareKobo }]
      : []),
  ];

  const entry = await postEntry(
    {
      idempotencyKey: p.idempotencyKey,
      kind: p.kind,
      traderId: p.traderId,
      reference: p.reference,
      postings: postingLines,
      metadata: {
        amountKobo: p.amountKobo,
        loanShareKobo: split.loanShareKobo,
        walletShareKobo: split.walletShareKobo,
        sweepRateBps: line.sweepRateBps,
        payerName: p.payerName,
        paidAt: p.paidAt,
        ...p.extra,
      },
    },
    tx,
  );

  if (!entry.created) {
    // Already recorded. Report the ORIGINAL split from the stored entry, not the one just computed.
    const meta = entry.metadata as Record<string, string>;
    const now = await getBalances(p.traderId, tx);
    return {
      status: 'duplicate',
      entryId: entry.id,
      traderId: p.traderId,
      amountKobo: BigInt(meta.amountKobo ?? p.amountKobo),
      loanShareKobo: BigInt(meta.loanShareKobo ?? 0),
      walletShareKobo: BigInt(meta.walletShareKobo ?? 0),
      loanOutstandingAfterKobo: now.loanOutstandingKobo,
      walletBalanceAfterKobo: now.walletKobo,
    };
  }

  const after = await getBalances(p.traderId, tx);
  const [trader] = await tx
    .select({ name: traders.name, phone: traders.phone })
    .from(traders)
    .where(eq(traders.id, p.traderId));

  await enqueueOutbox(tx, {
    traderId: p.traderId,
    type: p.outboxType,
    payload: {
      entryId: entry.id,
      traderPhone: trader?.phone,
      traderFirstName: trader?.name.split(/\s+/)[0],
      amountKobo: p.amountKobo,
      loanShareKobo: split.loanShareKobo,
      walletShareKobo: split.walletShareKobo,
      loanOutstandingKobo: after.loanOutstandingKobo,
      walletBalanceKobo: after.walletKobo,
      payerName: p.payerName ?? null,
      reference: p.reference ?? null,
      paidAt: p.paidAt,
      ...p.extra,
    },
  });

  return {
    status: 'processed',
    entryId: entry.id,
    traderId: p.traderId,
    amountKobo: p.amountKobo,
    loanShareKobo: split.loanShareKobo,
    walletShareKobo: split.walletShareKobo,
    loanOutstandingAfterKobo: after.loanOutstandingKobo,
    walletBalanceAfterKobo: after.walletKobo,
  };
}

/**
 * A customer paid into a trader's virtual account. Splits the payment (loan repayment vs wallet),
 * posts one balanced entry, and queues the WhatsApp confirmation, all in one transaction.
 * Idempotent on `providerEventId`. A payment to an unknown virtual account returns `unmatched`
 * and posts nothing (reconciliation will list it as missing in the ledger).
 */
export async function recordIncomingPayment(input: RecordIncomingInput): Promise<IncomingPaymentResult> {
  const parsed = RecordIncomingInputSchema.safeParse(input);
  if (!parsed.success) throw new InvalidInput(parsed.error.issues[0]?.message ?? 'Invalid payment');
  const data = parsed.data;

  const [trader] = await getDb()
    .select({ id: traders.id })
    .from(traders)
    .where(eq(traders.virtualAccountNumber, data.virtualAccountNumber));
  if (!trader) {
    log.warn('payment.unmatched_account', { providerEventId: data.providerEventId, amountKobo: data.amountKobo });
    return { status: 'unmatched', amountKobo: data.amountKobo };
  }

  return getDb().transaction((tx) =>
    applyIncomingPayment(tx, {
      traderId: trader.id,
      idempotencyKey: `charge:${data.providerEventId}`,
      kind: 'incoming_payment',
      outboxType: 'payment.received',
      amountKobo: data.amountKobo,
      payerName: data.payerName,
      paidAt: data.paidAt,
      reference: data.reference,
      extra: { providerEventId: data.providerEventId },
    }),
  );
}
