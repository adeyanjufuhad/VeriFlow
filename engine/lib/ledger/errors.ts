import { MoneyError } from '../errors';

export class UnbalancedEntry extends MoneyError {
  constructor(debitsKobo: bigint, creditsKobo: bigint) {
    super('UNBALANCED_ENTRY', 'Debits must equal credits', {
      debitsKobo: debitsKobo.toString(),
      creditsKobo: creditsKobo.toString(),
    });
  }
}

export class InvalidAmount extends MoneyError {
  constructor(message = 'Amount must be a positive whole number of kobo') {
    super('INVALID_AMOUNT', message);
  }
}

export class InvalidEntry extends MoneyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_ENTRY', message, details);
  }
}

export class AccountNotFound extends MoneyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('ACCOUNT_NOT_FOUND', message, details);
  }
}

export class TraderNotFound extends MoneyError {
  constructor() {
    super('TRADER_NOT_FOUND', 'Trader not found');
  }
}
