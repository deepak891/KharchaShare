"""
Shared pytest fixtures for the KharchaShare test suite.

Fixture hierarchy:
  app         → FastAPI instance with fake services injected (no Ollama, isolated repo)
  client      → TestClient wrapping that app (synchronous, for route tests)
  mock_ollama → AsyncMock of ollama.AsyncClient (for unit-testing the parser)

Each integration test session gets its own InMemoryGroupRepository so group
tests are isolated from each other and from the production singleton.
"""

import json
import pytest
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient

from main import create_app
from api.dependencies import get_expense_parser, get_expense_repository, get_group_repository
from models.schemas import CreateGroupRequest, Group, ParsedExpense, SplitResult
from services.expense_repository import InMemoryExpenseRepository
from services.group_repository import InMemoryGroupRepository


# ── Fake expense parser (no Ollama required) ──────────────────────────────────

class FakeExpenseParser:
    """Deterministic stub that splits equally and ignores the text content."""

    async def parse(self, text: str, participants: list[str]) -> ParsedExpense:
        n = len(participants)
        amount = round(300.0 / n, 2)
        return ParsedExpense(
            description="Dinner",
            total=300.0,
            currency="INR",
            paid_by=None,
            splits=[
                SplitResult(person=p, amount=amount, percentage=round(100 / n, 2))
                for p in participants
            ],
            notes="Stub: equal split",
            confidence=1.0,
        )


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def app():
    """
    FastAPI app with all external dependencies overridden:
      - FakeExpenseParser  → no Ollama needed
      - InMemoryGroupRepository (fresh instance) → isolated from production singleton
    """
    test_group_repo   = InMemoryGroupRepository()
    test_expense_repo = InMemoryExpenseRepository()
    application = create_app()
    application.dependency_overrides[get_expense_parser]    = lambda: FakeExpenseParser()
    application.dependency_overrides[get_group_repository]  = lambda: test_group_repo
    application.dependency_overrides[get_expense_repository] = lambda: test_expense_repo
    return application


@pytest.fixture(scope="session")
def client(app):
    return TestClient(app, raise_server_exceptions=True)


@pytest.fixture
def mock_ollama_client():
    """
    Pre-wired AsyncMock for ollama.AsyncClient.chat.
    Tests that need different payloads can override mock_ollama_client.chat.return_value.
    """
    raw_response = json.dumps({
        "description": "Dinner",
        "total": 3200.0,
        "currency": "INR",
        "paid_by": None,
        "splits": [
            {"person": "Deepak", "amount": 1200.0, "percentage": 37.5},
            {"person": "Raj",    "amount": 800.0,  "percentage": 25.0},
            {"person": "Priya",  "amount": 1200.0, "percentage": 37.5},
        ],
        "notes": "Raj excluded from drinks portion",
        "confidence": 0.9,
    })
    mock = AsyncMock()
    mock.chat.return_value = {"message": {"content": raw_response}}
    return mock
