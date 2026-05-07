# KharchaShare — Data & Interaction Flows

This document traces every significant user action from the first tap on screen
all the way to where data is stored, and back.  Read it top-to-bottom to
understand the whole system, or jump to a specific flow using the table of
contents.

---

## Table of Contents

1. [System startup](#1-system-startup)
2. [App boot — React Native](#2-app-boot--react-native)
3. [Groups screen loads](#3-groups-screen-loads)
4. [Create a group](#4-create-a-group)
5. [Parse an expense with AI](#5-parse-an-expense-with-ai)
6. [Equal split (no AI)](#6-equal-split-no-ai)
7. [Where data lives](#7-where-data-lives)
8. [Request lifecycle inside FastAPI](#8-request-lifecycle-inside-fastapi)
9. [Error paths](#9-error-paths)

---

## 1. System Startup

Before the app or the user can do anything, two processes must be running.

### Backend startup sequence

```
$ docker compose up
        │
        ▼
  uvicorn starts
  main.create_app() called
        │
        ├─ Middleware attached (CORS)
        ├─ Routers mounted
        │    ├─ /api/groups    ← groups.router
        │    ├─ /api/parse-expense  ← expenses.router
        │    └─ /api/split/equal   ← splits.router
        │
        └─ lifespan() runs (core/lifespan.py)
               │
               ├─ _wait_for_ollama()
               │    Polls GET http://ollama:11434/api/tags every 3 s
               │    Waits up to 60 s (20 × 3 s) for the Ollama container
               │    to accept connections.
               │
               └─ _ensure_model("qwen2.5:7b")
                    ollama.AsyncClient.show("qwen2.5:7b")
                    ├─ Model already cached on Docker volume → skip
                    └─ Not cached → pull (~4.7 GB, first run only)

API now accepting requests on :8000
```

`core/config.py` reads two env vars **once** at startup and caches them:

| Variable | Default | Set in Docker |
|----------|---------|---------------|
| `OLLAMA_HOST` | `http://localhost:11434` | `http://ollama:11434` |
| `OLLAMA_MODEL` | `qwen2.5:7b` | `qwen2.5:7b` |

The `InMemoryGroupRepository` singleton is created when `api/dependencies.py`
is first imported, also at startup:

```python
# api/dependencies.py  (module level — runs once)
_group_repository: GroupRepositoryProtocol = InMemoryGroupRepository()
```

---

## 2. App Boot — React Native

```
User opens app
      │
      ▼
Expo Router reads app/_layout.tsx
      │
      └─ RootLayout renders
           <StatusBar />
           <Stack>
             ├─ Screen: "(tabs)"       ← default route
             ├─ Screen: "group-create" ← slide-from-right
             └─ Screen: "+not-found"
           </Stack>
      │
      ▼
Expo Router resolves the default route → app/(tabs)/_layout.tsx
      │
      └─ TabLayout renders
           <Tabs>
             ├─ index      → Groups screen   (loaded first)
             ├─ expenses   → Expenses screen
             ├─ settle     → Settle screen
             └─ profile    → Profile screen
           </Tabs>
      │
      ▼
GroupsScreen (app/(tabs)/index.tsx) mounts
(See Flow 3)
```

The tab bar icons are provided by `components/TabIcon.tsx`.  The active tab
highlights with `COLORS.primaryLight` background; the inactive icon shows with
no background.

---

## 3. Groups Screen Loads

This is triggered on **first mount** and again **every time the tab gains
focus** (e.g. after returning from the group-create screen).

```
GroupsScreen mounts
      │
      ├─ useGroups() hook initialises state
      │    groups    = []
      │    isLoading = true
      │    error     = null
      │
      └─ useFocusEffect fires reload()
               │
               ├─ setLoading(true)  → spinner shown on screen
               │
               ▼
         lib/api.ts  getGroups()
               │
               └─ fetch GET http://localhost:8000/api/groups
                         │
                    ─────┼───── HTTP boundary ─────────────────────
                         │
                         ▼
                   FastAPI: api/routes/groups.py
                   list_groups()
                         │
                         ├─ Depends(get_group_repository)
                         │    returns the singleton InMemoryGroupRepository
                         │
                         └─ await repo.list_all()
                                  │
                                  └─ sorts _groups dict by created_at DESC
                                     returns list[Group]
                         │
                         ▼
                   FastAPI serialises list[Group] → JSON
                   (datetime → ISO 8601 string automatically)
                    ─────┼───── HTTP boundary ─────────────────────
                         │
               fetch resolves: Group[]
               │
               ├─ setGroups(data)   → list rendered
               └─ setLoading(false) → spinner hidden
```

**What the user sees at each step:**

| State | UI |
|-------|----|
| `isLoading = true` | Spinner + "Loading groups…" |
| `error != null` | ⚠️ error message + Retry button |
| `groups.length === 0` | 🏕️ empty state + "Tap + to create" |
| `groups.length > 0` | `GroupCard` list, hero balance card |

---

## 4. Create a Group

Triggered when the user taps **+** (FAB) on the Groups screen, fills the form,
and taps **Create Group**.

### Step A — Navigate to the form

```
User taps FAB (+) on GroupsScreen
      │
      └─ router.push('/group-create')
           │
           Expo Router slides in app/group-create.tsx
           (animation: slide_from_right)
```

### Step B — Fill the form

The screen holds all form state locally:

```
group-create.tsx local state
  groupName      = ''          ← TextInput
  selectedEmoji  = '✈️'       ← first item from EMOJI_OPTIONS (lib/constants.ts)
  selectedColor  = '#DBEAFE'  ← first item from COLOR_OPTIONS (lib/constants.ts)
  memberInput    = ''          ← TextInput
  members        = []          ← chips list

As user types name   → setGroupName(t)
As user picks emoji  → setSelectedEmoji(emoji)
As user picks color  → setSelectedColor(hex)
Tap "Add" button     → members = [...members, memberInput.trim()]
Tap × on a chip      → members = members.filter(m => m !== name)
```

The **live preview bubble** at the top of the form re-renders on every state
change — no extra code needed, React re-renders automatically.

### Step C — Submit

```
User taps "Create Group"
      │
      ├─ Client-side validation
      │    groupName empty?  → errors.name = 'Group name is required'
      │    members empty?    → errors.members = 'Add at least one member'
      │    any error?        → show inline error text, stop
      │
      ├─ setIsSubmitting(true) → button shows spinner, disabled
      │
      ▼
lib/api.ts  createGroup({ name, emoji, color, members })
      │
      └─ fetch POST http://localhost:8000/api/groups
         body: { "name": "Goa Trip", "emoji": "✈️",
                 "color": "#DBEAFE", "members": ["Deepak","Raj","Priya"] }
                   │
              ─────┼───── HTTP boundary ────────────────────────────
                   │
                   ▼
             FastAPI: api/routes/groups.py
             create_group(req, repo)
                   │
                   ├─ Pydantic validates CreateGroupRequest
                   │    name validator  → strips whitespace, rejects empty
                   │    members validator → filters blank entries, rejects empty list
                   │
                   ├─ Depends(get_group_repository) → InMemoryGroupRepository
                   │
                   └─ await repo.create(req)
                            │
                            services/group_repository.py
                            InMemoryGroupRepository.create()
                            │
                            ├─ group = Group(
                            │      id         = str(uuid4())        ← new UUID
                            │      name       = req.name
                            │      emoji      = req.emoji
                            │      color      = req.color
                            │      members    = req.members
                            │      created_at = datetime.now(UTC)   ← timestamp
                            │      net_balance = 0.0
                            │   )
                            │
                            └─ _groups[group.id] = group
                               ↑
                               Stored in the process-memory dict.
                               Survives until the server restarts.

                   FastAPI serialises Group → JSON, returns HTTP 201
              ─────┼───── HTTP boundary ────────────────────────────
                   │
         fetch resolves: Group (the newly created object)
      │
      ├─ setIsSubmitting(false)
      └─ router.back()
               │
               Expo Router pops the stack → GroupsScreen becomes visible
               useFocusEffect fires → reload() called again (Flow 3)
               → new group appears at the top of the list
```

---

## 5. Parse an Expense with AI

The headline feature.  User types free-text; the AI returns a structured split.

### Step A — User types and submits

```
ExpensesScreen
      │
      ├─ TextInput bound to aiText state
      │
      └─ User taps ➤ (or presses Enter on keyboard)
               │
               handleAiSubmit()
               │
               └─ useExpenseParsing.submit(aiText, GROUP_PARTICIPANTS)
                        │
                        ├─ setParsing(true) → send button replaced by spinner
                        └─ (continues below)
```

`GROUP_PARTICIPANTS` comes from `lib/constants.ts`:
```
['Deepak', 'Raj', 'Priya', 'Ankit']
```

### Step B — HTTP call

```
lib/api.ts  parseExpense(text, participants)
      │
      └─ fetch POST http://localhost:8000/api/parse-expense
         body: {
           "text": "Dinner ₹3200, Raj no drinks, split accordingly",
           "participants": ["Deepak","Raj","Priya","Ankit"]
         }
```

### Step C — FastAPI receives the request

```
api/routes/expenses.py
parse_expense(req, parser)
      │
      ├─ Pydantic validates ParseExpenseRequest
      │    text validator      → rejects blank string
      │    participants validator → rejects empty list
      │
      ├─ Depends(get_expense_parser)
      │    creates OllamaExpenseParser(
      │      client = ollama.AsyncClient(host=settings.ollama_host),
      │      model  = settings.ollama_model   ← "qwen2.5:7b"
      │    )
      │
      └─ await parser.parse(req.text, req.participants)
```

### Step D — OllamaExpenseParser works

```
services/expense_parser.py
OllamaExpenseParser.parse()
      │
      ├─ _build_prompt(text, participants)
      │    Constructs a structured prompt:
      │    ┌─────────────────────────────────────────────────────┐
      │    │ SYSTEM: "You are an expense splitting assistant…"   │
      │    │ USER:   Expense description: "Dinner ₹3200…"        │
      │    │         Participants: Deepak, Raj, Priya, Ankit      │
      │    │         Return this JSON schema exactly: { ... }     │
      │    └─────────────────────────────────────────────────────┘
      │
      ├─ ollama.AsyncClient.chat(
      │      model   = "qwen2.5:7b",
      │      format  = "json",          ← Ollama enforces valid JSON output
      │      options = { temperature: 0.1, num_predict: 512 }
      │   )
      │         │
      │    ─────┼───── Ollama boundary ──────────────────────────
      │         │
      │         qwen2.5:7b model processes the prompt
      │         Understands: "Raj no drinks" → Raj gets a smaller share
      │         Outputs structured JSON:
      │         {
      │           "description": "Dinner",
      │           "total": 3200,
      │           "currency": "INR",
      │           "paid_by": null,
      │           "splits": [
      │             {"person":"Deepak","amount":1000,"percentage":31.25},
      │             {"person":"Raj",   "amount":700, "percentage":21.88},
      │             {"person":"Priya", "amount":800, "percentage":25.0},
      │             {"person":"Ankit", "amount":700, "percentage":21.87}
      │           ],
      │           "notes": "Raj excluded from drinks (~₹500 est.)",
      │           "confidence": 0.85
      │         }
      │    ─────┼───── Ollama boundary ──────────────────────────
      │         │
      │    response["message"]["content"] = raw JSON string
      │
      ├─ _extract_json(raw)
      │    Strips any ``` markdown fences the model may have added.
      │    Falls back to regex { ... } search if there's surrounding text.
      │    json.loads() → dict
      │
      └─ _validate(data, participants)
           ├─ Any participant missing from splits? → add with amount=0
           ├─ Amounts don't sum exactly to total? → absorb remainder
           │    into the largest-share person (rounding fix)
           └─ Recompute all percentages from corrected amounts
           Returns: ParsedExpense (typed Pydantic model)
```

### Step E — Response travels back and modal appears

```
FastAPI serialises ParsedExpense → JSON   HTTP 200
      │
 ─────┼───── HTTP boundary ─────────────────────────────────
      │
lib/api.ts: fetch resolves → ParsedExpense object
      │
useExpenseParsing:
      ├─ setResult(parsedResult)
      └─ setParsing(false) → spinner gone, send button restored

ExpensesScreen:
      parsedResult != null
      └─ <ParseResultModal result={parsedResult} … /> renders

                ┌─────────────────────────────────────────┐
                │  AI Split Result ✨                       │
                │  Dinner          ₹3,200                  │
                │  ─────────────────────────────────────  │
                │  D  Deepak    31.25%    ₹1,000           │
                │  R  Raj       21.88%      ₹700           │
                │  P  Priya     25.00%      ₹800           │
                │  A  Ankit     21.87%      ₹700           │
                │  💡 Raj excluded from drinks (~₹500)     │
                │  ✓ High confidence                       │
                │  [Cancel]          [Add Expense]         │
                └─────────────────────────────────────────┘
```

### Step F — User actions on the modal

```
Taps Cancel    → clear() → parsedResult = null → modal unmounts
Taps Add Expense
      ├─ Alert.alert("Added! 🎉", …)
      ├─ clear()   → modal gone
      └─ setAiText('')  → input cleared
         (TODO: persist to backend when /api/expenses is implemented)
```

---

## 6. Equal Split (No AI)

Used when the split is perfectly even and no AI is needed.

```
lib/api.ts  splitEqual(total, participants)
      │
      └─ fetch POST /api/split/equal
         body: { "total": 300, "participants": ["A","B","C"] }
                   │
              ─────┼─────────────────────────────────────
                   ▼
             api/routes/splits.py
             split_equal(req, strategy)
                   │
                   ├─ Depends(get_equal_split_strategy)
                   │    returns EqualSplitStrategy()   (stateless, new per request)
                   │
                   └─ strategy.calculate(300.0, ["A","B","C"])
                            │
                            services/split_calculator.py
                            EqualSplitStrategy.calculate()
                            │
                            ├─ _equal_amounts(300, 3)
                            │    base      = floor(300×100/3)/100 = 100.00
                            │    remainder = 300 - 100×3 = 0.00
                            │    result    = [100.0, 100.0, 100.0]
                            │
                            └─ returns [
                                 SplitResult(person="A", amount=100.0, percentage=33.33),
                                 SplitResult(person="B", amount=100.0, percentage=33.33),
                                 SplitResult(person="C", amount=100.0, percentage=33.33),
                               ]

             HTTP 200  list[SplitResult]
              ─────┼─────────────────────────────────────
                   │
         fetch resolves: PersonSplit[]
```

Rounding edge case (e.g. ₹100 ÷ 3):
```
base      = floor(100×100/3)/100 = 33.33
remainder = 100 - 33.33×3       = 0.01
result    = [33.34, 33.33, 33.33]   ← remainder goes to first person
```

---

## 7. Where Data Lives

```
┌──────────────────────────────────────────────────────────────────┐
│  What              │  Where                  │  Survives restart? │
├──────────────────────────────────────────────────────────────────┤
│  Groups            │  InMemoryGroupRepository │  No               │
│                    │  (_groups dict in RAM)   │                    │
├──────────────────────────────────────────────────────────────────┤
│  Settings          │  core/config.py          │  Yes (env vars /  │
│  (OLLAMA_HOST etc) │  pydantic-settings cache │  .env file)       │
├──────────────────────────────────────────────────────────────────┤
│  Ollama model      │  Docker named volume     │  Yes              │
│  (qwen2.5:7b)      │  ollama_models           │  (survives        │
│                    │  (~4.7 GB)               │   container stop) │
├──────────────────────────────────────────────────────────────────┤
│  Frontend state    │  React useState          │  No (in-memory)   │
│  (groups, result)  │  per component           │                    │
├──────────────────────────────────────────────────────────────────┤
│  Offline cache     │  AsyncStorage            │  Yes              │
│                    │  lib/storage.ts          │  (device storage) │
│                    │  keys: STORAGE_KEYS.*    │                    │
└──────────────────────────────────────────────────────────────────┘
```

**What "in-memory" means in practice:**
Every time `uvicorn` or Docker restarts, `_group_repository._groups = {}`
resets to empty. Groups created during a session disappear. This is the
intended state for the current phase (no auth). When a database is added,
only `api/dependencies.py` changes — the `get_group_repository` function
returns a `SQLiteGroupRepository` instead; nothing else in the codebase
needs to know.

---

## 8. Request Lifecycle Inside FastAPI

Every HTTP request passes through the same pipeline:

```
Incoming HTTP request
      │
      ▼
CORS Middleware (main.py)
  Adds Access-Control-Allow-Origin: *
  Handles pre-flight OPTIONS requests
      │
      ▼
Router matching
  /api/groups       → api/routes/groups.py
  /api/parse-expense → api/routes/expenses.py
  /api/split/equal  → api/routes/splits.py
  /health           → main.py inline handler
      │
      ▼
Pydantic request validation
  Parses JSON body into the request model (CreateGroupRequest, etc.)
  Runs @field_validator methods
  Returns HTTP 422 automatically if validation fails
  (frontend sees: { "detail": [ { "msg": "...", "loc": [...] } ] })
      │
      ▼
Dependency injection  (Depends())
  get_settings()          → cached Settings singleton
  get_group_repository()  → module-level InMemoryGroupRepository
  get_expense_parser()    → new OllamaExpenseParser per request
  get_equal_split_strategy() → new EqualSplitStrategy per request
      │
      ▼
Route handler (thin — calls service, maps exceptions to HTTP codes)
      │
      ▼
Service layer
  InMemoryGroupRepository.create() / list_all()
  OllamaExpenseParser.parse()
  EqualSplitStrategy.calculate()
      │
      ▼
Pydantic response serialisation
  Return value validated against response_model
  Python objects → JSON
  datetime → ISO 8601 string
  None → null
      │
      ▼
HTTP response sent
```

---

## 9. Error Paths

### Frontend error handling

```
fetch throws (no network / backend not running)
      │
      └─ err.message contains "fetch" or "Failed to fetch"
           useGroups     → error = "Backend not reachable — run: uvicorn …"
           useExpenseParsing → error = "Backend is not running.\n\nStart it with: …"

fetch resolves but res.ok = false (4xx / 5xx)
      │
      └─ lib/api.ts: res.json() → { detail: "…" }
           throw new Error(err.detail)
           Hook catches it → sets error state
```

### Backend error codes

| Scenario | HTTP Status | Who generates it |
|----------|-------------|-----------------|
| Request body fails Pydantic validation | 422 | FastAPI automatically |
| `text` is blank | 422 | `@field_validator` in ParseExpenseRequest |
| `participants` is empty | 422 | `@field_validator` in ParseExpenseRequest |
| Ollama returns unparseable JSON | 422 | route handler catches `ValueError` |
| Ollama container unreachable | 503 | route handler catches `Exception` |
| Voice endpoint (not implemented) | 501 | explicit `raise HTTPException` |
| Group creation fails unexpectedly | 500 | route handler catches `Exception` |

### Confidence warning

The AI model sets `confidence < 0.6` when the total amount is missing or
ambiguous.  The modal shows a ⚠ warning in red:

```
confidence >= 0.85  →  "✓ High confidence"      (green)
confidence >= 0.60  →  "~ Medium confidence"     (amber)
confidence <  0.60  →  "⚠ Low confidence — please review"  (red)
```

This is computed in `components/ParseResultModal.tsx` (`confidenceLabel` /
`confidenceColor` helpers) — the backend sets the value, the frontend only
presents it.
