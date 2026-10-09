/**
 * Redacting logger. Rule 9: PINs, BVN/NIN, account numbers, keys and raw webhook bodies
 * never reach the logs. Anything logged goes through `redact`.
 */
const SECRET_WORDS = new Set(['pin', 'bvn', 'nin', 'password', 'passcode', 'secret', 'token', 'authorization', 'signature', 'cvv', 'otp']);
const SECRET_JOINED = ['apikey', 'secretkey', 'rawbody', 'privatekey'];
const ACCOUNT_JOINED = ['accountnumber', 'accountno', 'iban'];

/** Splits `pinHash`, `pin_hash` and `PIN-hash` into ['pin','hash'] so we match whole words, not substrings. */
function words(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isSecretKey(key: string): boolean {
  const w = words(key);
  const joined = w.join('');
  return w.some((x) => SECRET_WORDS.has(x)) || SECRET_JOINED.some((j) => joined.includes(j));
}

function isAccountKey(key: string): boolean {
  const joined = words(key).join('');
  return ACCOUNT_JOINED.some((j) => joined.includes(j));
}

export function containsSecretKey(value: unknown, depth = 0): string | null {
  if (depth > 6 || value === null || typeof value !== 'object') return null;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretKey(k) || isAccountKey(k)) return k;
    const nested = containsSecretKey(v, depth + 1);
    if (nested) return nested;
  }
  return null;
}

export function maskAccount(value: string): string {
  return value.length <= 4 ? '****' : `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}

export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value === null || typeof value !== 'object') return value;
  if (depth > 6) return '[depth]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretKey(k)) out[k] = '[redacted]';
    else if (isAccountKey(k)) out[k] = typeof v === 'string' ? maskAccount(v) : '[redacted]';
    else out[k] = redact(v, depth + 1);
  }
  return out;
}

function emit(level: 'info' | 'warn' | 'error', event: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...(redact(fields ?? {}) as object) });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => emit('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit('error', event, fields),
};
