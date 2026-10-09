import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { creditLines, traders, type Trader } from '@/db/schema';
import { createTraderAccounts } from '../ledger/accounts';
import { getConfig } from '../config';
import { getProvider } from '../payments';
import { InvalidInput } from './errors';

/**
 * Accepts +2348012345678, 2348012345678, 08012345678 or "0801 234 5678" (WhatsApp sends the
 * country-code form without "+"). Anything that is not a plausible number is rejected.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[\s\-().]/g, '');
  let e164: string;
  if (/^\+[1-9]\d{7,14}$/.test(digits)) e164 = digits;
  else if (/^234\d{10}$/.test(digits)) e164 = `+${digits}`;
  else if (/^0\d{10}$/.test(digits)) e164 = `+234${digits.slice(1)}`;
  else throw new InvalidInput('Phone number must be a valid Nigerian or international (E.164) number');
  return e164;
}

export const CreateTraderInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().transform((v, ctx) => {
    try {
      return normalizePhone(v);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid phone number' });
      return z.NEVER;
    }
  }),
  businessType: z.string().trim().max(80).optional(),
});
export type CreateTraderInput = z.input<typeof CreateTraderInputSchema>;

export async function getTraderByPhone(phone: string): Promise<Trader | null> {
  const [row] = await getDb().select().from(traders).where(eq(traders.phone, normalizePhone(phone)));
  return row ?? null;
}

/**
 * Creates a trader with her wallet/savings/loan ledger accounts, a zero-limit credit line and a
 * provider virtual account. Idempotent on phone number: calling it again returns the existing trader
 * (so a retried WhatsApp message cannot create a duplicate).
 *
 * The virtual account is requested from the provider first, so we never persist a half-created trader.
 */
export async function createTrader(input: CreateTraderInput): Promise<Trader> {
  const parsed = CreateTraderInputSchema.safeParse(input);
  if (!parsed.success) throw new InvalidInput(parsed.error.issues[0]?.message ?? 'Invalid trader');
  const { name, phone, businessType } = parsed.data;

  const existing = await getTraderByPhone(phone);
  if (existing) return existing;

  const provider = getProvider();
  const account = await provider.createVirtualAccount({ traderId: 'pending', name, phone });
  const sweepRateBps = getConfig().DEFAULT_SWEEP_RATE_BPS;

  try {
    return await getDb().transaction(async (tx) => {
      const [trader] = await tx
        .insert(traders)
        .values({
          name,
          phone,
          businessType: businessType ?? null,
          virtualAccountNumber: account.accountNumber,
          virtualAccountBank: account.bankName,
          providerCustomerId: account.customerId,
        })
        .returning();
      if (!trader) throw new Error('Trader insert returned no row');
      await createTraderAccounts(trader.id, tx);
      // The credit line row doubles as the per-trader money lock, so every trader has one (limit 0 until scored).
      await tx.insert(creditLines).values({ traderId: trader.id, limitKobo: 0n, sweepRateBps });
      return trader;
    });
  } catch (err) {
    // Lost a race with a concurrent create for the same phone: return the winner.
    const winner = await getTraderByPhone(phone);
    if (winner) return winner;
    throw err;
  }
}
