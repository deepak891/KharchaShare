# KharchaShare

AI-powered expense sharing app for India. Type (or speak) any expense in plain English — "We had dinner ₹3200, Raj no drinks, split accordingly" — and the app splits it intelligently.

> **Starting a new session?** Read `docs/FEATURES.md` first — it has every implemented endpoint, screen, component, hook, and what's planned next. You won't need to scan the codebase.
>
> **Architecture decisions?** Read `docs/ADR.md` — every major technology choice is recorded there with rationale and alternatives considered.
>
> **Available slash commands** (type in Claude Code):
> - `/add-feature` — step-by-step checklist for adding any new feature
> - `/backend-patterns` — SOLID, Protocol→Repository→Route, testing
> - `/frontend-patterns` — types, API client, hooks, screens, theme
> - `/project-status` — what's built, what's missing, what to do next

---

## Architecture

```
┌──────────────────────┐        HTTP/REST        ┌────────────────────────┐
│  React Native (Expo) │  ──────────────────────▶ │  Python FastAPI        │
│  UI only             │                          │  All business logic    │
│  TypeScript          │ ◀────────────────────── │  + Ollama AI           │
└──────────────────────┘    JSON responses        └───────────┬────────────┘
                                                              │
                                                              │ ollama Python SDK
                                                              ▼
                                                   ┌──────────────────────┐
                                                   │  Ollama              │
                                                   │  qwen2.5:7b          │
                                                   │  (local, no API key) │
                                                   └──────────────────────┘
```

**Rule:** Business logic lives in `backend/`. The React Native app is a UI shell — it renders data and calls the backend, nothing more.

---

## Quick Start

### Option A — Docker (recommended)

```bash
# From project root
docker compose up --build

# First run: pulls qwen2.5:7b (~4.7 GB). Subsequent starts are instant.
# API  → http://localhost:8000
# Docs → http://localhost:8000/docs
```

The API waits for Ollama to be ready and pulls the model automatically on first start.

### Option B — Local dev (no Docker)

```bash
# 1. Install Ollama  →  https://ollama.com
ollama pull qwen2.5:7b

# 2. Start Ollama
ollama serve          # runs on http://localhost:11434

# 3. Start backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # defaults work for local dev
uvicorn main:app --reload
```

### Frontend (React Native / Expo)

```bash
# From project root
npx expo start
# i = iOS simulator  |  a = Android emulator  |  scan QR for physical device
```

> **Physical device:** edit `lib/api.ts` → `API_BASE` and replace `localhost` with your machine's local IP.

---

## Project Structure

```
KharchaShare/
├── docker-compose.yml          # Orchestrates api + ollama services
├── docs/
│   ├── FEATURES.md             # ← READ THIS FIRST: full feature registry, all endpoints, all screens
│   ├── ADR.md                  # Architecture Decision Records: every major technology choice + rationale
│   └── FLOWS.md                # Data flow diagrams (button click → HTTP → backend → storage)
│
├── app/                        # React Native screens (Expo Router file-based routing)
│   ├── _layout.tsx             # Root Stack — registers all screen routes
│   ├── group-create.tsx        # Modal: create new group (emoji, color, members)
│   ├── group-detail.tsx        # Hero balance card + transactions + debts
│   ├── expense-add.tsx         # Add expense to a group (equal split)
│   └── (tabs)/
│       ├── _layout.tsx         # Tab bar (custom emoji icons, indigo active pill)
│       ├── index.tsx           # Groups / Home (hero balance card, group list)
│       ├── expenses.tsx        # AI expense input + result modal (partially wired)
│       ├── settle.tsx          # Settle Up — mock data (not yet wired to real API)
│       └── profile.tsx         # Profile — mock data
│
├── components/                 # Shared UI components (extracted when used in 2+ screens)
│   ├── GroupCard.tsx           # Group list item (emoji bubble, name, balance badge)
│   ├── ExpenseCard.tsx         # Expense list item (used in expenses tab)
│   ├── PersonCard.tsx          # Settlement person row (used in settle tab)
│   ├── ParseResultModal.tsx    # AI parse result bottom sheet
│   └── TabIcon.tsx             # Tab bar icon with active highlight
│
├── hooks/                      # Custom hooks: async state management only
│   ├── useGroups.ts            # Fetches group list; used on home screen
│   ├── useGroupDetail.ts       # Fetches expenses + balances + debts in parallel
│   └── useExpenseParsing.ts    # Manages AI parsing state
│
├── lib/
│   ├── types.ts                # All TypeScript interfaces (mirrors backend schemas)
│   ├── api.ts                  # HTTP client — single source of truth for all fetch() calls
│   ├── constants.ts            # MOCK_USER_NAME, EMOJI_OPTIONS, COLOR_OPTIONS
│   ├── theme.ts                # Design tokens: COLORS, SHADOW, RADIUS
│   └── storage.ts              # AsyncStorage wrapper (not yet wired to API)
│
├── backend/                    # Python FastAPI service
│   ├── Dockerfile
│   ├── main.py                 # App factory: assembles routers, CORS, lifespan
│   ├── requirements.txt
│   ├── .env.example
│   ├── core/
│   │   ├── config.py           # pydantic-settings: OLLAMA_HOST, OLLAMA_MODEL
│   │   └── lifespan.py         # Startup: polls Ollama, pulls model if needed
│   ├── models/
│   │   └── schemas.py          # All Pydantic request/response models
│   ├── services/
│   │   ├── interfaces.py       # Protocols (contracts) for all services
│   │   ├── expense_parser.py   # OllamaExpenseParser: free-text → structured split
│   │   ├── split_calculator.py # EqualSplit / PercentageSplit / ExclusionSplit + optimal_settlements
│   │   ├── group_repository.py # InMemoryGroupRepository
│   │   └── expense_repository.py # InMemoryExpenseRepository (balances + debts)
│   ├── api/
│   │   ├── dependencies.py     # Dependency factories for FastAPI Depends()
│   │   └── routes/
│   │       ├── groups.py       # POST/GET /api/groups
│   │       ├── group_expenses.py # POST/GET expenses, balances, debts per group
│   │       ├── expenses.py     # POST /api/parse-expense, /api/parse-voice
│   │       └── splits.py       # POST /api/split/equal
│   └── tests/
│       ├── conftest.py
│       ├── test_api.py
│       ├── test_group_repository.py
│       ├── test_expense_parser.py
│       └── test_split_calculator.py
│
├── .claude/
│   └── commands/               # Project-level slash commands (type /command-name)
│       ├── add-feature.md      # /add-feature  — step-by-step guide for new features
│       ├── backend-patterns.md # /backend-patterns — SOLID, protocols, repos, routes
│       ├── frontend-patterns.md # /frontend-patterns — types, API, hooks, screens
│       └── project-status.md   # /project-status — current build state + next steps
│
└── CLAUDE.md                   # Architecture, quick start, key decisions (this file)
```

---

## AI Model

**Model: `qwen2.5:7b`** (Alibaba Qwen, fully open-source, Apache 2.0)

| Property | Value |
|----------|-------|
| Size on disk | ~4.7 GB |
| RAM needed | ~6 GB |
| API cost | Free — runs locally |
| JSON reliability | Excellent — uses Ollama `format="json"` mode |
| Reasoning | Strong — understands "Raj no drinks → smaller share" |

**Why qwen2.5:7b over alternatives:**
- Consistently top-ranked on instruction-following and structured-output benchmarks
- `format="json"` in Ollama guarantees syntactically valid JSON (no broken responses)
- Understands Indian context (dhabas, UPI, INR) without any fine-tuning
- CPU-only supported (GPU optional for speed)

**To switch models** (e.g. for lighter hardware):
```bash
# In docker-compose.yml or .env:
OLLAMA_MODEL=qwen2.5:3b   # 1.9 GB, faster, slightly less capable
OLLAMA_MODEL=llama3.2:3b  # 2.0 GB, Meta's model, good alternative
```

---

## Docker: Why It's the Right Choice Here

| Benefit | How it applies |
|---------|----------------|
| **Reproducible environment** | Ollama + model version pinned; works the same on every machine |
| **Service isolation** | `ollama` container and `api` container can scale independently |
| **Model persistence** | `ollama_models` Docker volume survives container restarts — no re-download |
| **Scale API layer** | `docker compose up --scale api=3` runs 3 FastAPI replicas; Ollama is shared |
| **Cloud-ready** | Same `docker-compose.yml` deploys to any VPS, Render, Railway, Fly.io |

**Scale API replicas (load balancing):**
```bash
docker compose up --scale api=3
# → 3 FastAPI workers, 1 Ollama instance serving all of them
```

**NVIDIA GPU acceleration** (faster inference): uncomment the `deploy` block in `docker-compose.yml` and install `nvidia-container-toolkit`.

---

## Backend API Endpoints

> Full endpoint reference with request/response shapes: **`docs/FEATURES.md`**

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Status + model + ollama_host |
| `POST` | `/api/groups` | Create a new group |
| `GET`  | `/api/groups?user=Deepak` | List groups with net_balance for given user |
| `POST` | `/api/groups/{id}/expenses` | Add expense to a group |
| `GET`  | `/api/groups/{id}/expenses` | List expenses in a group |
| `GET`  | `/api/groups/{id}/balances` | Per-member net balances |
| `GET`  | `/api/groups/{id}/debts` | Minimum transactions to settle debts |
| `POST` | `/api/parse-expense` | AI: free-text → structured split |
| `POST` | `/api/split/equal` | Math: equal split (no AI) |
| `POST` | `/api/parse-voice` | Voice → expense (placeholder, 501) |

---

## Voice Input (Planned)

1. React Native records audio with `expo-av` (already in Expo SDK — no new package needed)
2. Sends audio to `POST /api/parse-voice` on the backend
3. Python backend sends audio to an Ollama multimodal model (e.g. `llava` or `qwen2.5-vl`)
   — or uses `whisper` for transcription then feeds text to expense parser
4. Same `ParseExpenseResponse` returned to the app

The 🎤 button in `expenses.tsx` shows "Coming Soon" until implemented.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama service URL (set to `http://ollama:11434` in Docker) |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Model name — change to switch models |

No API keys required.

---

## Design System

See `lib/theme.ts` for all tokens.

| Token | Value | Usage |
|-------|-------|-------|
| `COLORS.primary` | `#5B5FEF` | Indigo — buttons, active states |
| `COLORS.success` | `#22C55E` | Green — owed to you |
| `COLORS.danger`  | `#EF4444` | Red — you owe |
| `COLORS.background` | `#F8F9FA` | Screen backgrounds |

---

## Key Decisions

- **Python for all business logic:** Splitting algorithms, balance tracking, settlement optimization — all in `backend/services/`. The RN app is a pure UI shell.
- **Ollama + qwen2.5:7b:** Zero API cost, runs fully locally/in-container, `format="json"` mode removes JSON parsing failures, strong enough reasoning for expense context.
- **Docker Compose:** Ties the API and Ollama together with one command. The named volume means the 4.7 GB model downloads once, ever.
- **No auth yet:** App uses hardcoded mock user ("Deepak"). Auth will be added via backend before launch.
- **AsyncStorage** (`lib/storage.ts`) handles offline cache; backend is the source of truth.
