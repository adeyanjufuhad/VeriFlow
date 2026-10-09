/**
 * Provider-agnostic payment layer. The money engine only ever talks to this interface, so Paystack,
 * Flutterwave or the mock can be swapped with PAYMENT_PROVIDER.
 */

export type VirtualAccountRequest = { traderId: string; name: string; phone: string };
export type VirtualAccount = { accountNumber: string; bankName: string; customerId: string };

export type TransferRecipientRequest = { supplierId: string; name: string; bankCode: string; accountNumber: string };
export type TransferRecipient = { recipientCode: string };

export type TransferRequest = { recipientCode: string; amountKobo: bigint; reference: string; reason: string };
export type TransferInitiation = { reference: string; status: string };

/** What every webhook is reduced to before the engine looks at it. Contains no raw payload. */
export type NormalizedProviderEvent =
  | {
      type: 'charge.success';
      provider: string;
      eventId: string;
      amountKobo: bigint;
      /** The customer virtual account that received the money. */
      virtualAccountNumber: string | null;
      /** Our own reference (e.g. a debt payment link reference), when the payment came through one. */
      reference: string | null;
      payerName: string | null;
      paidAt: Date;
    }
  | {
      type: 'transfer.success' | 'transfer.failed' | 'transfer.reversed';
      provider: string;
      eventId: string;
      transferReference: string;
      reason: string | null;
    }
  | { type: 'ignored'; provider: string; eventId: string; rawType: string };

export interface PaymentProvider {
  readonly name: string;
  createVirtualAccount(trader: VirtualAccountRequest): Promise<VirtualAccount>;
  createTransferRecipient(supplier: TransferRecipientRequest): Promise<TransferRecipient>;
  initiateTransfer(input: TransferRequest): Promise<TransferInitiation>;
  /** Must verify against the RAW request body, before any JSON parsing. */
  verifyWebhook(rawBody: string, headers: Headers): boolean;
  parseWebhook(rawBody: string): NormalizedProviderEvent;
}
