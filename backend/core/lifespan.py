"""
FastAPI lifespan handler — startup and shutdown logic.

Responsibilities:
  1. Poll Ollama until it is accepting connections (handles slow container starts).
  2. Pull the configured model if it is not already cached on the Ollama volume.

Extracted from main.py so that main.py is a pure app-factory with no startup logic.
"""

import asyncio
from contextlib import asynccontextmanager

import httpx
import ollama
from fastapi import FastAPI

from core.config import get_settings
from db.database import create_tables, init_db


async def _wait_for_ollama(host: str, retries: int = 20, delay: float = 3.0) -> None:
    """Poll Ollama's /api/tags until it responds."""
    url = f"{host}/api/tags"
    for attempt in range(1, retries + 1):
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                r = await client.get(url)
                if r.status_code == 200:
                    print(f"✓ Ollama is ready at {host}")
                    return
        except Exception:
            pass
        print(f"  Waiting for Ollama... ({attempt}/{retries})")
        await asyncio.sleep(delay)
    raise RuntimeError(f"Ollama did not become ready at {host}")


async def _ensure_model(host: str, model: str) -> None:
    """Pull the model if it is not already cached on the Ollama volume."""
    client = ollama.AsyncClient(host=host)
    try:
        await client.show(model)
        print(f"✓ Model '{model}' already available")
    except Exception:
        print(f"  Pulling '{model}' — first run only, may take a few minutes...")
        async for chunk in await client.pull(model, stream=True):
            status = chunk.get("status", "")
            if "pulling" in status or "success" in status:
                print(f"  {status}")
        print(f"✓ Model '{model}' ready")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    # ── Database ──────────────────────────────────────────────────────────────
    print(f"  Connecting to database: {settings.database_url}")
    init_db(settings.database_url)
    await create_tables()
    print("✓ Database tables ready")

    # ── Ollama ────────────────────────────────────────────────────────────────
    await _wait_for_ollama(settings.ollama_host)
    await _ensure_model(settings.ollama_host, settings.ollama_model)

    yield
