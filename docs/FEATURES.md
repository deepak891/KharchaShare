# KharchaShare — Feature Registry

Living document. Update this whenever a feature is added, changed, or removed.
Read this first at the start of any session — it replaces a full codebase scan.

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented and working |
| 🚧 | Partially implemented / placeholder |
| 📋 | Planned — not started |

---

## Backend API — All Endpoints

Base URL: `http://localhost:8000`  
Interactive docs: `http://localhost:8000/docs`

### Meta
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `GET` | `/health` | ✅ | Returns `status`, `model`, `ollama_host` |

### Groups — `backend/api/routes/groups.py`
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/api/groups` | ✅ | Create group; validates name + members |
| `GET`  | `/api/groups?user=Deepak` | ✅ | List all groups newest-first; `net_balance` + `is_settled` computed per-group |
| `POST` | `/api/groups/{id}/members` | ✅ | Add member; optional `redistribute_past` flag recalculates all past splits equally |

### Group Expenses — `backend/api/routes/group_expenses.py`
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/api/groups/{id}/expenses` | ✅ | Add expense; caller pre-computes splits |
| `PUT`  | `/api/groups/{id}/expenses/{expId}` | ✅ | Update expense; balances/debts auto-recalculate |
| `GET`  | `/api/groups/{id}/expenses` | ✅ | List expenses newest-first |
| `GET`  | `/api/groups/{id}/balances` | ✅ | Per-member net balance (+ = owed, − = owes) |
| `GET`  | `/api/groups/{id}/debts`    | ✅ | Minimum transactions to settle all debts |
| `POST` | `/api/groups/{id}/settle`   | ✅ | Record manual settlement as synthetic expense; zeroes both parties' balance |

### Expense Parsing — `backend/api/routes/expenses.py`
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/api/parse-expense` | ✅ | Free-text → structured split via Ollama/qwen2.5:7b |
| `POST` | `/api/parse-voice`   | 🚧 | 501 placeholder; voice → text → parse planned |

### Splits — `backend/api/routes/splits.py`
| Method | Path | Status | Notes |
|--------|------|--------|-------|
| `POST` | `/api/split/equal` | ✅ | Pure-math equal split, no AI |

---

## Backend Services & Data Models

### Schemas — `backend/models/schemas.py`

```
ParseExpenseRequest  text + participants[]
ParsedExpense        description, total, currency, paid_by, splits[], notes, confidence
SplitResult          person, amount, percentage

CreateGroupRequest   name, emoji, color, members[]
Group                id, name, emoji, color, members[], created_at, net_balance, is_settled
AddMemberRequest     member, redistribute_past (bool)

ExpenseSplit         person, amount, percentage
Expense              id, group_id, description, total, currency, paid_by, splits[], notes, created_at
CreateExpenseRequest description, total, currency, paid_by, splits[], notes
MemberBalance        person, net
Debt                 from_person, to_person, amount
SettleDebtRequest    from_person, to_person, amount

EqualSplitRequest    total, participants[], paid_by?
```

### Service Protocols — `backend/services/interfaces.py`

```
ExpenseParserProtocol
  parse(text, participants) → ParsedExpense

SplitStrategyProtocol
  calculate(total, participants, **kwargs) → list[SplitResult]

GroupRepositoryProtocol
  create(req) → Group
  list_all()  → list[Group]
  get(group_id) → Group | None
  add_member(group_id, member) → Group | None

ExpenseRepositoryProtocol
  create(group_id, req) → Expense
  update(expense_id, req) → Expense | None
  list_by_group(group_id) → list[Expense]
  get_balances(group_id) → list[MemberBalance]
  get_debts(group_id) → list[Debt]
  get_user_net_balance(group_id, user) → float
  redistribute_expenses(group_id, members) → None
  settle_debt(group_id, req: SettleDebtRequest) → Expense
```

### Implementations

| Protocol | Implementation | File |
|----------|---------------|------|
| `ExpenseParserProtocol` | `OllamaExpenseParser` | `services/expense_parser.py` |
| `SplitStrategyProtocol` | `EqualSplitStrategy`, `PercentageSplitStrategy`, `ExclusionSplitStrategy` | `services/split_calculator.py` |
| `GroupRepositoryProtocol` | `InMemoryGroupRepository` | `services/group_repository.py` |
| `ExpenseRepositoryProtocol` | `InMemoryExpenseRepository` | `services/expense_repository.py` |

> **Persistence:** Both repositories are in-memory (dict). Data resets on container restart.  
> **Next step:** Swap with SQLite (local dev) / PostgreSQL (production) — see `docs/ADR.md` ADR-005.  
> Only `backend/api/dependencies.py` changes; all route handlers are unaffected.

### Settlement Mechanism

A manual settlement is stored as a synthetic expense:
```
paid_by = from_person
splits  = [{from_person: amount=0}, {to_person: amount=X}]

Effect on balances:
  from_person.net += total − 0   →  was −X, now 0
  to_person.net   −= X           →  was +X, now 0
```

### Dependency Injection — `backend/api/dependencies.py`

```python
_group_repository   = InMemoryGroupRepository()   # module-level singleton
_expense_repository = InMemoryExpenseRepository()  # module-level singleton

get_expense_parser()       → new OllamaExpenseParser per request (stateless)
get_equal_split_strategy() → new EqualSplitStrategy per request (stateless)
get_group_repository()     → shared singleton
get_expense_repository()   → shared singleton
```

### Balance Algorithm (`InMemoryExpenseRepository.get_balances`)

```
For each expense:
  payer.net   += total − payer_split_amount   # they overpaid; others owe them
  others.net  −= their_split_amount           # they underpaid; they owe payer

Net sum always = 0. optimal_settlements() (split_calculator.py) minimises
transaction count to settle all debts.
```

---

## Frontend Screens

### Tab Screens — `app/(tabs)/`

| Screen | File | Status | Key features |
|--------|------|--------|--------------|
| Groups / Home | `index.tsx` | ✅ | Hero balance card (total across groups), group list with `is_settled` badge, FAB → create group |
| AI Splitter | `expenses.tsx` | ✅ | AI text input pinned to bottom, example prompt chips, "How it works" card, ParseResultModal |
| Who Owes Whom | `settle.tsx` | ✅ | Hero summary card, collapsible group cards, debt rows with Pay via UPI + Remind + Mark Settled |
| Profile | `profile.tsx` | 🚧 | Mock user, mock stats; no auth |

### Modal / Stack Screens — `app/`

| Screen | File | Status | Key features |
|--------|------|--------|--------------|
| Create Group | `group-create.tsx` | ✅ | Name input, emoji picker, color picker, member chips, live preview |
| Group Detail | `group-detail.tsx` | ✅ | Hero balance card, expense list, debts list, Add Member modal (with contact picker), add/edit expense |
| Add / Edit Expense | `expense-add.tsx` | ✅ | Add mode + Edit mode (pre-filled); equal split only |

### Navigation — `app/_layout.tsx`

```
Root Stack
├── (tabs)           — tab bar, 4 tabs
├── group-create     — slide_from_right
├── group-detail     — slide_from_right
└── expense-add      — slide_from_bottom
```

---

## Frontend Library

### Types — `lib/types.ts`
Single source of truth for all TypeScript interfaces. Mirrors backend Pydantic schemas.
```
PersonSplit, ParsedExpense
Group, CreateGroupRequest, AddMemberRequest
ExpenseSplit, Expense, CreateExpenseRequest, MemberBalance, Debt, SettleDebtRequest
```

### API Client — `lib/api.ts`
All HTTP calls. No fetch() anywhere else in the codebase.
```
parseExpense(text, participants)              → ParsedExpense
splitEqual(total, participants)              → PersonSplit[]
createGroup(req)                             → Group
addGroupMember(groupId, req)                 → Group
getGroups()                                  → Group[]   (?user=Deepak always sent)
createExpense(groupId, req)                  → Expense
updateExpense(groupId, expenseId, req)       → Expense
getGroupExpenses(groupId)                    → Expense[]
getGroupBalances(groupId)                    → MemberBalance[]
getGroupDebts(groupId)                       → Debt[]
settleDebt(groupId, req)                     → Expense
checkHealth()                                → boolean
toUserMessage(err)                           → string   (error normalisation)
```

### Constants — `lib/constants.ts`
```
MOCK_USER_NAME = "Deepak"    ← hardcoded until auth is built
GROUP_PARTICIPANTS = ['Deepak', 'Raj', 'Priya', 'Ankit']
EMOJI_OPTIONS  — 12 emoji choices for group picker
COLOR_OPTIONS  — 8 pastel hex colours for group picker
```

### Theme — `lib/theme.ts`
```
COLORS.primary     #5B5FEF  indigo — buttons, active
COLORS.success     #22C55E  green  — owed to you
COLORS.danger      #EF4444  red    — you owe
COLORS.background  #F8F9FA  screen bg
COLORS.card        #FFFFFF  card bg
COLORS.primaryLight         light indigo tint
COLORS.text1/2/3            dark/medium/light text
COLORS.border               dividers

SHADOW.card        elevation 3
SHADOW.elevated    elevation 8

RADIUS.sm  12  RADIUS.md  16  RADIUS.lg  20  RADIUS.xl  24
```

### Storage — `lib/storage.ts`
AsyncStorage wrapper. Keys: GROUPS, EXPENSES, USER_PROFILE, SETTLEMENTS.
Currently unused — backend is source of truth; offline cache not yet wired up.

---

## Frontend Components — `components/`

| Component | Props | Used in |
|-----------|-------|---------|
| `GroupCard` | `group: Group, onPress?` | `(tabs)/index.tsx` |
| `ExpenseCard` | `expense: Expense, onPress?` | `(tabs)/expenses.tsx` |
| `PersonCard` | `person: SettlePerson, type, onPay?, onRemind?` | legacy; settle tab now uses inline `DebtRow` |
| `ParseResultModal` | `result: ParsedExpense, onClose, onAdd` | `(tabs)/expenses.tsx` |
| `TabIcon` | `emoji, focused` | `(tabs)/_layout.tsx` |

---

## Frontend Hooks — `hooks/`

| Hook | Returns | Used in |
|------|---------|---------|
| `useGroups` | `{ groups, isLoading, error, reload }` | `(tabs)/index.tsx` |
| `useExpenseParsing` | `{ parsedResult, isParsing, error, submit, clear }` | `(tabs)/expenses.tsx` |
| `useGroupDetail` | `{ expenses, balances, myBalance, debts, isLoading, error, reload }` | `group-detail.tsx` |
| `useSettleTab` | `{ items: GroupWithDebts[], loading, error, settlingKey, settle, reload }` | `(tabs)/settle.tsx` |

---

## Network & Connectivity

### API Host Resolution — `lib/api.ts`

| Where app runs | Host used | Why |
|---|---|---|
| Android Emulator | `10.0.2.2` | Special alias that routes to host machine loopback |
| Browser (localhost) | `127.0.0.1` | Chrome resolves `localhost` → `::1` (IPv6); Docker only binds IPv4 |
| Browser (LAN IP) | same LAN IP | Page and API on same machine |
| Physical device / iOS Simulator | derived from `Constants.expoConfig.hostUri` | Expo dev server host = machine LAN IP |

### CORS — `backend/main.py`
- `allow_origins=["*"]` — all origins allowed (dev only; restrict before production)
- `allow_private_network=True` — satisfies Chrome's Private Network Access policy when fetching from LAN IP pages

---

## What's Implemented vs What's Needed: Multi-User Sync

This section tracks the full picture for turning KharchaShare into a real shared app.

### Currently implemented
- Single hardcoded user (`MOCK_USER_NAME = "Deepak"` in `lib/constants.ts`)
- All group/expense data stored in-memory on the backend — shared across all connections to the same server instance, but reset on restart
- Data refreshes on screen focus (`useFocusEffect`) — no background polling or push

### Not yet implemented

| Feature | Why it's needed | Prerequisite |
|---------|----------------|--------------|
| **Persistent database** | Data survives restarts; multiple users can share real data | — |
| **Phone number auth** | Identify who is opening the app; replace `MOCK_USER_NAME` | Database |
| **OTP / SMS verification** | Prove ownership of a phone number at login | Auth |
| **User model** | Store `user_id`, `phone`, `display_name`; groups reference user IDs not string names | Database + Auth |
| **Invite link / deep link** | Let a group creator send a join link via WhatsApp/SMS to add members | Auth |
| **Real-time sync** | When Person A adds an expense, Person B sees it without leaving the screen | Database |
| **Push notifications** | Notify members when a new expense is added or a reminder is sent | Real-time infra |

### Recommended build order
1. **Database** — SQLite locally, PostgreSQL in production (see ADR-005 in `docs/ADR.md`)
2. **Auth** — Phone OTP via Firebase Auth or Twilio Verify; backend validates JWT
3. **User model** — Migrate group `members: list[str]` → `members: list[UserRef]`
4. **Invite links** — Expo deep linking + branch.io or custom scheme
5. **Real-time** — Polling every 30 s (simple) first; upgrade to WebSockets if needed
6. **Push notifications** — Expo Push + FCM/APNs

---

## What's Next (Prioritised)

| Priority | Feature | Scope | Notes |
|----------|---------|-------|-------|
| 1 | **Persistent database** | Backend | SQLite locally via SQLAlchemy; PostgreSQL in production; only `dependencies.py` changes |
| 2 | **Phone number auth** | Backend + Frontend | OTP login; JWT sessions; replace `MOCK_USER_NAME` |
| 3 | **User model + invite links** | Backend + Frontend | Groups reference user IDs; join via WhatsApp/SMS link |
| 4 | **Real-time sync** | Backend + Frontend | Poll every 30 s as first step; WebSockets later |
| 5 | **Push notifications** | Mobile | Expo Push Notifications for new expense + reminders |
| 6 | **Wire expenses tab to groups** | Frontend | `(tabs)/expenses.tsx` should add expense to a selected group |
| 7 | **Profile screen** | Frontend | Real user data from auth; group/expense counts from API |
| 8 | **Custom splits** | Frontend | `expense-add.tsx` currently equal-only; add custom % / exclusion |
| 9 | **Voice input** | Backend + Frontend | `POST /api/parse-voice` → Whisper → expense parser |
| 10 | **Offline cache** | Frontend | Wire `lib/storage.ts` AsyncStorage as read cache |
