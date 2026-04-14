"""
Group routes — create and list expense groups.

Endpoints
---------
POST  /api/groups          Create a new group
GET   /api/groups          List all groups, newest first; pass ?user=Name to
                           populate net_balance for that user across all groups.

Route handlers are intentionally thin: Pydantic validates the request,
the repository does the work, the handler maps errors to HTTP status codes.
No business logic lives here.
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_expense_repository, get_group_repository
from models.schemas import AddMemberRequest, CreateGroupRequest, Group
from services.interfaces import ExpenseRepositoryProtocol, GroupRepositoryProtocol

router = APIRouter(prefix="/api", tags=["groups"])


@router.post("/groups", response_model=Group, status_code=201)
async def create_group(
    req: CreateGroupRequest,
    repo: GroupRepositoryProtocol = Depends(get_group_repository),
) -> Group:
    """
    Create a new expense group.

    Example request body:
        {
          "name": "Goa Trip 2026",
          "emoji": "✈️",
          "color": "#DBEAFE",
          "members": ["Deepak", "Raj", "Priya"]
        }
    """
    try:
        return await repo.create(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not create group: {exc}") from exc


@router.post("/groups/{group_id}/members", response_model=Group)
async def add_member(
    group_id: str,
    req: AddMemberRequest,
    group_repo: GroupRepositoryProtocol = Depends(get_group_repository),
    expense_repo: ExpenseRepositoryProtocol = Depends(get_expense_repository),
) -> Group:
    """
    Add a new member to an existing group.

    - `redistribute_past: false` — member joins for future expenses only; all
      existing expense splits stay exactly as recorded.
    - `redistribute_past: true`  — every past expense in the group is recalculated
      with an equal split across ALL members (including the new one).
    """
    group = await group_repo.get(group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    if req.member in group.members:
        raise HTTPException(status_code=400, detail=f"{req.member} is already in this group")

    updated_group = await group_repo.add_member(group_id, req.member)
    if updated_group is None:
        raise HTTPException(status_code=500, detail="Failed to add member")

    if req.redistribute_past:
        await expense_repo.redistribute_expenses(group_id, updated_group.members)

    return updated_group


@router.get("/groups", response_model=list[Group])
async def list_groups(
    user: str = Query(default="Deepak", description="Populate net_balance from this member's perspective"),
    group_repo: GroupRepositoryProtocol = Depends(get_group_repository),
    expense_repo: ExpenseRepositoryProtocol = Depends(get_expense_repository),
) -> list[Group]:
    """Return all groups sorted newest first, with net_balance for the given user."""
    try:
        groups = await group_repo.list_all()
        result = []
        for group in groups:
            net = await expense_repo.get_user_net_balance(group.id, user)
            balances = await expense_repo.get_balances(group.id)
            # Settled only when the group has expenses and every member's net is ~0
            is_settled = len(balances) > 0 and all(abs(b.net) < 0.01 for b in balances)
            result.append(group.model_copy(update={"net_balance": net, "is_settled": is_settled}))
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not fetch groups: {exc}") from exc
