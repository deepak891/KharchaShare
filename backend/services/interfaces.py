"""
Service interfaces (Protocols) for the KharchaShare backend.

Route handlers and other high-level modules depend on these abstractions,
never on concrete implementations.  This allows:
  - Swapping OllamaExpenseParser for a cloud-based parser without touching routes.
  - Swapping InMemoryGroupRepository for a DB-backed one without touching routes.
  - Injecting stubs/fakes in tests without monkey-patching.
"""

from typing import Protocol, runtime_checkable

from models.schemas import (
    CreateExpenseRequest, CreateGroupRequest,
    Debt, Expense, Group, MemberBalance,
    ParsedExpense, SettleDebtRequest, SplitResult,
)



@runtime_checkable
class ExpenseParserProtocol(Protocol):
    """Parse free-text expense descriptions into structured splits."""

    async def parse(self, text: str, participants: list[str]) -> ParsedExpense:
        """
        Parse `text` and return a fully structured ParsedExpense.

        Raises:
            ValueError: if the AI returns unparseable output.
            Exception:  if the AI service is unavailable.
        """
        ...


class SplitStrategyProtocol(Protocol):
    """Calculate how a bill should be split among participants."""

    def calculate(self, total: float, participants: list[str], **kwargs) -> list[SplitResult]:
        """
        Return one SplitResult per participant.
        All amounts must sum to `total`.
        """
        ...


class GroupRepositoryProtocol(Protocol):
    """Persist and retrieve expense groups."""

    async def create(self, request: CreateGroupRequest) -> Group:
        """Persist a new group and return it with a generated id and created_at."""
        ...

    async def list_all(self) -> list[Group]:
        """Return all groups, newest first."""
        ...

    async def get(self, group_id: str) -> Group | None:
        """Return a single group by id, or None if not found."""
        ...

    async def add_member(self, group_id: str, member: str) -> Group | None:
        """Add a member to a group. Returns the updated group, or None if not found."""
        ...


class ExpenseRepositoryProtocol(Protocol):
    """Persist and retrieve expenses; compute balances and debts."""

    async def create(self, group_id: str, req: CreateExpenseRequest) -> Expense:
        """Persist a new expense and return it with generated id and created_at."""
        ...

    async def list_by_group(self, group_id: str) -> list[Expense]:
        """Return all expenses for a group, newest first."""
        ...

    async def get_balances(self, group_id: str) -> list[MemberBalance]:
        """
        Return per-member net balance.
        Positive = owed to them (they overpaid), negative = they owe others.
        """
        ...

    async def get_debts(self, group_id: str) -> list[Debt]:
        """Return the minimum transactions to settle all debts in the group."""
        ...

    async def update(self, expense_id: str, req: CreateExpenseRequest) -> Expense | None:
        """
        Replace all fields of an existing expense.
        Returns the updated expense, or None if the expense_id was not found.
        """
        ...

    async def get_user_net_balance(self, group_id: str, user: str) -> float:
        """Return a single user's net balance in a group. 0.0 if no data."""
        ...

    async def redistribute_expenses(self, group_id: str, members: list[str]) -> None:
        """Recalculate all existing expense splits for a group equally across members."""
        ...

    async def settle_debt(self, group_id: str, req: SettleDebtRequest) -> Expense:
        """
        Record a settlement payment as a synthetic expense.

        from_person pays to_person the given amount.  The synthetic expense
        zeroes out both parties' outstanding balance for that debt.
        """
        ...
