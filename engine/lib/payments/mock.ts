import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ProviderError } from '../money/errors';
import type {
  NormalizedProviderEvent,
  PaymentProvider,
  TransferInitiation,
  TransferRecipient,
  TransferRecipientRequest,
  TransferRequest,
  VirtualAccount,
  VirtualAccountRequest,
} from './types';

export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

/** Hex HMAC-SHA512 of the raw body: the same scheme Paystack uses, so tests exercise real verification. */
export function signMockBody(rawBody: string, secret: string): string {
  return createHmac('sha512', secret).update(rawBody).digest('hex');
}

const digest = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Deterministic, no-network provider for tests, the demo backup and local development.
 * Webhook bodies use a Paystack-like shape: { event, data: { id, amount, ... } }.
 */
export class MockProvider implements PaymentProvider {
  readonly name = 'mock';
  /** Test hook: reference -> outcome used by later phases when simulating transfers. */
  readonly transfers = new Map<string, TransferRequest>();

  constructor(private readonly webhookSecret: string) {}

  async createVirtualAccount(trader: VirtualAccountRequest): Promise<VirtualAccount> {
    const hex = digest(`va:${trader.phone}`);
    // 10 digits starting with 9 so it never looks like a real NUBAN by accident.
    const accountNumber = `9${(BigInt(`0x${hex.slice(0, 12)}`) % 1_000_000_000n).toString().padStart(9, '0')}`;
    return { accountNumber, bankName: 'Mock Test Bank', customerId: `mock_cus_${hex.slice(0, 10)}` };
  }

  async createTransferRecipient(supplier: TransferRecipientRequest): Promise<TransferRecipient> {
    return { recipientCode: `mock_rcp_${digest(`${supplier.bankCode}:${supplier.accountNumber}`).slice(0, 12)}` };
  }

  async initiateTransfer(input: TransferRequest): Promise<TransferInitiation> {
    if (input.amountKobo <= 0n) throw new ProviderError('Transfer amount must be positive');
    this.transfers.set(input.reference, input);
    return { reference: input.reference, status: 'pending' };
  }

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    const given = headers.get(MOCK_SIGNATURE_HEADER);
    if (!given) return false;
    const expected = signMockBody(rawBody, this.webhookSecret);
    const a = Buffer.from(given, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseWebhook(rawBody: string): NormalizedProviderEvent {
    return parsePaystackLikeEvent(this.name, rawBody);
  }
}

type LooseEvent = {
  event?: unknown;
  data?: {
    id?: unknown;
    reference?: unknown;
    amount?: unknown;
    currency?: unknown;
    paid_at?: unknown;
    reason?: unknown;
    transfer_code?: unknown;
    dedicated_account?: { account_number?: unknown } | null;
    authorization?: { receiver_bank_account_number?: unknown } | null;
    customer?: { first_name?: unknown; last_name?: unknown } | null;
    metadata?: { payer_name?: unknown; virtual_account_number?: unknown } | null;
  };
};

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : typeof v === 'number' ? String(v) : null);

/** Shared by the mock and (in Phase 3) Paystack: both speak the same event envelope. */
export function parsePaystackLikeEvent(provider: string, rawBody: string): NormalizedProviderEvent {
  let body: LooseEvent;
  try {
    body = JSON.parse(rawBody) as LooseEvent;
  } catch {
    throw new ProviderError('Webhook body is not valid JSON');
  }
  const rawType = typeof body.event === 'string' ? body.event : 'unknown';
  const data = body.data ?? {};
  const id = str(data.id) ?? str(data.reference);
  if (!id) throw new ProviderError('Webhook event has no id or reference');
  const eventId = `${rawType}:${id}`;

  if (rawType === 'charge.success') {
    const amount = data.amount;
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
      throw new ProviderError('charge.success has an invalid amount');
    }
    if (data.currency !== undefined && data.currency !== 'NGN') {
      return { type: 'ignored', provider, eventId, rawType: `${rawType}:${String(data.currency)}` };
    }
    const payerName =
      str(data.metadata?.payer_name) ??
      ([str(data.customer?.first_name), str(data.customer?.last_name)].filter(Boolean).join(' ') || null);
    const paidAtRaw = str(data.paid_at);
    const paidAt = paidAtRaw && !Number.isNaN(Date.parse(paidAtRaw)) ? new Date(paidAtRaw) : new Date();
    return {
      type: 'charge.success',
      provider,
      eventId,
      amountKobo: BigInt(amount),
      virtualAccountNumber:
        str(data.dedicated_account?.account_number) ??
        str(data.authorization?.receiver_bank_account_number) ??
        str(data.metadata?.virtual_account_number),
      reference: str(data.reference),
      payerName,
      paidAt,
    };
  }

  if (rawType === 'transfer.success' || rawType === 'transfer.failed' || rawType === 'transfer.reversed') {
    const transferReference = str(data.reference);
    if (!transferReference) throw new ProviderError('Transfer event has no reference');
    return { type: rawType, provider, eventId, transferReference, reason: str(data.reason) };
  }

  return { type: 'ignored', provider, eventId, rawType };
}
