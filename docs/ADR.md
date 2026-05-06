# KharchaShare — Architecture Decision Records

Each ADR captures one significant technology or design choice: what was decided, why, and what was ruled out.

---

## ADR-001 — Python + FastAPI for the backend

**Status:** Accepted

**Decision:** All business logic (splitting, balance tracking, settlement, AI parsing) lives in a Python FastAPI service.

**Why FastAPI:**
- Async-native — handles concurrent Ollama calls without blocking
- Pydantic models enforce the request/response contract and generate the OpenAPI spec automatically (`/docs`)
- Type hints throughout make the code easy to read and refactor
- `pytest` + `httpx.AsyncClient` make it easy to test routes without a running server

**Why Python:**
- Ollama's official Python SDK (`ollama` package) is first-class; the JS SDK is less mature
- NumPy / pandas available if we need heavier financial calculations later
- Data science ecosystem (for potential analytics features) is Python-native

**Alternatives considered:**
- **Node.js + Express/Fastify** — JS/TS across the full stack is appealing but the Ollama Python SDK is significantly better maintained
- **Go** — excellent performance but adds a second language most contributors would need to learn

---

## ADR-002 — React Native + Expo for the frontend

**Status:** Accepted

**Decision:** The mobile app is built with React Native (Expo SDK 54, Expo Router for navigation).

**Why React Native + Expo:**
- Single codebase targets iOS, Android, and web (browser dev/testing)
- Expo SDK bundles most native modules needed (contacts, camera, notifications) without ejecting
- Expo Router gives file-based routing identical to Next.js — easy mental model
- Expo Go on a physical device for instant testing without App Store builds

**Why not Flutter:**
- Dart is a less common language; harder to find contributors
- The Expo ecosystem (EAS Build, Expo Go, OTA updates) has no Flutter equivalent for rapid iteration

**Why not a web-only app (Next.js):**
- Core feature — Pay via UPI — requires opening native UPI apps via deep link (`upi://`)
- Contact picker, push notifications, camera for receipt scanning all need native APIs
- India is a mobile-first market; a web-only experience would miss the majority of users

---

## ADR-003 — Ollama + qwen2.5:7b for AI expense parsing

**Status:** Accepted

**Decision:** Free-text expense parsing runs locally via Ollama with the `qwen2.5:7b` model.

**Why Ollama:**
- Zero API cost — runs fully on local hardware or in a Docker container
- `format="json"` mode guarantees syntactically valid JSON responses — eliminates parsing failures
- Models are versioned and pinned; no surprise changes from a cloud provider
- Can be GPU-accelerated on machines with NVIDIA cards with a one-line config change

**Why qwen2.5:7b:**
- Consistently top-ranked on instruction-following and structured-output benchmarks (MMLU, HumanEval)
- Understands Indian context (rupees, dhabas, UPI, splitting customs) without fine-tuning
- 4.7 GB — fits comfortably in 8 GB RAM; runs acceptably on CPU
- Apache 2.0 license — commercially usable

**Alternatives considered:**
- **OpenAI GPT-4o** — better reasoning but $0.01–0.03 per parse call adds up; requires API key; data leaves the device
- **Google Gemini** — same concerns; API dependency; latency over the network
- **qwen2.5:3b** — 1.9 GB, noticeably faster on CPU, but less reliable on ambiguous Indian-language expense descriptions; available as a drop-in swap via `OLLAMA_MODEL=qwen2.5:3b`
- **llama3.2:3b** — good general-purpose alternative; less tested on expense parsing specifically

**Upgrade path:** If cloud inference is acceptable in the future, swapping `OllamaExpenseParser` for a `GPT4oExpenseParser` only touches `services/expense_parser.py` — the Protocol interface is unchanged.

---

## ADR-004 — Docker Compose for local orchestration

**Status:** Accepted

**Decision:** The backend API and Ollama run as Docker Compose services. The React Native frontend always runs outside Docker.

**Why Docker Compose:**
- Single command (`docker compose up --build`) starts both services with correct networking
- Named volume `ollama_models` persists the 4.7 GB model across restarts — downloaded once, ever
- Port binding `127.0.0.1:8000:8000` (IPv4 explicit) avoids the Windows/Chrome IPv6 pitfall
- The same `docker-compose.yml` deploys to any VPS, Render, Railway, or Fly.io without changes

**Why the frontend stays outside Docker:**
- Expo Metro bundler requires interactive terminal input (`a`, `w`, `i` keypresses)
- Hot reload requires the bundler to watch the filesystem directly — Docker volume mounts add latency
- Expo Go on a physical device connects to the Metro server by LAN IP; this is easier to configure when Metro runs natively

**Alternatives considered:**
- **Frontend in Docker too** — increases complexity with no benefit for development
- **Podman** — compatible but adds tooling friction for contributors on Windows/Mac who have Docker Desktop already

---

## ADR-005 — SQLite locally, PostgreSQL in production

**Status:** Accepted (not yet implemented — tracked as Priority 1 in `FEATURES.md`)

**Decision:** Use SQLAlchemy as the ORM with two interchangeable backends:
- `sqlite:///./kharchashare.db` — for local development and testing (zero setup, file-based)
- `postgresql://...` — for production and when testing on a physical mobile device that connects to a shared server

**Why two databases instead of one:**
- SQLite requires no installation — `pip install sqlalchemy` is all that's needed locally
- PostgreSQL is required in production for concurrent writes, proper transactions, and connection pooling
- SQLAlchemy's abstraction means the same model definitions and queries work on both; only the connection URL changes

**How the switch works:**

```python
# backend/core/config.py
class Settings(BaseSettings):
    database_url: str = "sqlite:///./kharchashare.db"
    # Override for production:  DATABASE_URL=postgresql://user:pass@host/db
```

```python
# backend/api/dependencies.py
# Replace InMemory singletons with SQLAlchemy session-scoped repositories
get_group_repository()   → SQLGroupRepository(session)
get_expense_repository() → SQLExpenseRepository(session)
```

Only `dependencies.py` changes — all route handlers, services, and tests are unaffected.

**Why not SQLite in production:**
- SQLite uses file-level locking — concurrent writes from multiple API workers cause `SQLITE_BUSY` errors
- No network access — cannot be shared between multiple server instances or accessed from a separate machine
- Not suitable for a shared app where multiple phone users write simultaneously

**Why not PostgreSQL everywhere:**
- Requires a running Postgres server even for a `pytest` run on a developer laptop
- Adds Docker complexity for first-time contributors
- SQLite is sufficient for the current development phase

**Local testing with a physical device pointing at a shared backend:**
- Run `docker compose up --build` with `DATABASE_URL=postgresql://...` set in `.env`
- The device connects to `http://<your-machine-ip>:8000`
- All group members' phones hit the same Postgres database — this is the first step toward real multi-user testing before full production infrastructure is set up

**Migration strategy:** Alembic for schema migrations. First migration converts the in-memory structure to SQL tables; subsequent migrations are incremental.

---

## ADR-006 — Phone number OTP for authentication

**Status:** Planned (not yet implemented — tracked as Priority 2 in `FEATURES.md`)

**Decision:** Users are identified by phone number, verified via OTP (one-time password sent by SMS).

**Why phone number (not email/password):**
- India is a WhatsApp-first market — users are accustomed to phone-number-based identity
- No password to forget or reset
- Phone number is already the natural way to invite someone to a group ("add Priya — +91 98xxx")
- UPI is phone-number-linked; the same identifier serves both auth and payment

**Why OTP (not Google/Apple sign-in):**
- Google Sign-In requires a Google account — excludes users on feature phones or without Google
- Apple Sign-In is iOS only — not viable for an Android-first market
- OTP works on any phone with SMS capability

**Proposed implementation:**
- **Firebase Authentication** (phone provider) — handles OTP delivery, rate limiting, and SIM swap protection; free up to 10,000 verifications/month
- Alternative: **Twilio Verify** — more control, pay-per-use (~$0.05/verification)
- Backend validates the Firebase ID token (JWT) on every request via `python-jose`
- `MOCK_USER_NAME = "Deepak"` in `lib/constants.ts` is replaced by the authenticated user's display name and `user_id`

**What changes when auth is added:**
- `GET /api/groups?user=Deepak` → `GET /api/groups` (user derived from JWT, not query param)
- Group `members: list[str]` → `members: list[UserRef]` (id + display_name + phone)
- All balance/debt queries filter by authenticated user ID

---

## ADR-007 — `useFocusEffect` polling, not WebSockets (for now)

**Status:** Accepted (subject to review when auth + database are live)

**Decision:** Data refreshes when a screen comes into focus. No background polling, no WebSockets.

**Why this is acceptable now:**
- The backend is in-memory — there is no multi-user data to sync
- Adding WebSocket infrastructure before there is a database to back it would be premature
- `useFocusEffect` is already in every data hook; upgrading to polling is a one-line change per hook

**Planned upgrade path (after database is live):**
1. **Polling every 30 s** — add `setInterval` inside `useFocusEffect`; simple, no new infra
2. **Server-Sent Events (SSE)** — one-way push from backend when a group is mutated; adds `GET /api/groups/{id}/events` endpoint; no WebSocket handshake complexity
3. **WebSockets** — full bidirectional; justified only if real-time collaborative editing is needed (not required for expense sharing)

**Push notifications** (separate from sync) will use Expo Push Notifications + FCM/APNs to wake the app when another member adds an expense.
