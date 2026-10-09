/** jsonb cannot hold bigint, so bigints are stored as decimal strings. */
export function jsonSafe<T>(value: T): T {
  if (typeof value === 'bigint') return value.toString() as unknown as T;
  if (Array.isArray(value)) return value.map(jsonSafe) as unknown as T;
  if (value instanceof Date) return value.toISOString() as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = jsonSafe(v);
    return out as T;
  }
  return value;
}
