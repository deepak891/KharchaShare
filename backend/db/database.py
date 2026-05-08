"""
SQLAlchemy async engine and session factory.

Call init_db(url) once at startup (lifespan.py).
Use get_db() as a FastAPI dependency to get a per-request AsyncSession.

URL examples:
  SQLite (local dev):  sqlite+aiosqlite:///./kharchashare.db
  PostgreSQL (prod):   postgresql+asyncpg://user:pass@host/dbname
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from db.models import Base

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def init_db(database_url: str) -> AsyncEngine:
    """
    Initialise the engine and session factory.

    Must be called before any repository is used (done in lifespan.py).
    Returns the engine so the caller can run create_all on it.
    """
    global _engine, _session_factory

    connect_args = {}
    if database_url.startswith("sqlite"):
        # Disable SQLite's check_same_thread restriction — asyncio runs
        # queries on a thread pool; we manage thread safety via the async driver.
        connect_args = {"check_same_thread": False}

    _engine = create_async_engine(
        database_url,
        echo=False,          # set True to log all SQL (useful for debugging)
        connect_args=connect_args,
    )
    _session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,   # keep objects usable after commit without re-querying
    )
    return _engine


async def create_tables() -> None:
    """Create all tables that don't already exist. Safe to call on every startup."""
    if _engine is None:
        raise RuntimeError("init_db() must be called before create_tables()")
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency — yields a session for the duration of one request.

    FastAPI caches Depends() results within a request, so two route params
    that both Depend on get_db will share the same session (and the same
    transaction), which is the correct behaviour.
    """
    if _session_factory is None:
        raise RuntimeError("init_db() must be called before get_db()")
    async with _session_factory() as session:
        yield session
