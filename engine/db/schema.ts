import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  boolean,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * VeriFlow financial engine schema.
 *
 * Money rules encoded here:
 *  - every amount is bigint kobo (mode: 'bigint' => TS bigint, never a float)
 *  - postings are append-only and entries must balance (enforced by triggers in
 *    the hand-written migration `ledger_integrity`, in addition to postEntry)
 *  - balances are derived from postings, never stored
 */

// ---------------------------------------------------------------------------
// Constants shared with application code
// ---------------------------------------------------------------------------

export const ACCOUNT_TYPES = [
  'provider_clearing',
  'trader_wallet',
  'trader_savings',
  'loan_receivable',
  'payouts_pending',
  'fee_income',
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const DRAWDOWN_STATUSES = [
  'pending_approval',
  'approved',
  'paid',
  'failed',
  'expired',
  'cancelled',
] as const;
export type DrawdownStatus = (typeof DRAWDOWN_STATUSES)[number];

export const DEBT_STATUSES = ['open', 'paid', 'cancelled'] as const;
export type DebtStatus = (typeof DEBT_STATUSES)[number];

const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} IN (${values.map((v) => `'${v}'`).join(', ')})`);

const kobo = (name: string) => bigint(name, { mode: 'bigint' });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const traders = pgTable(
  'traders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    phone: text('phone').notNull().unique(),
    businessType: text('business_type'),
    kycStatus: text('kyc_status').notNull().default('mocked'),
    virtualAccountNumber: text('virtual_account_number').unique(),
    virtualAccountBank: text('virtual_account_bank'),
    providerCustomerId: text('provider_customer_id'),
    pinHash: text('pin_hash'),
    pinFailedAttempts: integer('pin_failed_attempts').notNull().default(0),
    pinLockedUntil: ts('pin_locked_until'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('traders_phone_e164', sql`${t.phone} ~ '^\\+[1-9][0-9]{7,14}$'`),
    check('traders_pin_attempts_nonneg', sql`${t.pinFailedAttempts} >= 0`),
  ],
);

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    traderId: uuid('trader_id')
      .notNull()
      .references(() => traders.id),
    name: text('name').notNull(),
    bankCode: text('bank_code').notNull(),
    accountNumber: text('account_number').notNull(),
    accountName: text('account_name'),
    providerRecipientCode: text('provider_recipient_code'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [unique('suppliers_trader_bank_account').on(t.traderId, t.bankCode, t.accountNumber)],
);

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export const ledgerAccounts = pgTable(
  'ledger_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerType: text('owner_type').notNull(),
    ownerId: uuid('owner_id').references(() => traders.id),
    type: text('type').notNull(),
    currency: text('currency').notNull().default('NGN'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('ledger_accounts_owner_type', inList('owner_type', ['trader', 'system'])),
    check('ledger_accounts_type', inList('type', ACCOUNT_TYPES)),
    check(
      'ledger_accounts_owner_consistent',
      sql`(${t.ownerType} = 'trader' AND ${t.ownerId} IS NOT NULL) OR (${t.ownerType} = 'system' AND ${t.ownerId} IS NULL)`,
    ),
    // (owner_id, type) is not unique when owner_id is NULL, so system accounts get their own index.
    uniqueIndex('ledger_accounts_owner_type_uq').on(t.ownerId, t.type).where(sql`${t.ownerId} IS NOT NULL`),
    uniqueIndex('ledger_accounts_system_type_uq').on(t.type).where(sql`${t.ownerType} = 'system'`),
  ],
);

export const journalEntries = pgTable(
  'journal_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    kind: text('kind').notNull(),
    traderId: uuid('trader_id').references(() => traders.id),
    reference: text('reference'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('journal_entries_trader_idx').on(t.traderId, t.createdAt)],
);

export const postings = pgTable(
  'postings',
  {
    id: bigint('id', { mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => journalEntries.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => ledgerAccounts.id),
    /** Denormalised from the account owner (set once, never changes): lets Realtime filter per trader. */
    traderId: uuid('trader_id').references(() => traders.id),
    direction: text('direction').notNull(),
    amountKobo: kobo('amount_kobo').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('postings_direction', inList('direction', ['debit', 'credit'])),
    check('postings_amount_positive', sql`${t.amountKobo} > 0`),
    index('postings_account_idx').on(t.accountId, t.id),
    index('postings_entry_idx').on(t.entryId),
    index('postings_trader_idx').on(t.traderId, t.id),
  ],
);

// ---------------------------------------------------------------------------
// Credit, drawdowns, debts
// ---------------------------------------------------------------------------

export const creditLines = pgTable(
  'credit_lines',
  {
    traderId: uuid('trader_id')
      .primaryKey()
      .references(() => traders.id),
    /** Written by the credit-intelligence code. */
    limitKobo: kobo('limit_kobo').notNull().default(sql`0`),
    sweepRateBps: integer('sweep_rate_bps').notNull().default(1000),
    status: text('status').notNull().default('active'),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('credit_lines_limit_nonneg', sql`${t.limitKobo} >= 0`),
    check('credit_lines_sweep_rate', sql`${t.sweepRateBps} BETWEEN 0 AND 10000`),
    check('credit_lines_status', inList('status', ['active', 'paused'])),
  ],
);

export const drawdowns = pgTable(
  'drawdowns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    traderId: uuid('trader_id')
      .notNull()
      .references(() => traders.id),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    amountKobo: kobo('amount_kobo').notNull(),
    feeKobo: kobo('fee_kobo').notNull().default(sql`0`),
    status: text('status').notNull().default('pending_approval'),
    approvalTokenHash: text('approval_token_hash').notNull().unique(),
    tokenExpiresAt: ts('token_expires_at').notNull(),
    /** Lets a retried WhatsApp delivery return the same drawdown instead of creating a second. */
    clientRequestId: text('client_request_id'),
    providerTransferReference: text('provider_transfer_reference').unique(),
    failureReason: text('failure_reason'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('drawdowns_status', inList('status', DRAWDOWN_STATUSES)),
    check('drawdowns_amount_positive', sql`${t.amountKobo} > 0`),
    check('drawdowns_fee_nonneg', sql`${t.feeKobo} >= 0`),
    unique('drawdowns_trader_client_request').on(t.traderId, t.clientRequestId),
    index('drawdowns_trader_status_idx').on(t.traderId, t.status),
  ],
);

export const debts = pgTable(
  'debts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    traderId: uuid('trader_id')
      .notNull()
      .references(() => traders.id),
    debtorName: text('debtor_name').notNull(),
    debtorPhone: text('debtor_phone'),
    amountKobo: kobo('amount_kobo').notNull(),
    paymentReference: text('payment_reference').notNull().unique(),
    status: text('status').notNull().default('open'),
    createdAt: ts('created_at').notNull().defaultNow(),
    paidAt: ts('paid_at'),
  },
  (t) => [
    check('debts_status', inList('status', DEBT_STATUSES)),
    check('debts_amount_positive', sql`${t.amountKobo} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Integration plumbing
// ---------------------------------------------------------------------------

export const providerEvents = pgTable(
  'provider_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    signatureValid: boolean('signature_valid').notNull(),
    /** Normalised, non-sensitive summary. The raw webhook body is deliberately NOT stored. */
    payloadSummary: jsonb('payload_summary').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    processedAt: ts('processed_at'),
    error: text('error'),
    receivedAt: ts('received_at').notNull().defaultNow(),
  },
  (t) => [unique('provider_events_provider_event').on(t.provider, t.eventId)],
);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: bigint('id', { mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
    traderId: uuid('trader_id').references(() => traders.id),
    type: text('type').notNull(),
    /** bigint amounts are stored as decimal strings (jsonb has no bigint). */
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
    deliveredAt: ts('delivered_at'),
  },
  (t) => [index('outbox_undelivered_idx').on(t.id).where(sql`${t.deliveredAt} IS NULL`)],
);

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type Trader = typeof traders.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type LedgerAccount = typeof ledgerAccounts.$inferSelect;
export type JournalEntryRow = typeof journalEntries.$inferSelect;
export type PostingRow = typeof postings.$inferSelect;
export type CreditLine = typeof creditLines.$inferSelect;
export type Drawdown = typeof drawdowns.$inferSelect;
export type Debt = typeof debts.$inferSelect;
export type ProviderEvent = typeof providerEvents.$inferSelect;
export type OutboxEvent = typeof outboxEvents.$inferSelect;
