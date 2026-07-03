/**
 * Shared normalizers for API response fields that are inconsistently shaped —
 * sometimes a plain string, sometimes a relation object like
 * { id, name, slug }. Several screens (sports list, match detail, match
 * alerts) each independently reimplemented this "unwrap the object" check,
 * and a couple of them missed it entirely, causing crashes like
 * `TypeError: match.sport.charAt is not a function` after admin added a new
 * Sports match. Route every read of one of these fields through here instead
 * of inlining `typeof x === 'object' ? x?.name : x` again.
 */

/**
 * Extracts a display name from a field that the API may return either as a
 * plain string or as a relation object (`{ id, name, slug }`, `{ name }`,
 * etc). Falls back to `fallback` (default `''`) when the value is missing,
 * an object without a `name`, or any other unexpected shape.
 */
export function normalizeName(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as any).name === 'string') {
    return (value as any).name;
  }
  return fallback;
}

/**
 * Same as normalizeName, but also capitalizes the first letter and
 * lowercases the rest — the common case for sport labels ("CRICKET" /
 * "cricket" -> "Cricket").
 */
export function normalizeCapitalized(value: unknown, fallback = ''): string {
  const name = normalizeName(value, fallback);
  if (!name) return fallback;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
