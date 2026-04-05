"""
Pydantic request and response schemas for the KharchaShare API.

All models live here — route handlers and services both import from this module,
so there is a single source of truth for the API contract.
"""

from datetime import datetime

from pydantic import BaseModel, field_validator


# ── Expense parsing ───────────────────────────────────────────────────────────

class ParseExpenseRequest(BaseModel):
    text: str
    participants: list[str]

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text cannot be empty")
        return v

    @field_validator("participants")
    @classmethod
    def participants_not_empty(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("participants cannot be empty")
        return v


class SplitResult(BaseModel):
    person: str
    amount: float
    percentage: float


class ParsedExpense(BaseModel):
    description: str
    total: float
    currency: str
    paid_by: str | None
    splits: list[SplitResult]
    notes: str
    confidence: float


# ── Groups ────────────────────────────────────────────────────────────────────

class CreateGroupRequest(BaseModel):
    name: str
    emoji: str
    color: str          # hex string, e.g. "#DBEAFE"
    members: list[str]

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name cannot be empty")
        return v.strip()

    @field_validator("members")
    @classmethod
    def members_not_empty(cls, v: list[str]) -> list[str]:
        filtered = [m.strip() for m in v if m.strip()]
        if not filtered:
            raise ValueError("at least one member is required")
        return filtered


class Group(BaseModel):
    id: str
    name: str
    emoji: str
    color: str          # hex — used as emojiBg on the frontend
    members: list[str]
    created_at: datetime
    net_balance: float  # current user's net; 0.0 at creation
    is_settled: bool = False  # True only when group has expenses and ALL member balances are zero


# ── Expenses ─────────────────────────────────────────────────────────────────

class ExpenseSplit(BaseModel):
    person: str
    amount: float
    percentage: float


class Expense(BaseModel):
    id: str
    group_id: str
    description: str
    total: float
    currency: str = "INR"
    paid_by: str
    splits: list[ExpenseSplit]
    notes: str = ""
    created_at: datetime


class CreateExpenseRequest(BaseModel):
    description: str
    total: float
    currency: str = "INR"
    paid_by: str
    splits: list[ExpenseSplit]
    notes: str = ""

    @field_validator("description")
    @classmethod
    def description_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("description cannot be empty")
        return v.strip()

    @field_validator("total")
    @classmethod
    def total_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("total must be positive")
        return v


class MemberBalance(BaseModel):
    person: str
    net: float  # positive = owed to them, negative = they owe


class Debt(BaseModel):
    from_person: str  # who owes
    to_person: str    # who is owed
    amount: float


# ── Group membership ─────────────────────────────────────────────────────────

class AddMemberRequest(BaseModel):
    member: str
    redistribute_past: bool = False  # True = recalculate all past splits equally

    @field_validator("member")
    @classmethod
    def member_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("member name cannot be empty")
        return v.strip()


# ── Settlement ───────────────────────────────────────────────────────────────

class SettleDebtRequest(BaseModel):
    from_person: str   # who is paying
    to_person: str     # who is being paid
    amount: float

    @field_validator("from_person", "to_person")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("person name cannot be empty")
        return v.strip()

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


# ── Simple equal split ────────────────────────────────────────────────────────

class EqualSplitRequest(BaseModel):
    total: float
    participants: list[str]
    paid_by: str | None = None
