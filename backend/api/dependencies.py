"""
FastAPI dependency factories.

Route handlers receive services via Depends() — they never instantiate services
directly.  This keeps routes thin and makes the entire service layer swappable
in tests via app.dependency_overrides.

Database strategy
-----------------
- get_db() yields an AsyncSession for the duration of a single request.
- FastAPI caches Depends() within a request, so two route params that both
  Depend on get_db() share the same session (and the same transaction).
- SQLiteGroupRepository and SQLiteExpenseRepository take the session in
  __init__ — they are cheap, per-request objects with no shared state.

To switch databases change only Settings.database_url in .env (or environment):
  SQLite  → sqlite+aiosqlite:///./kharchashare.db   (default, zero setup)
  Postgres → postgresql+asyncpg://user:pass@host/db  (production)
"""

import ollama
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import Settings, get_settings
from db.database import get_db
from services.expense_parser import OllamaExpenseParser
from services.interfaces import ExpenseParserProtocol, ExpenseRepositoryProtocol, GroupRepositoryProtocol
from services.split_calculator import EqualSplitStrategy
from services.sqlite_expense_repository import SQLiteExpenseRepository
from services.sqlite_group_repository import SQLiteGroupRepository


def get_expense_parser(
    settings: Settings = Depends(get_settings),
) -> ExpenseParserProtocol:
    """Provide a fully configured OllamaExpenseParser."""
    client = ollama.AsyncClient(host=settings.ollama_host)
    return OllamaExpenseParser(client=client, model=settings.ollama_model)


def get_equal_split_strategy() -> EqualSplitStrategy:
    """Provide an EqualSplitStrategy (stateless — same instance is fine)."""
    return EqualSplitStrategy()


async def get_group_repository(
    session: AsyncSession = Depends(get_db),
) -> GroupRepositoryProtocol:
    """
    Provide a SQLiteGroupRepository backed by the request-scoped DB session.

    To swap to a different implementation (e.g. PostgreSQLGroupRepository)
    change only this function — all routes and tests are unaffected.
    """
    return SQLiteGroupRepository(session)


async def get_expense_repository(
    session: AsyncSession = Depends(get_db),
) -> ExpenseRepositoryProtocol:
    """
    Provide a SQLiteExpenseRepository backed by the request-scoped DB session.

    Same session as get_group_repository within a single request (FastAPI
    caches Depends results), so reads and writes are in the same transaction.
    """
    return SQLiteExpenseRepository(session)
