"""
SQLite-backed expense repository.

Implements ExpenseRepositoryProtocol using SQLAlchemy AsyncSession.
Drop-in replacement for InMemoryExpenseRepository — only dependencies.py
changes when switching between the two.

Balance algorithm is identical to the in-memory version:
  payer.net   += total − payer_split_amount
  others.net  −= their_split_amount
"""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models import ExpenseModel, ExpenseSplitModel
from models.schemas import (
    CreateExpenseRequest,
    Debt,
    Expense,
    ExpenseSplit,
    MemberBalance,
    SettleDebtRequest,
)
from services.split_calculator import optimal_settlements


def _split_models(expense_id: str, splits: list[ExpenseSplit]) -> list[ExpenseSplitModel]:
    return [
        ExpenseSplitModel(
            id=str(uuid4()),
            expense_id=expense_id,
            person=s.person,
            amount=s.amount,
            percentage=s.percentage,
        )
        for s in splits
    ]


def _to_schema(model: ExpenseModel) -> Expense:
    return Expense(
        id=model.id,
        group_id=model.group_id,
        description=model.description,
        total=model.total,
        currency=model.currency,
        paid_by=model.paid_by,
        notes=model.notes,
        created_at=model.created_at,
        splits=[
            ExpenseSplit(person=s.person, amount=s.amount, percentage=s.percentage)
            for s in model.splits
        ],
    )


class SQLiteExpenseRepository:
    """Persists expenses and splits in SQLite via SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ── Write ─────────────────────────────────────────────────────────────────

    async def create(self, group_id: str, req: CreateExpenseRequest) -> Expense:
        expense_id = str(uuid4())
        now = datetime.now(timezone.utc)

        model = ExpenseModel(
            id=expense_id,
            group_id=group_id,
            description=req.description,
            total=req.total,
            currency=req.currency,
            paid_by=req.paid_by,
            notes=req.notes,
            created_at=now,
            splits=_split_models(expense_id, req.splits),
        )
        self._session.add(model)
        await self._session.commit()
        return _to_schema(model)

    async def update(self, expense_id: str, req: CreateExpenseRequest) -> Expense | None:
        result = await self._session.execute(
            select(ExpenseModel)
            .options(selectinload(ExpenseModel.splits))
            .where(ExpenseModel.id == expense_id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            return None

        # Update scalar fields
        model.description = req.description
        model.total       = req.total
        model.currency    = req.currency
        model.paid_by     = req.paid_by
        model.notes       = req.notes

        # Replace splits: delete old, insert new
        await self._session.execute(
            delete(ExpenseSplitModel).where(ExpenseSplitModel.expense_id == expense_id)
        )
        for split_model in _split_models(expense_id, req.splits):
            self._session.add(split_model)

        await self._session.commit()

        # Re-fetch so splits relationship is fresh
        result = await self._session.execute(
            select(ExpenseModel)
            .options(selectinload(ExpenseModel.splits))
            .where(ExpenseModel.id == expense_id)
        )
        return _to_schema(result.scalar_one())

    # ── Read ──────────────────────────────────────────────────────────────────

    async def list_by_group(self, group_id: str) -> list[Expense]:
        result = await self._session.execute(
            select(ExpenseModel)
            .options(selectinload(ExpenseModel.splits))
            .where(ExpenseModel.group_id == group_id)
            .order_by(ExpenseModel.created_at.desc())
        )
        return [_to_schema(m) for m in result.scalars().all()]

    async def get_balances(self, group_id: str) -> list[MemberBalance]:
        expenses = await self.list_by_group(group_id)
        balances: dict[str, float] = {}

        for expense in expenses:
            payer = expense.paid_by
            for split in expense.splits:
                if split.person == payer:
                    balances[payer] = balances.get(payer, 0.0) + (expense.total - split.amount)
                else:
                    balances[split.person] = balances.get(split.person, 0.0) - split.amount

        return [
            MemberBalance(person=p, net=round(n, 2))
            for p, n in sorted(balances.items())
        ]

    async def get_debts(self, group_id: str) -> list[Debt]:
        balances = await self.get_balances(group_id)
        settlements = optimal_settlements({mb.person: mb.net for mb in balances})
        return [
            Debt(from_person=s["from"], to_person=s["to"], amount=s["amount"])
            for s in settlements
        ]

    async def get_user_net_balance(self, group_id: str, user: str) -> float:
        for mb in await self.get_balances(group_id):
            if mb.person == user:
                return mb.net
        return 0.0

    async def redistribute_expenses(self, group_id: str, members: list[str]) -> None:
        """Recalculate every expense in the group as an equal split across members."""
        result = await self._session.execute(
            select(ExpenseModel)
            .options(selectinload(ExpenseModel.splits))
            .where(ExpenseModel.group_id == group_id)
        )
        expenses = result.scalars().all()
        n = len(members)
        pct = round(100.0 / n, 4)

        for expense in expenses:
            base = round(expense.total / n, 2)
            remainder = round(expense.total - base * n, 2)

            await self._session.execute(
                delete(ExpenseSplitModel).where(ExpenseSplitModel.expense_id == expense.id)
            )
            for i, member in enumerate(members):
                amount = base if i < n - 1 else round(base + remainder, 2)
                self._session.add(ExpenseSplitModel(
                    id=str(uuid4()),
                    expense_id=expense.id,
                    person=member,
                    amount=amount,
                    percentage=pct,
                ))

        await self._session.commit()

    async def settle_debt(self, group_id: str, req: SettleDebtRequest) -> Expense:
        """Record a settlement as a synthetic expense that zeroes both parties' balance."""
        settle_req = CreateExpenseRequest(
            description=f"Settlement: {req.from_person} → {req.to_person}",
            total=req.amount,
            currency="INR",
            paid_by=req.from_person,
            splits=[
                ExpenseSplit(person=req.from_person, amount=0.0,       percentage=0.0),
                ExpenseSplit(person=req.to_person,   amount=req.amount, percentage=100.0),
            ],
            notes="Manual settlement",
        )
        return await self.create(group_id, settle_req)
