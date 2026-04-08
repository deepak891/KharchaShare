"""
Pure-Python split calculation — no AI, just math.

Design:
  - Three Strategy classes (EqualSplit, PercentageSplit, ExclusionSplit) each
    implement SplitStrategyProtocol.  Adding a new strategy (e.g. TipIncludedSplit)
    means writing a new class — existing classes are never modified (Open/Closed).
  - Module-level helper functions (_equal_amounts, _fix_remainder) contain the
    arithmetic that the strategies share; they are kept as plain functions because
    they have no state and are tested directly.
  - optimal_settlements is a standalone utility (not a split strategy) used by
    the settle-up feature.
"""

from __future__ import annotations

import math

from models.schemas import SplitResult


# ── Arithmetic helpers (private) ──────────────────────────────────────────────

def _equal_amounts(total: float, n: int) -> list[float]:
    """
    Split `total` into `n` equal parts, distributing the rounding remainder
    to the first element.

    >>> _equal_amounts(100, 3)
    [33.34, 33.33, 33.33]
    """
    if n <= 0:
        raise ValueError("n must be >= 1")
    base = math.floor(total * 100 / n) / 100
    remainder = round(total - base * n, 2)
    result = [base] * n
    result[0] = round(result[0] + remainder, 2)
    return result


def _fix_remainder(amounts: list[float], total: float) -> list[float]:
    """Absorb floating-point rounding error into the first element."""
    diff = round(total - sum(amounts), 2)
    if abs(diff) > 0:
        amounts[0] = round(amounts[0] + diff, 2)
    return amounts


# ── Strategy classes ──────────────────────────────────────────────────────────

class EqualSplitStrategy:
    """Split the bill equally among all participants."""

    def calculate(self, total: float, participants: list[str], **_) -> list[SplitResult]:
        if not participants:
            return []
        n = len(participants)
        amounts = _equal_amounts(total, n)
        pct = round(100 / n, 2)
        return [
            SplitResult(person=p, amount=a, percentage=pct)
            for p, a in zip(participants, amounts)
        ]


class PercentageSplitStrategy:
    """Split the bill according to explicit percentages."""

    def calculate(
        self,
        total: float,
        participants: list[str],
        percentages: list[float],
        **_,
    ) -> list[SplitResult]:
        if abs(sum(percentages) - 100) > 0.01:
            raise ValueError(
                f"Percentages must sum to 100, got {sum(percentages):.2f}"
            )
        amounts = _fix_remainder(
            [round(total * p / 100, 2) for p in percentages], total
        )
        return [
            SplitResult(person=p, amount=a, percentage=pct)
            for p, a, pct in zip(participants, amounts, percentages)
        ]


class ExclusionSplitStrategy:
    """
    Split the bill when some participants are excluded from specific items.

    Example:
        total = 3200, participants = ["Deepak", "Raj", "Priya"]
        item_exclusions = {"drinks": ["Raj"]}   # Raj didn't have drinks
        item_amounts    = {"drinks": 800}        # drinks cost ₹800
        → Deepak: 1200, Raj: 800, Priya: 1200
    """

    def calculate(
        self,
        total: float,
        participants: list[str],
        item_exclusions: dict[str, list[str]] | None = None,
        item_amounts: dict[str, float] | None = None,
        **_,
    ) -> list[SplitResult]:
        item_exclusions = item_exclusions or {}
        item_amounts = item_amounts or {}
        n = len(participants)
        if n == 0:
            return []

        excluded_total = sum(item_amounts.values())
        shared_total = total - excluded_total
        shares: dict[str, float] = {p: shared_total / n for p in participants}

        for item, excludees in item_exclusions.items():
            item_cost = item_amounts.get(item, 0.0)
            payers = [p for p in participants if p not in excludees]
            if not payers:
                for p in participants:
                    shares[p] += item_cost / n
            else:
                per_payer = item_cost / len(payers)
                for p in payers:
                    shares[p] += per_payer

        rounded = {p: round(v, 2) for p, v in shares.items()}
        diff = round(total - sum(rounded.values()), 2)
        rounded[participants[0]] = round(rounded[participants[0]] + diff, 2)

        return [
            SplitResult(
                person=p,
                amount=rounded[p],
                percentage=round(rounded[p] / total * 100, 2) if total else 0.0,
            )
            for p in participants
        ]


# ── Settlement optimiser (standalone utility) ─────────────────────────────────

def optimal_settlements(balances: dict[str, float]) -> list[dict]:
    """
    Given net balances {person: amount} (positive = owed money, negative = owes money),
    compute the minimum number of transactions to settle all debts.

    Returns a list of {"from": str, "to": str, "amount": float}.

    >>> optimal_settlements({"A": 100, "B": -60, "C": -40})
    [{'from': 'B', 'to': 'A', 'amount': 60.0}, {'from': 'C', 'to': 'A', 'amount': 40.0}]
    """
    creditors = sorted(
        [(p, b) for p, b in balances.items() if b > 0.005],
        key=lambda x: -x[1],
    )
    debtors = sorted(
        [(p, -b) for p, b in balances.items() if b < -0.005],
        key=lambda x: -x[1],
    )

    transactions: list[dict] = []
    ci = di = 0

    while ci < len(creditors) and di < len(debtors):
        creditor, credit = creditors[ci]
        debtor, debt = debtors[di]
        amount = min(credit, debt)
        transactions.append({"from": debtor, "to": creditor, "amount": round(amount, 2)})

        creditors[ci] = (creditor, round(credit - amount, 2))
        debtors[di] = (debtor, round(debt - amount, 2))

        if creditors[ci][1] < 0.005:
            ci += 1
        if debtors[di][1] < 0.005:
            di += 1

    return transactions
