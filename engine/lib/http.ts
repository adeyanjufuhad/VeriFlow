import { createHash, timingSafeEqual } from 'node:crypto';
import { ZodError } from 'zod';
import { MoneyError } from './errors';
import { log } from './log';

/** JSON that survives bigint: amounts go out as decimal strings, never floats. */
export function json(data: unknown, init: ResponseInit = {}): Response {
  const body = JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
  return new Response(body, { ...init, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...init.headers } });
}

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_INPUT: 400,
  INVALID_AMOUNT: 400,
  INVALID_ENTRY: 400,
  UNBALANCED_ENTRY: 400,
  TRADER_NOT_FOUND: 404,
  SUPPLIER_NOT_FOUND: 404,
  ACCOUNT_NOT_FOUND: 404,
  TOKEN_INVALID: 404,
  TOKEN_EXPIRED: 410,
  PIN_INVALID: 401,
  PIN_LOCKED: 423,
  PIN_NOT_SET: 409,
  INSUFFICIENT_CREDIT: 409,
  CREDIT_LINE_PAUSED: 409,
  DRAWDOWN_INVALID_STATE: 409,
  PROVIDER_ERROR: 502,
};

/** Maps typed errors to responses. Unknown errors become a generic 500 and are logged without detail leakage. */
export function errorResponse(err: unknown): Response {
  if (err instanceof MoneyError) {
    return json({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } }, { status: STATUS_BY_CODE[err.code] ?? 400 });
  }
  if (err instanceof ZodError) {
    return json({ error: { code: 'INVALID_INPUT', message: err.issues[0]?.message ?? 'Invalid request' } }, { status: 400 });
  }
  log.error('route.unhandled_error', { error: err instanceof Error ? err.message : 'unknown' });
  return json({ error: { code: 'INTERNAL', message: 'Something went wrong' } }, { status: 500 });
}

/** Constant-time string comparison (hashes first so length differences leak nothing). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

function bearer(req: Request): string | null {
  const header = req.headers.get('authorization');
  const match = header ? /^Bearer\s+(.+)$/i.exec(header) : null;
  return match?.[1]?.trim() ?? null;
}

/** True when the request carries `Authorization: Bearer <one of the expected tokens>`. Unset tokens never match. */
export function hasBearer(req: Request, ...expected: (string | undefined)[]): boolean {
  const given = bearer(req);
  if (!given) return false;
  return expected.some((e) => e !== undefined && safeEqual(given, e));
}

export function unauthorized(): Response {
  return json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid credentials' } }, { status: 401 });
}
