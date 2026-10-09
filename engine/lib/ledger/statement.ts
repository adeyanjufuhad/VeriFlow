import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, type DbOrTx } from '@/db/client';
import { ledgerAccounts } from '@/db/schema';
import { NORMAL_SIDE } from './accounts';
import { AccountNotFound } from './errors';

export type StatementAccount = 'wallet' | 'savings' | 'loan';

const ACCOUNT_TYPE = {
  wallet: 'trader_wallet',
  savings: 'trader_savings',
  loan: 'loan_receivable',
} as const;

export const StatementOptionsSchema = z.object({
  account: z.enum(['wallet', 'savings', 'loan']).default('wallet'),
  from: z.date().optional(),
  to: z.date().optional(),
  limit: z.number().int().min(1).max(500).default(50),
});
export type StatementOptions = z.input<typeof StatementOptionsSchema>;

export type StatementLine = {
  postingId: bigint;
  entryId: string;
  at: Date;
  kind: string;
  reference: string | null;
  /** The posting's raw direction on this account. */
  direction: 'debit' | 'credit';
  amountKobo: bigint;
  /** +amount when the line increases the account's natural balance, -amount when it decreases it. */
  signedKobo: bigint;
  /** Natural balance of the account right after this line (wallet/savings: owed to trader; loan: outstanding). */
  balanceAfterKobo: bigint;
  description: string;
};

const DESCRIPTIONS: Record<string, string> = {
  incoming_payment: 'Payment received',
  drawdown_approved: 'Supplier credit approved',
  drawdown_paid: 'Supplier payment confirmed',
  drawdown_reversed: 'Supplier payment failed, credit restored',
  savings_sweep: 'Moved to savings',
  debt_payment: 'Debt payment received',
};

type Row = {
  id: string;
  entry_id: string;
  kind: string;
  reference: string | null;
  created_at: Date | string;
  direction: 'debit' | 'credit';
  amount_kobo: string;
  balance_after: string;
};

/** Newest first. Running balance is computed over the account's full history, then the window is applied. */
export async function getStatement(
  traderId: string,
  options: StatementOptions = {},
  tx: DbOrTx = getDb(),
): Promise<StatementLine[]> {
  const opts = StatementOptionsSchema.parse(options);
  const type = ACCOUNT_TYPE[opts.account];

  const [account] = await tx
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.ownerId, traderId), eq(ledgerAccounts.type, type)));
  if (!account) throw new AccountNotFound('Trader account not found', { traderId, account: opts.account });

  const normal = NORMAL_SIDE[type];
  const fromClause = opts.from ? sql`AND s.created_at >= ${opts.from.toISOString()}::timestamptz` : sql``;
  const toClause = opts.to ? sql`AND s.created_at <= ${opts.to.toISOString()}::timestamptz` : sql``;

  const rows = (await tx.execute(sql`
    SELECT s.id::text AS id, s.entry_id, s.kind, s.reference, s.created_at, s.direction,
           s.amount_kobo::text AS amount_kobo, s.balance_after::text AS balance_after
      FROM (
        SELECT p.id, p.entry_id, e.kind, e.reference, e.created_at, p.direction, p.amount_kobo,
               SUM(CASE WHEN p.direction = ${normal} THEN p.amount_kobo ELSE -p.amount_kobo END)
                 OVER (ORDER BY p.id) AS balance_after
          FROM postings p
          JOIN journal_entries e ON e.id = p.entry_id
         WHERE p.account_id = ${account.id}
      ) s
     WHERE TRUE ${fromClause} ${toClause}
     ORDER BY s.id DESC
     LIMIT ${opts.limit}
  `)) as unknown as Row[];

  return rows.map((r) => {
    const amountKobo = BigInt(r.amount_kobo);
    return {
      postingId: BigInt(r.id),
      entryId: r.entry_id,
      at: new Date(r.created_at),
      kind: r.kind,
      reference: r.reference,
      direction: r.direction,
      amountKobo,
      signedKobo: r.direction === normal ? amountKobo : -amountKobo,
      balanceAfterKobo: BigInt(r.balance_after),
      description: DESCRIPTIONS[r.kind] ?? r.kind,
    };
  });
}
