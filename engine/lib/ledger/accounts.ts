import { and, eq, inArray, isNull } from 'drizzle-orm';
import { ledgerAccounts, type AccountType } from '@/db/schema';
import { getDb, type DbOrTx } from '@/db/client';
import { AccountNotFound } from './errors';

/** Normal balance side per account type (bank's point of view). Used for statements and sign handling. */
export const NORMAL_SIDE: Record<AccountType, 'debit' | 'credit'> = {
  provider_clearing: 'debit',
  loan_receivable: 'debit',
  trader_wallet: 'credit',
  trader_savings: 'credit',
  payouts_pending: 'credit',
  fee_income: 'credit',
};

export const SYSTEM_ACCOUNT_TYPES = ['provider_clearing', 'payouts_pending', 'fee_income'] as const;
export const TRADER_ACCOUNT_TYPES = ['trader_wallet', 'trader_savings', 'loan_receivable'] as const;

/**
 * Idempotently creates the system accounts. The migration already seeds them;
 * this exists for code paths (and tests) that need to be certain.
 */
export async function ensureSystemAccounts(tx: DbOrTx = getDb()): Promise<void> {
  await tx
    .insert(ledgerAccounts)
    .values(SYSTEM_ACCOUNT_TYPES.map((type) => ({ ownerType: 'system', ownerId: null, type })))
    .onConflictDoNothing();
}

export async function getSystemAccountId(
  type: (typeof SYSTEM_ACCOUNT_TYPES)[number],
  tx: DbOrTx = getDb(),
): Promise<string> {
  const [row] = await tx
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.ownerType, 'system'), eq(ledgerAccounts.type, type), isNull(ledgerAccounts.ownerId)))
    .limit(1);
  if (!row) throw new AccountNotFound(`System account ${type} is missing (run migrations)`, { type });
  return row.id;
}

export type TraderAccountIds = { wallet: string; savings: string; loan: string };

export async function getTraderAccountIds(traderId: string, tx: DbOrTx = getDb()): Promise<TraderAccountIds> {
  const rows = await tx
    .select({ id: ledgerAccounts.id, type: ledgerAccounts.type })
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.ownerId, traderId), inArray(ledgerAccounts.type, [...TRADER_ACCOUNT_TYPES])));
  const byType = new Map(rows.map((r) => [r.type, r.id]));
  const wallet = byType.get('trader_wallet');
  const savings = byType.get('trader_savings');
  const loan = byType.get('loan_receivable');
  if (!wallet || !savings || !loan) {
    throw new AccountNotFound('Trader ledger accounts are missing', { traderId });
  }
  return { wallet, savings, loan };
}

/** Creates the wallet, savings and loan accounts for a trader. Call inside the createTrader transaction. */
export async function createTraderAccounts(traderId: string, tx: DbOrTx = getDb()): Promise<TraderAccountIds> {
  await tx
    .insert(ledgerAccounts)
    .values(TRADER_ACCOUNT_TYPES.map((type) => ({ ownerType: 'trader', ownerId: traderId, type })))
    .onConflictDoNothing();
  return getTraderAccountIds(traderId, tx);
}
