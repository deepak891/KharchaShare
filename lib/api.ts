/**
 * KharchaShare API client — HTTP transport only.
 *
 * Types live in lib/types.ts.  This file is the single place that knows
 * the backend base URL and the wire format for each endpoint.
 *
 * API_BASE is resolved at runtime:
 *   - Android Emulator  → http://10.0.2.2:8000  (special loopback alias)
 *   - Browser / web     → http://localhost:8000
 *   - Physical device / iOS Simulator (LAN mode)
 *       → uses the same host as the Expo dev server (e.g. http://192.168.29.45:8000)
 *         so the device automatically reaches the backend on your machine.
 */

import Constants from "expo-constants";
import { Platform } from "react-native";
import { MOCK_USER_NAME } from "./constants";
import type {
  AddMemberRequest,
  CreateExpenseRequest,
  CreateGroupRequest,
  Debt,
  Expense,
  Group,
  MemberBalance,
  ParsedExpense,
  PersonSplit,
  SettleDebtRequest,
} from "./types";

function resolveApiHost(): string {
  if (Platform.OS === "android") {
    // Android emulator routes host machine loopback via this alias.
    return "10.0.2.2";
  }
  if (Platform.OS === "web") {
    // Use the same hostname the browser loaded the page from.
    // - Expo served from localhost:8081  → use 127.0.0.1 (NOT 'localhost')
    //   Chrome on Windows resolves 'localhost' to ::1 (IPv6), but Docker only
    //   binds to 0.0.0.0 (IPv4). Using 127.0.0.1 forces IPv4 and avoids
    //   ERR_CONNECTION_REFUSED / ERR_CONNECTION_RESET in Chrome.
    // - Expo served from 192.168.x.x:8081 → use that LAN IP directly.
    if (typeof window === "undefined") return "127.0.0.1";
    const h = window.location.hostname;
    return h === "localhost" ? "127.0.0.1" : h;
  }
  // Physical device or iOS Simulator running via Expo LAN mode.
  // Constants.expoConfig.hostUri = "192.168.29.45:8081" (Expo dev server).
  // Strip the port and reuse the host — the backend runs on the same machine.
  const expoHost = Constants.expoConfig?.hostUri?.split(":")[0];
  return expoHost ?? "localhost";
}

export const API_BASE = `http://${resolveApiHost()}:8000`;
console.log("[API] base:", API_BASE);

// ── Error normalisation ───────────────────────────────────────────────────────

/**
 * Convert any caught error into a user-facing message string.
 *
 * Rules:
 *  - Network / fetch failure (backend unreachable)  → friendly "back soon" copy
 *  - Server 5xx detail string                       → generic "something went wrong"
 *  - Everything else (validation errors, 4xx)       → pass the detail through as-is
 *    because those messages are intentional and relevant to the user.
 */
export function toUserMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  // Network failure — backend is down, restarting, or not yet reachable.
  if (
    raw.toLowerCase().includes("network request failed") ||
    raw.toLowerCase().includes("failed to fetch") ||
    raw.toLowerCase().includes("typeerror: failed") ||
    raw.toLowerCase().includes("fetch")
  ) {
    return "We're getting things ready — please try again in a moment.";
  }

  // Generic server crash (detail may be a Python traceback or internal message).
  if (
    raw.toLowerCase().startsWith("internal server error") ||
    raw.startsWith("HTTP 5")
  ) {
    return "Something went wrong on our end. Please try again.";
  }

  return raw;
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── API calls ────────────────────────────────────────────────────────────────

/**
 * Send free-text to the AI expense parser.
 *
 * Example:
 *   parseExpense(
 *     "We had dinner, total 3200, Raj didn't have drinks, split accordingly",
 *     ["Deepak", "Raj", "Priya"]
 *   )
 */
export async function parseExpense(
  text: string,
  participants: string[],
): Promise<ParsedExpense> {
  return post<ParsedExpense>("/api/parse-expense", { text, participants });
}

/** Simple equal split — pure math on the backend, no AI. */
export async function splitEqual(
  total: number,
  participants: string[],
): Promise<PersonSplit[]> {
  return post<PersonSplit[]>("/api/split/equal", { total, participants });
}

/** Create a new expense group. */
export async function createGroup(req: CreateGroupRequest): Promise<Group> {
  return post<Group>("/api/groups", req);
}

/** Add a new member to a group; optionally redistribute all past expense splits equally. */
export async function addGroupMember(
  groupId: string,
  req: AddMemberRequest,
): Promise<Group> {
  return post<Group>(`/api/groups/${groupId}/members`, req);
}

/** Fetch all groups, newest first, with net_balance for the current user. */
export async function getGroups(): Promise<Group[]> {
  return get<Group[]>(`/api/groups?user=${encodeURIComponent(MOCK_USER_NAME)}`);
}

// ── Group expense API ────────────────────────────────────────────────────────

/** Add an expense to a group (splits must be pre-computed). */
export async function createExpense(
  groupId: string,
  req: CreateExpenseRequest,
): Promise<Expense> {
  return post<Expense>(`/api/groups/${groupId}/expenses`, req);
}

/** Update an existing expense. Balances and debts recalculate automatically. */
export async function updateExpense(
  groupId: string,
  expenseId: string,
  req: CreateExpenseRequest,
): Promise<Expense> {
  const res = await fetch(
    `${API_BASE}/api/groups/${groupId}/expenses/${expenseId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<Expense>;
}

/** Fetch all expenses for a group, newest first. */
export async function getGroupExpenses(groupId: string): Promise<Expense[]> {
  return get<Expense[]>(`/api/groups/${groupId}/expenses`);
}

/** Per-member net balances for a group. */
export async function getGroupBalances(
  groupId: string,
): Promise<MemberBalance[]> {
  return get<MemberBalance[]>(`/api/groups/${groupId}/balances`);
}

/** Minimum transactions to settle all debts in a group. */
export async function getGroupDebts(groupId: string): Promise<Debt[]> {
  return get<Debt[]>(`/api/groups/${groupId}/debts`);
}

/** Record a manual settlement: from_person pays to_person the given amount. */
export async function settleDebt(
  groupId: string,
  req: SettleDebtRequest,
): Promise<Expense> {
  return post<Expense>(`/api/groups/${groupId}/settle`, req);
}

/** Health check — tells the UI whether the backend is reachable. */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
