/** Join class names, skipping falsy values. */
export function cn(...parts) {
  return parts.flat().filter(Boolean).join(' ');
}

/** Shared keyboard focus ring for interactive elements. */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';

/** Format a number as Ethiopian Birr, e.g. 1234.5 → "ETB 1,234.50". */
export function formatETB(value, { decimals = 2 } = {}) {
  const n = Number(value) || 0;
  return `ETB ${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
