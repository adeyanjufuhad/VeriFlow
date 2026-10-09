import { MoneyError } from '../errors';

export { MoneyError } from '../errors';
export { UnbalancedEntry, InvalidAmount, InvalidEntry, AccountNotFound, TraderNotFound } from '../ledger/errors';

export class InvalidInput extends MoneyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_INPUT', message, details);
  }
}

export class ProviderError extends MoneyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('PROVIDER_ERROR', message, details);
  }
}
