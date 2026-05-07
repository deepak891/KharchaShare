# Frontend Architecture Guide

> **Audience:** You know JavaScript/TypeScript basics but you are new to React Native and new to KharchaShare. This guide explains the mental model so you can find your way around without reading every file.

---

## 1. The Big Picture

KharchaShare is split into two completely separate processes:

```
┌─────────────────────────────────────────────────────────────────┐
│  Your Phone (React Native / Expo)                               │
│                                                                 │
│  Screen (TSX)  →  Hook (TS)  →  lib/api.ts  ──► FastAPI        │
│      ↑                                           (Python)       │
│  user taps                     HTTP/JSON ◄──────                │
└─────────────────────────────────────────────────────────────────┘
```

**The golden rule:** The React Native app is a UI shell. It displays data and calls the backend. All business logic — splitting algorithms, balance calculations, debt minimization — lives in the Python backend. The frontend never does math on expense data; it asks the backend and renders the answer.

---

## 2. How Screens Work

KharchaShare uses **Expo Router**, which works like Next.js: the file path in `app/` becomes the route. You never write `navigation.navigate(...)` manually.

```
app/
├── _layout.tsx          ← root Stack, registers all screens
├── group-create.tsx     ← /group-create  (modal: create new group)
├── group-detail.tsx     ← /group-detail  (expenses + debts for one group)
├── expense-add.tsx      ← /expense-add   (add or edit an expense)
└── (tabs)/              ← bottom tab bar (parentheses = layout group, not in URL)
    ├── _layout.tsx      ← tab bar configuration
    ├── index.tsx        ← / (home: group list + net balance)
    ├── expenses.tsx     ← /expenses (AI expense input)
    ├── settle.tsx       ← /settle (who owes whom, settle up)
    └── profile.tsx      ← /profile (user settings)
```

### Navigating to a screen

```tsx
// Push a new screen (back button appears)
router.push({ pathname: '/group-detail', params: { id: group.id, name: group.name } });

// Read params inside the target screen
const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
```

Params are always strings — parse numbers with `parseInt`/`parseFloat` at the destination.

---

## 3. The Data Layer

There are three layers between a screen and the network:

### Layer 1 — `lib/api.ts` (HTTP client)
The single source of truth for every HTTP call. Never call `fetch()` directly from a screen or hook — always go through a function in `lib/api.ts`.

```ts
// lib/api.ts — each function is one API call
export async function fetchGroups(user: string): Promise<Group[]> { ... }
export async function createExpense(groupId: string, payload: CreateExpenseRequest): Promise<Expense> { ... }
```

If the base URL ever changes (e.g. moving from localhost to a VPS), you change it in exactly one place: the `API_BASE` constant at the top of `lib/api.ts`.

### Layer 2 — `hooks/` (async state management)
Hooks are the only place `useState`, `useEffect`, and `useFocusEffect` live. A hook fetches data, tracks loading/error state, and exposes a clean interface to the screen.

```ts
// hooks/useGroups.ts
export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => { ... }, []);

  return { groups, isLoading, error, reload };
}
```

Each hook corresponds to a screen or a logical data domain. The screen just calls the hook — it doesn't know about `fetch` at all.

### Layer 3 — Screens
Screens call hooks, render the result, and handle user interactions by calling back into the hook or navigating.

```tsx
// A screen in one sentence:
const { groups, isLoading, error, reload } = useGroups();
// render groups, show ScreenState for loading/error/empty
```

---

## 4. Shared Components

Before writing any inline JSX, check if a component already exists. The components in `components/` cover the most repeated patterns:

| Component | What it renders | When to use |
|-----------|----------------|-------------|
| `AvatarCircle` | Circular avatar with initials | Any time you display a person (debt rows, split preview, etc.) |
| `BalanceBadge` | Coloured pill showing an amount (green/red/grey) | Any amount that is positive = owed-to-you, negative = you-owe |
| `ScreenState` | Loading spinner / error with retry / empty state | Every screen's loading and error branches |
| `MemberChip` | Selectable chip for a group member name | "Paid by" selectors, member lists |
| `GroupCard` | Full group list item (emoji, name, balance) | Group list on the home screen |
| `ExpenseCard` | Expense list item (description, amount, payer) | Expense lists inside group detail |

### Using `ScreenState` (replaces ~20 lines of boilerplate)

```tsx
{isLoading ? (
  <ScreenState variant="loading" message="Fetching expenses…" />
) : error != null ? (
  <ScreenState variant="error" message={error} onRetry={reload} />
) : expenses.length === 0 ? (
  <ScreenState variant="empty" emoji="🧾" title="No expenses yet" message="Tap + to add one" />
) : (
  expenses.map(e => <ExpenseCard key={e.id} expense={e} />)
)}
```

### Using `AvatarCircle`

```tsx
<AvatarCircle name="Priya" />                          // default: size=36, indigo
<AvatarCircle name="Raj" size={28} />                  // smaller
<AvatarCircle name="Dev" bg="#FEE2E2" fg={COLORS.danger} /> // red (owes money)
```

---

## 5. Utility Libraries

Screens never hard-code currency symbols, do date arithmetic, or build UPI URLs. Those responsibilities live in dedicated files:

### `lib/formatting.ts` — all display strings
```ts
formatCurrency(1200)        // "₹1,200"
formatCurrencySigned(-450)  // "-₹450"
formatCurrencySigned(800)   // "+₹800"
formatDate("2024-04-17T...")// "17 Apr"
getAvatarLetter("Priya")    // "P"
```

### `lib/calculations.ts` — all math
```ts
// Splits ₹900 equally among 3 members
computeEqualSplits(900, ["Deepak", "Priya", "Raj"])
// → [{ person: "Deepak", amount: 300 }, ...]

// How much does the current user net from one expense?
// Positive = they overpaid (others owe them), negative = they underpaid (owe payer), null = not involved
calcNetEffect(total, paidBy, splits, currentUser)
```

### `lib/upi.ts` — payment actions
```ts
openUPIPayment("Priya", 300, "Goa Trip")  // opens UPI app or share sheet
sendPaymentReminder("Raj", 500, "Goa Trip") // opens share sheet with pre-written message
```

### `lib/theme.ts` — design tokens
```ts
COLORS.primary      // #5B5FEF  indigo (buttons, active states)
COLORS.success      // #22C55E  green  (owed to you)
COLORS.danger       // #EF4444  red    (you owe)
COLORS.background   // #F8F9FA  screen background
COLORS.card         // #FFFFFF  card background
RADIUS.sm / lg / xl // border-radius values
SHADOW.card / elevated  // box shadow presets
```

Never write a raw hex colour or border-radius number in a screen. Use these tokens so the whole app recolours from one file.

---

## 6. Design System

Every screen follows the same visual language:

- **Background:** `COLORS.background` (`#F8F9FA`) — light grey, never pure white
- **Cards:** `COLORS.card` white, `RADIUS.lg` (16px), `SHADOW.card`
- **Primary action:** `COLORS.primary` indigo, `RADIUS.lg`, `SHADOW.elevated`
- **Balance colours:** `COLORS.success` when you are owed money, `COLORS.danger` when you owe
- **Typography:** `fontWeight: '800'` for hero numbers, `'700'` for headings, `'600'` for labels, `'500'` for body

For a new screen: copy the `safeArea + ScrollView + scrollContent` scaffold from any existing screen (`index.tsx` is the cleanest example), then build inside it.

---

## 7. SOLID Principles in This Codebase

These aren't abstract principles — here is where each one shows up:

**Single Responsibility** — Every file does one thing. `lib/formatting.ts` only formats strings. `lib/upi.ts` only deals with payment intents. `useGroups.ts` only manages the groups list. If you find yourself importing `formatCurrency` from a screen file, something went wrong.

**Open/Closed** — `ScreenState` handles three variants (`loading`, `error`, `empty`) through props. Adding a fourth variant (e.g. `offline`) means adding a new branch inside `ScreenState.tsx`, not touching any of the screens that use it.

**Liskov Substitution** — `MemberChip` works identically whether `onSelect` is provided (interactive) or omitted (read-only). The caller doesn't need to know which mode it's in — the component handles it internally.

**Interface Segregation** — Components expose only the props they need. `AvatarCircle` takes `name`, optional `size`, optional `bg`/`fg`. It does not take an `onPress` (that's the caller's job), a `style` override, or any data-fetching props.

**Dependency Inversion** — Screens depend on hooks, not on `lib/api.ts` directly. Hooks depend on `lib/api.ts`, not on `fetch`. If you swap the HTTP client for GraphQL tomorrow, you change `lib/api.ts` and the hooks; no screen file changes.

---

## 8. Common Patterns

### Refresh on screen focus
Every list screen reloads its data when the user navigates back to it:
```ts
useFocusEffect(useCallback(() => { reload(); }, [reload]));
```
This is how the home screen picks up a newly-created group without any global state.

### Optimistic-style settle
"Mark Settled" posts to the backend, then calls `reload()`. No local state mutation — the backend is the source of truth and the screen re-renders from the fresh response.

### Params as JSON strings
React Native route params are strings. Arrays and objects are passed as `JSON.stringify(members)` and parsed with `JSON.parse` at the destination. Example in `group-detail.tsx` → `expense-add.tsx`.

### Avoid inline business logic
If you find yourself writing `amount / members.length` in a screen, extract it to `lib/calculations.ts`. If you find yourself building a string like `₹${amount.toFixed(0)}`, use `formatCurrency`.

---

## 9. Adding a New Feature: Checklist

Run the `/add-feature` slash command in Claude Code for a step-by-step guide. The short version:

1. Add the endpoint to the Python backend (`backend/api/routes/`)
2. Add the TypeScript type to `lib/types.ts`
3. Add the API function to `lib/api.ts`
4. Create or extend a hook in `hooks/`
5. Build the screen in `app/` using existing components and utilities
6. Register the route in `app/_layout.tsx` if it's a new screen
7. Update `docs/FEATURES.md` to mark the feature implemented

---

## Where to Go Next

| Goal | File |
|------|------|
| Understand every implemented feature | `docs/FEATURES.md` |
| Understand technology choices and trade-offs | `docs/ADR.md` |
| See how a button click flows to the database | `docs/FLOWS.md` |
| See all TypeScript types | `lib/types.ts` |
| See all HTTP calls | `lib/api.ts` |
| Run the backend | `CLAUDE.md` → Quick Start |
