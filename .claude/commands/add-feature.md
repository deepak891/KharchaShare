# Add Feature — KharchaShare

You are adding a new feature to KharchaShare. Follow this checklist in order.
Read `docs/FEATURES.md` first — it tells you what already exists so you don't duplicate work.

---

## Step 1 — Understand the feature

Before writing any code, answer these questions:
1. Does this feature need backend logic, frontend UI, or both?
2. Does it touch existing data (groups, expenses) or introduce a new entity?
3. Is there already a related endpoint, schema, or component that can be extended?

---

## Step 2 — Backend (if needed)

Follow this exact order — never skip steps.

### 2a. Schema first (`backend/models/schemas.py`)
Add new Pydantic models for any new request/response shapes.
- Request models: add `@field_validator` for all user-facing fields
- Response models: keep flat — no nested objects unless necessary
- Put models in the correct section (group models with groups, etc.)

### 2b. Protocol next (`backend/services/interfaces.py`)
If you need a new service, define its `Protocol` here first.
- Use `typing.Protocol` (not ABC)
- One method per behaviour — don't combine unrelated operations
- Only add to the protocol what route handlers will actually call

### 2c. Implementation (`backend/services/`)
Implement the protocol as a concrete class.
- In-memory implementation for now (`dict` storage, UUID keys)
- Keep all business logic here — zero logic in route handlers
- Method names must exactly match the protocol definition

### 2d. Dependency factory (`backend/api/dependencies.py`)
- Add a module-level singleton for stateful services
- Add a `get_<service>()` function that returns it
- Stateless services: new instance per request is fine

### 2e. Route handler (`backend/api/routes/<name>.py`)
- Import from `api.dependencies` — never instantiate services directly
- Use `Depends(get_<service>)` for every service parameter
- Handler body = validate → call service → map exceptions to HTTP codes
- No business logic in handlers, ever
- Register the router in `backend/main.py`

---

## Step 3 — Frontend (if needed)

Follow this exact order.

### 3a. Types (`lib/types.ts`)
Add TypeScript interfaces that mirror the new backend schemas exactly.
- Property names must match the JSON keys (snake_case from Python)
- Export everything — screens and hooks import from here

### 3b. API client (`lib/api.ts`)
Add one function per endpoint.
- Use the existing `get<T>()` or `post<T>()` helpers
- Pass `MOCK_USER_NAME` via query params when the backend needs a user context
- Never import `fetch` directly in screens or hooks

### 3c. Hook (`hooks/use<FeatureName>.ts`)
If the feature needs async data, create a custom hook.
- Use `useFocusEffect` + `useCallback` to reload when the screen gains focus
- Return `{ data, isLoading, error, reload }` — always these four
- Handle the `Promise.all` pattern when loading multiple endpoints in parallel
- `myBalance` or derived values computed inside the hook, not in the screen

### 3d. Screen (`app/<screen-name>.tsx` or `app/(tabs)/<name>.tsx`)
- Get params via `useLocalSearchParams<{...}>()`
- Pass objects between screens as JSON strings in params (e.g. `members: JSON.stringify(members)`)
- Register the screen in `app/_layout.tsx` with `animation: 'slide_from_right'` (push) or `'slide_from_bottom'` (modal)
- No API calls directly in screens — use hooks

### 3e. Components (if reusable)
Extract to `components/` only if the component will be used in more than one place.
Screen-only UI stays inline in the screen file.

---

## Step 4 — Update `docs/FEATURES.md`

After implementation:
1. Add the new endpoint to the endpoints table
2. Add the new schema to the schemas section
3. Add any new screens, components, or hooks to their tables
4. Move the feature from "What's Next" to implemented if it was listed there

---

## Rules (non-negotiable)

- **No business logic in route handlers or React screens** — ever
- **No `fetch()` outside `lib/api.ts`** — ever
- **Protocol before implementation** — define the interface first, then implement
- **One schema file, one API file** — don't create parallel schema or API modules
- **Types match JSON wire format** — snake_case properties, same field names as Python
