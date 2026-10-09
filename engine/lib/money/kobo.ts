import { InvalidAmount } from '../ledger/errors';

/**
 * Money is integer kobo everywhere. Naira appears only at the edges:
 * parsing user/API input and formatting for display.
 */

/** "5,000", "₦1,234.57", "0.5" -> kobo. At most 2 decimal places; never goes through a float. */
export function nairaToKobo(input: string): bigint {
  const cleaned = input.trim().replace(/^₦/, '').replace(/,/g, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) throw new InvalidAmount(`Not a valid naira amount: "${input}"`);
  const whole = BigInt(match[1]!);
  const fraction = BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  return whole * 100n + fraction;
}

/** 123457n -> "₦1,234.57" (always two decimals). */
export function formatNaira(kobo: bigint): string {
  const negative = kobo < 0n;
  const abs = negative ? -kobo : kobo;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}₦${whole}.${fraction}`;
}

/** Accepts a decimal string or a safe integer (JSON bodies); rejects floats, negatives and junk. */
export function parseKobo(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new InvalidAmount('Amount must be a whole number of kobo');
    return BigInt(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return BigInt(value.trim());
  throw new InvalidAmount('Amount must be a whole number of kobo');
}
