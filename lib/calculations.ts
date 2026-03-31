/**
 * Pure calculation functions — no UI, no side effects, no imports from React.
 *
 * Single Responsibility: this is the only place that contains split math.
 * The screen passes in data and gets back results — it never calculates itself.
 *
 * All functions here are unit-testable without mounting any component.
 */

import type { ExpenseSplit } from './types';

/**
 * Compute an equal split of `total` across `members`.
 *
 * Strategy: floor every share to 2 decimal places, assign the rounding
 * remainder (at most ±0.01 per member) to the first person. This ensures
 * the splits always sum exactly to `total`.
 *
 * Example: ₹100 among 3 → [₹33.34, ₹33.33, ₹33.33]
 */
export function computeEqualSplits(
  total: number,
  members: string[],
): ExpenseSplit[] {
  if (members.length === 0) return [];

  const n    = members.length;
  const base = Math.floor((total * 100) / n) / 100;
  const rem  = Math.round((total - base * n) * 100) / 100;
  const pct  = Math.round((100 / n) * 100) / 100;

  return members.map((person, i) => ({
    person,
    amount:     i === 0 ? Math.round((base + rem) * 100) / 100 : base,
    percentage: pct,
  }));
}

/**
 * Calculate the net financial effect of an expense on a specific user.
 *
 * Positive result → others owe the user (they paid more than their share).
 * Negative result → the user owes others (they underpaid).
 * Zero / null     → the user is not a participant in this expense.
 */
export function calcNetEffect(
  total: number,
  paidBy: string,
  splits: ExpenseSplit[],
  user: string,
): number | null {
  const myShare = splits.find(s => s.person === user);
  if (myShare == null) return null;

  return paidBy === user
    ? total - myShare.amount   // I paid: everyone else owes me
    : -myShare.amount;         // Someone else paid: I owe them my share
}
