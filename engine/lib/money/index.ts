/**
 * AGENT-SAFE SURFACE (rule 8: the AI never moves money).
 *
 * Anything under lib/agents may import ONLY from here. It exports reads and requests, never a function
 * that posts to the ledger or sends a transfer. Privileged functions live in ./internal.
 * An ESLint rule and a test enforce this.
 */
export { getBalances, getStatement, type Balances, type StatementLine } from '../ledger';
export { createTrader, getTraderByPhone, normalizePhone } from './traders';
export { formatNaira, nairaToKobo, parseKobo } from './kobo';
export { fetchUndeliveredOutbox, markOutboxDelivered, OUTBOX_EVENT_TYPES, type OutboxEventDto } from './outbox';
export { MoneyError } from '../errors';
