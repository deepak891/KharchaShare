"""
Group repository — persistence layer for expense groups.

InMemoryGroupRepository is the current implementation.
It satisfies GroupRepositoryProtocol, so when a real database is
added the route handlers and tests need zero changes — only a new
class implementing the same protocol is required.

Threading/concurrency:
  asyncio is single-threaded, so dict operations on _groups are safe
  without locks as long as we don't yield between read and write.
  If this ever moves to a thread pool, add asyncio.Lock.
"""

from datetime import datetime, timezone
from uuid import uuid4

from models.schemas import CreateGroupRequest, Group


class InMemoryGroupRepository:
    """
    Stores groups in a plain dict keyed by group id.

    Lifetime: tied to the process — data is lost on restart.
    That is acceptable for the current phase (no auth, no persistence).
    Replace with a SQLAlchemy / SQLite implementation when persistence
    is needed; the interface stays the same.
    """

    def __init__(self) -> None:
        self._groups: dict[str, Group] = {}

    async def create(self, request: CreateGroupRequest) -> Group:
        """Assign a UUID + timestamp and persist the group."""
        group = Group(
            id=str(uuid4()),
            name=request.name,
            emoji=request.emoji,
            color=request.color,
            members=request.members,
            created_at=datetime.now(tz=timezone.utc),
            net_balance=0.0,
        )
        self._groups[group.id] = group
        return group

    async def list_all(self) -> list[Group]:
        """Return all groups sorted newest-first."""
        return sorted(
            self._groups.values(),
            key=lambda g: g.created_at,
            reverse=True,
        )

    async def get(self, group_id: str) -> Group | None:
        """Return a single group by id, or None if not found."""
        return self._groups.get(group_id)

    async def add_member(self, group_id: str, member: str) -> Group | None:
        """Append a member to the group's member list. Returns updated group or None."""
        group = self._groups.get(group_id)
        if group is None:
            return None
        updated = Group(
            id=group.id,
            name=group.name,
            emoji=group.emoji,
            color=group.color,
            members=group.members + [member],
            created_at=group.created_at,
            net_balance=group.net_balance,
        )
        self._groups[group_id] = updated
        return updated
