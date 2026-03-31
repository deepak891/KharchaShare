/**
 * Formatting utilities — pure functions with no side effects.
 *
 * Single Responsibility: this is the only place in the codebase that knows
 * how to turn raw values (numbers, dates, names) into display strings.
 * Screens and components import from here; they never call toLocaleString
 * or Date constructors directly.
 *
 * Design pattern — Strategy: callers pass a value and get a string back.
 * If the locale or currency symbol ever changes, only this file changes.
 */

/**
 * Format a rupee amount for display.
 *
 * Examples:
 *   formatCurrency(1200)     → "₹1,200"
 *   formatCurrency(1200.5)   → "₹1,200.50"
 *   formatCurrency(0)        → "₹0"
 */
export function formatCurrency(amount: number): string {
  return (
    '₹' +
    Math.abs(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Format a rupee amount with an explicit sign prefix.
 *
 * Examples:
 *   formatCurrencySigned(1200)   → "+₹1,200"
 *   formatCurrencySigned(-450)   → "-₹450"
 *   formatCurrencySigned(0)      → "₹0"
 */
export function formatCurrencySigned(amount: number): string {
  if (amount === 0) return formatCurrency(0);
  return (amount > 0 ? '+' : '-') + formatCurrency(Math.abs(amount));
}

/**
 * Format an ISO 8601 date string for compact display.
 *
 * Example: "2026-04-19T07:15:32.644388" → "19 Apr"
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Extract the first letter of a name for use in an avatar circle.
 *
 * Example: "Deepak" → "D",  "" → "?"
 */
export function getAvatarLetter(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}
