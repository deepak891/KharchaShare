# KharchaShare — Runbook

Operational guide: how to start, stop, and debug every part of the stack.

---

## Stack Overview

```
Browser / Expo Go / Simulator
        │  HTTP  (port 8000)
        ▼
  FastAPI (uvicorn)          ← Docker container "api"
        │  HTTP  (port 11434)
        ▼
  Ollama (qwen2.5:7b)        ← Docker container "ollama"
```

| Layer | Technology | Default port |
|---|---|---|
| Frontend | React Native (Expo SDK 54) | 8081 |
| Backend API | Python FastAPI + uvicorn | 8000 |
| AI runtime | Ollama + qwen2.5:7b | 11434 |

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Docker Desktop | Latest | https://www.docker.com/products/docker-desktop |
| Node.js | 18 + | https://nodejs.org |
| npm | 9 + | Bundled with Node |

---

## Starting the Application

### Starting the App — Two Terminals Required

`docker compose` starts the **backend + AI only**. The React Native frontend is a separate process that always runs outside Docker. You need two terminals open at the same time.

```
Terminal 1 (backend)          Terminal 2 (frontend)
─────────────────────         ──────────────────────────
docker compose up --build     npx expo start --clear
      │                               │
  FastAPI :8000               Metro bundler :8081
  Ollama  :11434
```

---

### Terminal 1 — Backend (Docker)

```bash
# From the project root
docker compose up --build
```

What this does:
1. Builds the FastAPI image from `backend/Dockerfile`
2. Pulls `ollama/ollama:latest` if not cached
3. Starts both containers; the API waits for Ollama to be healthy
4. On first run, downloads `qwen2.5:7b` (~4.7 GB) — subsequent starts are instant

To run in the background (frees up the terminal):
```bash
docker compose up --build -d
```

To stop:
```bash
docker compose down
```

### Terminal 2 — Frontend (Expo)

Always run from the **project root** (not the `backend/` folder):

```bash
npx expo start --clear     # --clear wipes Metro cache; always use after npm installs
```

Open in:
- **Browser** — press `w` in the Expo CLI, or open `http://localhost:8081`
- **Android Emulator** — press `a` (Android Studio must be running with an emulator open)
- **iOS Simulator (Mac only)** — press `i`
- **Physical device** — scan the QR code in the terminal with the Expo Go app

### Local Backend (no Docker)

If you prefer not to use Docker:

```bash
# 1. Install and start Ollama  →  https://ollama.com
ollama pull qwen2.5:7b
ollama serve          # stays running in a terminal on port 11434

# 2. Start the backend (separate terminal)
cd backend
pip install -r requirements.txt
cp .env.example .env  # defaults work for local dev
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Then start the frontend in a third terminal as above.

---

## Environment Variables

All backend config lives in `backend/.env` (copy from `backend/.env.example`).

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_HOST` | `http://localhost:11434` | Set to `http://ollama:11434` inside Docker |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Swap for a lighter model if needed |

To override the model without editing files:
```bash
OLLAMA_MODEL=qwen2.5:3b docker compose up
```

---

## Verifying the Backend is Running

```bash
# Health check — returns status + model name + ollama host
curl http://localhost:8000/health

# Expected:
# {"status":"ok","model":"qwen2.5:7b","ollama_host":"http://ollama:11434"}

# Interactive API docs (Swagger UI)
open http://localhost:8000/docs
```

If the health check fails, see the Debugging section below.

---

## Network Configuration (Frontend → Backend)

`lib/api.ts` resolves `API_BASE` automatically at runtime:

| Where the app runs | How host is resolved | API_BASE |
|---|---|---|
| Browser (localhost) | `window.location.hostname` = `localhost` | `http://localhost:8000` |
| Browser (LAN IP) | `window.location.hostname` = `192.168.x.x` | `http://192.168.x.x:8000` |
| Android Emulator | Hardcoded `10.0.2.2` | `http://10.0.2.2:8000` |
| Physical device / iOS Simulator | `Constants.expoConfig.hostUri` host | `http://192.168.x.x:8000` |

No manual configuration is needed for standard setups.

---

## Running Backend Tests

```bash
cd backend
pip install -r requirements.txt
pytest                        # run all tests
pytest tests/test_api.py      # single file
pytest -v                     # verbose output
pytest -k "test_balance"      # filter by name
```

Tests run against an isolated in-memory state; no Docker required.

---

## Debugging

### Frontend can't reach the backend

**Symptom:** Spinner runs forever, then "We're getting things ready — please try again in a moment."

**Step 1 — Confirm the backend is up:**
```bash
curl http://localhost:8000/health
```
If this fails → go to "Backend won't start" below.

**Step 2 — Check the browser Network tab:**
Open DevTools → Network → reload the app. Look for the request to `/api/groups`.

| Error in Network tab | Cause | Fix |
|---|---|---|
| `net::ERR_CONNECTION_RESET` | Chrome's Private Network Access block (page served from LAN IP, API on localhost) | Backend already sends `Access-Control-Allow-Private-Network: true`. Rebuild Docker: `docker compose up --build -d` |
| `net::ERR_CONNECTION_REFUSED` | Backend not running on port 8000 | Start backend: `docker compose up` |
| `net::ERR_NAME_NOT_RESOLVED` | Wrong hostname | Check `API_BASE` log in console |
| CORS error | Missing CORS headers | Rebuild backend container |

**Step 3 — Print API_BASE to confirm the right URL is being used:**

Add temporarily to `lib/api.ts` after `export const API_BASE`:
```typescript
console.log('[API] base:', API_BASE);
```
Check the browser console or Metro logs for the printed URL.

**Step 4 — Test the exact URL from the browser:**

Paste `http://localhost:8000/health` (or the LAN IP variant) directly in the browser address bar. If it returns JSON, the backend is reachable. If Chrome shows an error, it's a network/security issue, not a code issue.

---

### Backend won't start

**Check container status and logs:**
```bash
docker compose ps
docker compose logs api --tail=50
docker compose logs ollama --tail=20
```

**Common errors:**

| Log message | Cause | Fix |
|---|---|---|
| `Error: Got unexpected extra arguments` | Inline comment inside a YAML `>` block in `docker-compose.yml` | Remove comments from the `command:` block |
| `ModuleNotFoundError` | New Python dependency not installed in the image | `docker compose up --build` (rebuilds the image) |
| `Address already in use` | Port 8000 already occupied | `lsof -i :8000` (Mac/Linux) or `netstat -ano | findstr 8000` (Windows), then kill the process |
| `Ollama did not become ready` | Ollama container is slow / pulling model | Wait and retry; or `docker compose restart api` once Ollama is ready |

**Restart just the API (without touching Ollama):**
```bash
docker compose restart api
```

**Full clean restart:**
```bash
docker compose down
docker compose up --build
```

---

### Ollama / AI parsing is slow or times out

The `qwen2.5:7b` model runs on CPU by default and may be slow on machines without a GPU.

**Check if the model is loaded:**
```bash
curl http://localhost:11434/api/tags
```

**Switch to a smaller model:**
```bash
# In docker-compose.yml or via env var:
OLLAMA_MODEL=qwen2.5:3b docker compose up
# qwen2.5:3b is 1.9 GB, noticeably faster on CPU
```

**Enable NVIDIA GPU (faster inference):**
Uncomment the `deploy` block in `docker-compose.yml` and install `nvidia-container-toolkit`.

---

### Metro / Expo won't start or bundle fails

```bash
# Clear Metro cache — always try this first after any package install
npx expo start --clear

# If a package was installed but Expo still can't find it
rm -rf node_modules
npm install
npx expo start --clear
```

**After installing any new native package** (e.g. `expo-contacts`), you must restart Metro with `--clear`. Expo Go on a physical device may also need to be force-closed and reopened.

---

### TypeScript errors

```bash
# From the project root
npx tsc --noEmit
```

---

### Viewing live API logs

```bash
# Stream logs while the app is running
docker compose logs -f api

# Stream both services
docker compose logs -f
```

---

## Useful Commands Reference

```bash
# Docker
docker compose up --build          # start everything, rebuild images
docker compose up --build -d       # same, detached (background)
docker compose down                # stop and remove containers
docker compose restart api         # hot-restart just the backend
docker compose logs api -f         # stream backend logs
docker compose logs ollama -f      # stream Ollama logs
docker compose exec api bash       # shell inside the API container

# Ollama (direct)
curl http://localhost:11434/api/tags                  # list loaded models
curl http://localhost:11434/api/generate \
  -d '{"model":"qwen2.5:7b","prompt":"hello"}'        # quick model test

# Backend API (direct)
curl http://localhost:8000/health
curl http://localhost:8000/docs                       # open Swagger UI
curl http://localhost:8000/api/groups?user=Deepak

# Frontend
npx expo start --clear             # recommended default
npx expo start --clear --localhost # browser only, avoids LAN/private-network issues
npx tsc --noEmit                   # type-check without building

# Tests
cd backend && pytest -v
```

---

## Data Persistence

The backend uses **in-memory storage**. All groups, expenses, and balances are lost when the API container restarts. This is expected for the current development phase.

The Ollama model weights are stored in the `ollama_models` Docker volume and persist across restarts. The model (~4.7 GB) is only downloaded once.

---

## Port Reference

| Port | Service | Used by |
|---|---|---|
| `8000` | FastAPI backend | Frontend app, `curl` |
| `8081` | Expo Metro bundler | Browser, Expo Go |
| `11434` | Ollama | Backend API container |
