"""
In-memory expense repository.

Stores expenses in a dict, computes balances and debts on the fly.
When replaced with a DB-backed implementation, only this file changes.

Balance algorithm
-----------------
For each expense:
  - payer's net  += total − payer_split_amount   (they overpaid; others owe them)
  - others' net  −= their_split_amount            (they underpaid; they owe the payer)

Sum is always zero: every rupee owed is owed to someone.
"""

from datetime import datetime, timezone
from uuid import uuid4

from models.schemas import CreateExpenseRequest, Debt, Expense, ExpenseSplit, MemberBalance, SettleDebtRequest
from services.split_calculator import optimal_settlements


class InMemoryExpenseRepository:

    def __init__(self) -> None:
        self._expenses: dict[str, Expense] = {}

    # ── Write ─────────────────────────────────────────────────────────────────

    async def create(self, group_id: str, req: CreateExpenseRequest) -> Expense:
        expense = Expense(
            id=str(uuid4()),
            group_id=group_id,
            created_at=datetime.now(timezone.utc),
            **req.model_dump(),
        )
        self._expenses[expense.id] = expense
        return expense

    async def update(self, expense_id: str, req: CreateExpenseRequest) -> Expense | None:
        """Replace all mutable fields of an existing expense. id, group_id, created_at are preserved."""
        existing = self._expenses.get(expense_id)
        if existing is None:
            return None
        # Construct fresh — model_copy(update=dict) leaves nested models as raw dicts.
        updated = Expense(
            id=existing.id,
            group_id=existing.group_id,
            created_at=existing.created_at,
            **req.model_dump(),
        )
        self._expenses[expense_id] = updated
        return updated

    # ── Read ──────────────────────────────────────────────────────────────────

    async def list_by_group(self, group_id: str) -> list[Expense]:
        return sorted(
            [e for e in self._expenses.values() if e.group_id == group_id],
            key=lambda e: e.created_at,
            reverse=True,
        )

    async def get_balances(self, group_id: str) -> list[MemberBalance]:
        expenses = [e for e in self._expenses.values() if e.group_id == group_id]
        balances: dict[str, float] = {}

        for expense in expenses:
            payer = expense.paid_by
            for split in expense.splits:
                if split.person == payer:
                    # Payer gets credit for covering everyone else's share.
                    balances[payer] = balances.get(payer, 0.0) + (expense.total - split.amount)
                else:
                    # Non-payers owe the payer their share.
                    balances[split.person] = balances.get(split.person, 0.0) - split.amount

        return [
            MemberBalance(person=p, net=round(n, 2))
            for p, n in sorted(balances.items())
        ]

    async def get_debts(self, group_id: str) -> list[Debt]:
        balances = await self.get_balances(group_id)
        balance_dict = {mb.person: mb.net for mb in balances}
        settlements = optimal_settlements(balance_dict)
        return [
            Debt(from_person=s["from"], to_person=s["to"], amount=s["amount"])
            for s in settlements
        ]

    async def get_user_net_balance(self, group_id: str, user: str) -> float:
        balances = await self.get_balances(group_id)
        for mb in balances:
            if mb.person == user:
                return mb.net
        return 0.0

    async def settle_debt(self, group_id: str, req: SettleDebtRequest) -> Expense:
        """
        Record a settlement as a synthetic expense.

        Mechanics:
          paid_by = from_person (they're handing over the cash)
          splits  = [{from_person: 0}, {to_person: amount}]

        Balance impact:
          from_person net += (total − 0)  → was −amount, now 0
          to_person   net −= amount       → was +amount, now 0
        """
        settle_req = CreateExpenseRequest(
            description=f"Settlement: {req.from_person} → {req.to_person}",
            total=req.amount,
            currency="INR",
            paid_by=req.from_person,
            splits=[
                ExpenseSplit(person=req.from_person, amount=0.0, percentage=0.0),
                ExpenseSplit(person=req.to_person, amount=req.amount, percentage=100.0),
            ],
            notes="Manual settlement",
        )
        return await self.create(group_id, settle_req)

    async def redistribute_expenses(self, group_id: str, members: list[str]) -> None:
        """
        Recalculate every expense in the group with an equal split across members.

        The payer and total are preserved; only the splits array is replaced.
        Rounding remainder (if any) is absorbed by the last member.
        """
        expenses = [e for e in self._expenses.values() if e.group_id == group_id]
        n = len(members)
        pct = round(100.0 / n, 4)

        for expense in expenses:
            base = round(expense.total / n, 2)
            remainder = round(expense.total - base * n, 2)
            splits = [
                ExpenseSplit(
                    person=member,
                    amount=base if i < n - 1 else round(base + remainder, 2),
                    percentage=pct,
                )
                for i, member in enumerate(members)
            ]
            self._expenses[expense.id] = Expense(
                id=expense.id,
                group_id=expense.group_id,
                created_at=expense.created_at,
                description=expense.description,
                total=expense.total,
                currency=expense.currency,
                paid_by=expense.paid_by,
                splits=splits,
                notes=expense.notes,
            )
