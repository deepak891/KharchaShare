"""
Unit tests for InMemoryGroupRepository.

No HTTP, no mocking — tests exercise the repository class directly.
Each test gets a fresh repository instance so state never bleeds between tests.
"""

import pytest

from models.schemas import CreateGroupRequest
from services.group_repository import InMemoryGroupRepository


@pytest.fixture
def repo() -> InMemoryGroupRepository:
    """Fresh repository per test — no shared state."""
    return InMemoryGroupRepository()


@pytest.fixture
def sample_request() -> CreateGroupRequest:
    return CreateGroupRequest(
        name="Goa Trip",
        emoji="✈️",
        color="#DBEAFE",
        members=["Deepak", "Raj", "Priya"],
    )


# ── create ────────────────────────────────────────────────────────────────────

class TestCreate:
    @pytest.mark.asyncio
    async def test_returns_group_with_generated_id(self, repo, sample_request):
        group = await repo.create(sample_request)
        assert group.id
        assert len(group.id) == 36  # UUID4 format

    @pytest.mark.asyncio
    async def test_fields_match_request(self, repo, sample_request):
        group = await repo.create(sample_request)
        assert group.name == "Goa Trip"
        assert group.emoji == "✈️"
        assert group.color == "#DBEAFE"
        assert group.members == ["Deepak", "Raj", "Priya"]

    @pytest.mark.asyncio
    async def test_net_balance_starts_at_zero(self, repo, sample_request):
        group = await repo.create(sample_request)
        assert group.net_balance == 0.0

    @pytest.mark.asyncio
    async def test_created_at_is_set(self, repo, sample_request):
        group = await repo.create(sample_request)
        assert group.created_at is not None

    @pytest.mark.asyncio
    async def test_each_group_gets_unique_id(self, repo, sample_request):
        g1 = await repo.create(sample_request)
        g2 = await repo.create(sample_request)
        assert g1.id != g2.id

    @pytest.mark.asyncio
    async def test_group_is_persisted(self, repo, sample_request):
        group = await repo.create(sample_request)
        all_groups = await repo.list_all()
        assert any(g.id == group.id for g in all_groups)


# ── list_all ──────────────────────────────────────────────────────────────────

class TestListAll:
    @pytest.mark.asyncio
    async def test_empty_repository_returns_empty_list(self, repo):
        assert await repo.list_all() == []

    @pytest.mark.asyncio
    async def test_returns_all_created_groups(self, repo, sample_request):
        await repo.create(sample_request)
        await repo.create(CreateGroupRequest(
            name="Weekend Trip", emoji="🏠", color="#DCFCE7", members=["A", "B"],
        ))
        groups = await repo.list_all()
        assert len(groups) == 2

    @pytest.mark.asyncio
    async def test_newest_first_ordering(self, repo):
        first = await repo.create(CreateGroupRequest(
            name="First", emoji="1️⃣", color="#DBEAFE", members=["A"],
        ))
        second = await repo.create(CreateGroupRequest(
            name="Second", emoji="2️⃣", color="#DCFCE7", members=["B"],
        ))
        groups = await repo.list_all()
        assert groups[0].id == second.id
        assert groups[1].id == first.id
