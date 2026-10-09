import { and, eq, gt, sql } from 'drizzle-orm';
import { getDb, type DbOrTx } from '@/db/client';
import { creditLines, drawdowns } from '@/db/schema';
import { TraderNotFound } from './errors';

export type Balances = {
  walletKobo: bigint;
  savingsKobo: bigint;
  /** What the trader owes on her credit line (loan_receivable, debit-normal). */
  loanOutstandingKobo: bigint;
  /** Amount + fee of drawdowns awaiting approval whose token has not expired (reserved credit). */
  pendingDrawdownsKobo: bigint;
  creditLimitKobo: bigint;
  /** limit - loanOutstanding - pendingDrawdowns, never below zero. */
  availableCreditKobo: bigint;
};

type NetRow = { type: string; net: string };

/**
 * Balances are always derived from postings; nothing is stored.
 * Pass `tx` to read inside a transaction that already holds the credit-line lock.
 */
export async function getBalances(traderId: string, tx: DbOrTx = getDb()): Promise<Balances> {
  // Net (credits - debits) per account type for this trader's accounts.
  const rows = (await tx.execute(sql`
    SELECT a.type AS type,
           COALESCE(SUM(CASE WHEN p.direction = 'credit' THEN p.amount_kobo ELSE -p.amount_kobo END), 0)::text AS net
      FROM ledger_accounts a
      LEFT JOIN postings p ON p.account_id = a.id
     WHERE a.owner_id = ${traderId}
     GROUP BY a.type
  `)) as unknown as NetRow[];

  if (rows.length === 0) throw new TraderNotFound();
  const net = new Map(rows.map((r) => [r.type, BigInt(r.net)]));

  const walletKobo = net.get('trader_wallet') ?? 0n;
  const savingsKobo = net.get('trader_savings') ?? 0n;
  const loanOutstandingKobo = -(net.get('loan_receivable') ?? 0n); // debit-normal

  const [line] = await tx
    .select({ limitKobo: creditLines.limitKobo })
    .from(creditLines)
    .where(eq(creditLines.traderId, traderId));
  const creditLimitKobo = line?.limitKobo ?? 0n;

  const [pending] = await tx
    .select({ total: sql<string>`COALESCE(SUM(${drawdowns.amountKobo} + ${drawdowns.feeKobo}), 0)::text` })
    .from(drawdowns)
    .where(
      and(
        eq(drawdowns.traderId, traderId),
        eq(drawdowns.status, 'pending_approval'),
        gt(drawdowns.tokenExpiresAt, sql`now()`),
      ),
    );
  const pendingDrawdownsKobo = BigInt(pending?.total ?? '0');

  const headroom = creditLimitKobo - loanOutstandingKobo - pendingDrawdownsKobo;
  return {
    walletKobo,
    savingsKobo,
    loanOutstandingKobo,
    pendingDrawdownsKobo,
    creditLimitKobo,
    availableCreditKobo: headroom > 0n ? headroom : 0n,
  };
}
