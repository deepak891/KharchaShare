"""
Split routes — pure math, no AI.
"""

from fastapi import APIRouter, Depends

from api.dependencies import get_equal_split_strategy
from models.schemas import EqualSplitRequest, SplitResult
from services.split_calculator import EqualSplitStrategy

router = APIRouter(prefix="/api", tags=["splits"])


@router.post("/split/equal", response_model=list[SplitResult])
def split_equal(
    req: EqualSplitRequest,
    strategy: EqualSplitStrategy = Depends(get_equal_split_strategy),
) -> list[SplitResult]:
    """Split a bill equally among all participants — no AI involved."""
    return strategy.calculate(req.total, req.participants)
