"""
Group expense routes.

Endpoints
---------
POST /api/groups/{group_id}/expenses                  Add an expense (splits pre-computed by caller)
GET  /api/groups/{group_id}/expenses                  List expenses, newest first
PUT  /api/groups/{group_id}/expenses/{expense_id}     Update an expense; balances/debts auto-recalculate
GET  /api/groups/{group_id}/balances                  Per-member net balance
GET  /api/groups/{group_id}/debts                     Minimum transactions to settle all debts

All write/read logic lives in the repositories.
Route handlers validate, delegate, and map errors to HTTP status codes.
"""

from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_expense_repository, get_group_repository
from models.schemas import CreateExpenseRequest, Debt, Expense, MemberBalance, SettleDebtRequest
from services.interfaces import ExpenseRepositoryProtocol, GroupRepositoryProtocol

router = APIRouter(prefix="/api", tags=["group-expenses"])


async def _require_group(group_id: str, repo: GroupRepositoryProtocol) -> None:
    """Raise 404 if the group does not exist."""
    groups = await repo.list_all()
    if not any(g.id == group_id for g in groups):
        raise HTTPException(status_code=404, detail=f"Group '{group_id}' not found")


@router.post("/groups/{group_id}/expenses", response_model=Expense, status_code=201)
async def add_expense(
    group_id: str,
    req: CreateExpenseRequest,
    group_repo: GroupRepositoryProtocol = Depends(get_group_repository),
    expense_repo: ExpenseRepositoryProtocol = Depends(get_expense_repository),
) -> Expense:
    """
    Add an expense to a group.

    The caller is responsible for computing splits (equal or otherwise)
    before sending the request.  The backend stores and validates, it does
    not recalculate splits here.

    Example request body:
        {
          "description": "Dinner at Dhaba",
          "total": 3200,
          "currency": "INR",
          "paid_by": "Raj",
          "splits": [
            {"person": "Deepak", "amount": 1066.67, "percentage": 33.33},
            {"person": "Raj",    "amount": 1066.67, "percentage": 33.33},
            {"person": "Priya",  "amount": 1066.66, "percentage": 33.34}
          ],
          "notes": "Equal split"
        }
    """
    await _require_group(group_id, group_repo)
    try:
        return await expense_repo.create(group_id, req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not add expense: {exc}") from exc


@router.put("/groups/{group_id}/expenses/{expense_id}", response_model=Expense)
async def update_expense(
    group_id: str,
    expense_id: str,
    req: CreateExpenseRequest,
    group_repo: GroupRepositoryProtocol = Depends(get_group_repository),
    expense_repo: ExpenseRepositoryProtocol = Depends(get_expense_repository),
) -> Expense:
    """
    Replace an existing expense's fields.

    Balances and debts recalculate automatically — they are always derived
    live from the expense list, so no extra step is needed after an update.
    """
    await _require_group(group_id, group_repo)
    updated = await expense_repo.update(expense_id, req)
    if updated is None:
        raise HTTPException(status_code=404, detail=f"Expense '{expense_id}' not found")
    return updated


@router.get("/groups/{group_id}/expenses", response_model=list[Expense])
async def list_expenses(
    group_id: str,
    group_repo: GroupRepositoryProtocol = Depends(get_group_repository),
    expense_repo: ExpenseRepositoryProtocol = Depends(get_expense_repository),
) -> list[Expense]:
    """Return all expenses in a group, newest first."""
    await _require_group(group_id, group_repo)
    return await expense_repo.list_by_group(group_id)


@router.get("/groups/{group_id}/balances", response_model=list[MemberBalance])
async def get_balances(
    group_id: str,
    group_repo: GroupRepositoryProtocol = Depends(get_group_repository),
    expense_repo: ExpenseRepositoryProtocol = Depends(get_expense_repository),
) -> list[MemberBalance]:
    """
    Per-member net balance in this group.

    Positive net = others owe this person (they covered more than their share).
    Negative net = this person owes others (they paid less than their share).
    """
    await _require_group(group_id, group_repo)
    return await expense_repo.get_balances(group_id)


@router.post("/groups/{group_id}/settle", response_model=Expense, status_code=201)
async def settle_debt(
    group_id: str,
    req: SettleDebtRequest,
    group_repo: GroupRepositoryProtocol = Depends(get_group_repository),
    expense_repo: ExpenseRepositoryProtocol = Depends(get_expense_repository),
) -> Expense:
    """
    Mark a debt as manually settled by recording a synthetic settlement expense.

    This zeroes both parties' outstanding balance for the given amount.
    After calling this endpoint, re-fetch /balances and /debts to see the updated state.
    """
    await _require_group(group_id, group_repo)
    try:
        return await expense_repo.settle_debt(group_id, req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not record settlement: {exc}") from exc


@router.get("/groups/{group_id}/debts", response_model=list[Debt])
async def get_debts(
    group_id: str,
    group_repo: GroupRepositoryProtocol = Depends(get_group_repository),
    expense_repo: ExpenseRepositoryProtocol = Depends(get_expense_repository),
) -> list[Debt]:
    """
    Minimum set of transactions to fully settle all debts in this group.

    Uses the optimal settlement algorithm: O(n log n), minimises transaction count.
    """
    await _require_group(group_id, group_repo)
    return await expense_repo.get_debts(group_id)
