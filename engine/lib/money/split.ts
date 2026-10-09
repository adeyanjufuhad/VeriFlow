import { InvalidAmount } from '../ledger/errors';

export type Split = { loanShareKobo: bigint; walletShareKobo: bigint };

/**
 * loan_share = min(floor(amount * sweepRateBps / 10000), loanOutstanding); the rest goes to the wallet.
 * Integer maths only (bigint division floors for non-negative values), so no kobo is ever created or lost:
 * loanShare + walletShare === amount.
 */
export function computeSplit(amountKobo: bigint, sweepRateBps: number, loanOutstandingKobo: bigint): Split {
  if (amountKobo <= 0n) throw new InvalidAmount();
  if (!Number.isInteger(sweepRateBps) || sweepRateBps < 0 || sweepRateBps > 10_000) {
    throw new InvalidAmount('sweepRateBps must be an integer between 0 and 10000');
  }
  const outstanding = loanOutstandingKobo > 0n ? loanOutstandingKobo : 0n;
  const share = (amountKobo * BigInt(sweepRateBps)) / 10_000n;
  const loanShareKobo = share < outstanding ? share : outstanding;
  return { loanShareKobo, walletShareKobo: amountKobo - loanShareKobo };
}
