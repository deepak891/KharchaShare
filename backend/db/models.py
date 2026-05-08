"""
SQLAlchemy ORM table definitions for KharchaShare.

Four tables:
  groups         — one row per group
  group_members  — one row per member per group (preserves insertion order)
  expenses       — one row per expense
  expense_splits — one row per person per expense

All primary keys are UUIDs stored as TEXT (SQLite has no native UUID type).
Timestamps are stored as UTC with timezone info.
"""

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class GroupModel(Base):
    __tablename__ = "groups"

    id: Mapped[str]         = mapped_column(String, primary_key=True)
    name: Mapped[str]       = mapped_column(String, nullable=False)
    emoji: Mapped[str]      = mapped_column(String, nullable=False)
    color: Mapped[str]      = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), nullable=False)

    members:  Mapped[list["GroupMemberModel"]] = relationship(
        "GroupMemberModel",
        back_populates="group",
        order_by="GroupMemberModel.position",
        cascade="all, delete-orphan",
    )
    expenses: Mapped[list["ExpenseModel"]] = relationship(
        "ExpenseModel",
        back_populates="group",
        cascade="all, delete-orphan",
    )


class GroupMemberModel(Base):
    __tablename__ = "group_members"

    group_id: Mapped[str] = mapped_column(String, ForeignKey("groups.id"), primary_key=True)
    member: Mapped[str]   = mapped_column(String, primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)   # preserves insertion order

    group: Mapped["GroupModel"] = relationship("GroupModel", back_populates="members")


class ExpenseModel(Base):
    __tablename__ = "expenses"

    id: Mapped[str]          = mapped_column(String, primary_key=True)
    group_id: Mapped[str]    = mapped_column(String, ForeignKey("groups.id"), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    total: Mapped[float]     = mapped_column(Float, nullable=False)
    currency: Mapped[str]    = mapped_column(String, nullable=False, default="INR")
    paid_by: Mapped[str]     = mapped_column(String, nullable=False)
    notes: Mapped[str]       = mapped_column(String, nullable=False, default="")
    created_at: Mapped[str]  = mapped_column(DateTime(timezone=True), nullable=False)

    splits: Mapped[list["ExpenseSplitModel"]] = relationship(
        "ExpenseSplitModel",
        back_populates="expense",
        cascade="all, delete-orphan",
    )
    group: Mapped["GroupModel"] = relationship("GroupModel", back_populates="expenses")


class ExpenseSplitModel(Base):
    __tablename__ = "expense_splits"

    id: Mapped[str]            = mapped_column(String, primary_key=True)
    expense_id: Mapped[str]    = mapped_column(String, ForeignKey("expenses.id"), nullable=False)
    person: Mapped[str]        = mapped_column(String, nullable=False)
    amount: Mapped[float]      = mapped_column(Float, nullable=False)
    percentage: Mapped[float]  = mapped_column(Float, nullable=False)

    expense: Mapped["ExpenseModel"] = relationship("ExpenseModel", back_populates="splits")
