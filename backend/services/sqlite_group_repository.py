"""
SQLite-backed group repository.

Implements GroupRepositoryProtocol using SQLAlchemy AsyncSession.
Drop-in replacement for InMemoryGroupRepository — only dependencies.py
changes when switching between the two.
"""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models import GroupMemberModel, GroupModel
from models.schemas import CreateGroupRequest, Group


def _to_schema(model: GroupModel, net_balance: float = 0.0, is_settled: bool = False) -> Group:
    """Convert a GroupModel ORM object to the Pydantic Group schema."""
    return Group(
        id=model.id,
        name=model.name,
        emoji=model.emoji,
        color=model.color,
        members=[m.member for m in sorted(model.members, key=lambda m: m.position)],
        created_at=model.created_at,
        net_balance=net_balance,
        is_settled=is_settled,
    )


class SQLiteGroupRepository:
    """Persists groups in SQLite via SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, request: CreateGroupRequest) -> Group:
        group_id = str(uuid4())
        now = datetime.now(timezone.utc)

        group_model = GroupModel(
            id=group_id,
            name=request.name,
            emoji=request.emoji,
            color=request.color,
            created_at=now,
        )
        self._session.add(group_model)

        for position, member in enumerate(request.members):
            self._session.add(GroupMemberModel(
                group_id=group_id,
                member=member,
                position=position,
            ))

        await self._session.commit()
        return Group(
            id=group_id,
            name=request.name,
            emoji=request.emoji,
            color=request.color,
            members=request.members,
            created_at=now,
            net_balance=0.0,
            is_settled=False,
        )

    async def list_all(self) -> list[Group]:
        result = await self._session.execute(
            select(GroupModel)
            .options(selectinload(GroupModel.members))
            .order_by(GroupModel.created_at.desc())
        )
        return [_to_schema(g) for g in result.scalars().all()]

    async def get(self, group_id: str) -> Group | None:
        result = await self._session.execute(
            select(GroupModel)
            .options(selectinload(GroupModel.members))
            .where(GroupModel.id == group_id)
        )
        model = result.scalar_one_or_none()
        return _to_schema(model) if model else None

    async def add_member(self, group_id: str, member: str) -> Group | None:
        # Confirm group exists
        result = await self._session.execute(
            select(GroupModel)
            .options(selectinload(GroupModel.members))
            .where(GroupModel.id == group_id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            return None

        # Find the next position index
        pos_result = await self._session.execute(
            select(func.max(GroupMemberModel.position))
            .where(GroupMemberModel.group_id == group_id)
        )
        max_pos = pos_result.scalar() or -1

        self._session.add(GroupMemberModel(
            group_id=group_id,
            member=member,
            position=max_pos + 1,
        ))
        await self._session.commit()

        # Re-fetch to return updated member list
        return await self.get(group_id)
