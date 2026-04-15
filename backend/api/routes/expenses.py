"""
Expense routes — AI-powered parsing and voice input (placeholder).
"""

from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_expense_parser
from models.schemas import ParsedExpense, ParseExpenseRequest
from services.interfaces import ExpenseParserProtocol

router = APIRouter(prefix="/api", tags=["expenses"])


@router.post("/parse-expense", response_model=ParsedExpense)
async def parse_expense(
    req: ParseExpenseRequest,
    parser: ExpenseParserProtocol = Depends(get_expense_parser),
) -> ParsedExpense:
    """
    Parse a free-text expense description with AI and return a structured split.

    Example:
        text: "We had dinner, total 3200, Raj didn't have drinks, split accordingly"
        participants: ["Deepak", "Raj", "Priya"]
    """
    try:
        return await parser.parse(req.text, req.participants)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"AI service error: {exc}") from exc


@router.post("/parse-voice", response_model=ParsedExpense)
async def parse_voice() -> None:
    """Voice-to-expense (placeholder). Will accept audio bytes via Ollama multimodal."""
    raise HTTPException(
        status_code=501,
        detail="Voice input coming soon — will use Ollama multimodal capabilities",
    )
