/**
 * Shared TypeScript types for KharchaShare.
 *
 * All domain types live here. lib/api.ts imports from here — never the other
 * way around. Screens and components also import from here directly.
 */

// ── Expense parsing ──────────────────────────────────────────────────────────

export interface PersonSplit {
  person: string;
  amount: number;
  percentage: number;
}

export interface ParsedExpense {
  description: string;
  total: number;
  currency: string;
  paid_by: string | null;
  splits: PersonSplit[];
  notes: string;
  /** 0–1. < 0.6 means AI wasn't confident (e.g. total was ambiguous). */
  confidence: number;
}

// ── Groups ───────────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  emoji: string;
  /** Hex colour used as the emoji background on GroupCard. */
  color: string;
  members: string[];
  /** ISO 8601 datetime string from the backend. */
  created_at: string;
  /** Positive = owed to you, negative = you owe. */
  net_balance: number;
  /** True only when the group has expenses and every member's balance is zero. */
  is_settled: boolean;
}

export interface CreateGroupRequest {
  name: string;
  emoji: string;
  color: string;
  members: string[];
}

export interface AddMemberRequest {
  member: string;
  /** true = recalculate all past splits equally with new member included */
  redistribute_past: boolean;
}

// ── Expenses ─────────────────────────────────────────────────────────────────

export interface ExpenseSplit {
  person: string;
  amount: number;
  percentage: number;
}

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  total: number;
  currency: string;
  paid_by: string;
  splits: ExpenseSplit[];
  notes: string;
  created_at: string;
}

export interface CreateExpenseRequest {
  description: string;
  total: number;
  currency: string;
  paid_by: string;
  splits: ExpenseSplit[];
  notes?: string;
}

/** Positive net = owed to this person. Negative = this person owes. */
export interface MemberBalance {
  person: string;
  net: number;
}

/** A single settlement transaction: from_person owes to_person this amount. */
export interface Debt {
  from_person: string;
  to_person: string;
  amount: number;
}

/** Request body to manually mark a debt as settled. */
export interface SettleDebtRequest {
  from_person: string;
  to_person: string;
  amount: number;
}
