"""
Unit tests for split_calculator.py.

These tests are pure math — no mocking, no network, no filesystem.
They run in milliseconds and should never be skipped.
"""

import pytest

from services.split_calculator import (
    EqualSplitStrategy,
    ExclusionSplitStrategy,
    PercentageSplitStrategy,
    _equal_amounts,
    optimal_settlements,
)


# ── _equal_amounts (private helper) ──────────────────────────────────────────

class TestEqualAmounts:
    def test_three_people_remainder_to_first(self):
        assert _equal_amounts(100, 3) == [33.34, 33.33, 33.33]

    def test_exact_division_no_remainder(self):
        assert _equal_amounts(90, 3) == [30.0, 30.0, 30.0]

    def test_two_people(self):
        amounts = _equal_amounts(100, 2)
        assert sum(amounts) == pytest.approx(100.0)
        assert len(amounts) == 2

    def test_single_person(self):
        assert _equal_amounts(500, 1) == [500.0]

    def test_invalid_n_raises(self):
        with pytest.raises(ValueError, match="n must be >= 1"):
            _equal_amounts(100, 0)


# ── EqualSplitStrategy ────────────────────────────────────────────────────────

class TestEqualSplitStrategy:
    strategy = EqualSplitStrategy()

    def test_amounts_sum_to_total(self):
        results = self.strategy.calculate(3200, ["Deepak", "Raj", "Priya"])
        assert sum(r.amount for r in results) == pytest.approx(3200.0)

    def test_all_participants_present(self):
        participants = ["Deepak", "Raj", "Priya"]
        results = self.strategy.calculate(3200, participants)
        assert [r.person for r in results] == participants

    def test_percentages_sum_to_100(self):
        results = self.strategy.calculate(100, ["A", "B", "C"])
        assert sum(r.percentage for r in results) == pytest.approx(100.0, abs=0.1)

    def test_empty_participants_returns_empty(self):
        assert self.strategy.calculate(100, []) == []

    def test_single_participant_gets_full_amount(self):
        results = self.strategy.calculate(500, ["Solo"])
        assert results[0].amount == 500.0
        assert results[0].percentage == 100.0


# ── PercentageSplitStrategy ───────────────────────────────────────────────────

class TestPercentageSplitStrategy:
    strategy = PercentageSplitStrategy()

    def test_basic_split(self):
        results = self.strategy.calculate(1200, ["A", "B", "C"], percentages=[50, 25, 25])
        amounts = {r.person: r.amount for r in results}
        assert amounts["A"] == pytest.approx(600.0)
        assert amounts["B"] == pytest.approx(300.0)
        assert amounts["C"] == pytest.approx(300.0)

    def test_amounts_sum_to_total(self):
        results = self.strategy.calculate(1000, ["X", "Y"], percentages=[33.33, 66.67])
        assert sum(r.amount for r in results) == pytest.approx(1000.0)

    def test_percentages_not_100_raises(self):
        with pytest.raises(ValueError, match="sum to 100"):
            self.strategy.calculate(1000, ["A", "B"], percentages=[60, 60])

    def test_percentages_exactly_100_accepted(self):
        results = self.strategy.calculate(100, ["A", "B"], percentages=[40, 60])
        assert len(results) == 2


# ── ExclusionSplitStrategy ────────────────────────────────────────────────────

class TestExclusionSplitStrategy:
    strategy = ExclusionSplitStrategy()
    participants = ["Deepak", "Raj", "Priya"]

    def test_raj_no_drinks(self):
        results = self.strategy.calculate(
            3200,
            self.participants,
            item_exclusions={"drinks": ["Raj"]},
            item_amounts={"drinks": 800},
        )
        shares = {r.person: r.amount for r in results}
        assert shares["Raj"] < shares["Deepak"]
        assert shares["Raj"] < shares["Priya"]

    def test_amounts_sum_to_total(self):
        results = self.strategy.calculate(
            3200,
            self.participants,
            item_exclusions={"drinks": ["Raj"]},
            item_amounts={"drinks": 800},
        )
        assert sum(r.amount for r in results) == pytest.approx(3200.0)

    def test_no_exclusions_equal_split(self):
        results = self.strategy.calculate(300, ["A", "B", "C"])
        amounts = [r.amount for r in results]
        assert max(amounts) - min(amounts) <= 0.01  # effectively equal

    def test_empty_participants(self):
        assert self.strategy.calculate(100, []) == []

    def test_all_excluded_falls_back_to_shared(self):
        """If everyone is excluded from an item it reverts to shared cost."""
        results = self.strategy.calculate(
            300,
            ["A", "B"],
            item_exclusions={"item": ["A", "B"]},
            item_amounts={"item": 100},
        )
        assert sum(r.amount for r in results) == pytest.approx(300.0)


# ── optimal_settlements ───────────────────────────────────────────────────────

class TestOptimalSettlements:
    def test_basic_two_debtors(self):
        txns = optimal_settlements({"A": 100, "B": -60, "C": -40})
        assert len(txns) == 2
        assert sum(t["amount"] for t in txns) == pytest.approx(100.0)

    def test_all_settled_no_transactions(self):
        assert optimal_settlements({"A": 0, "B": 0}) == []

    def test_single_debtor_single_creditor(self):
        txns = optimal_settlements({"Deepak": 500, "Raj": -500})
        assert len(txns) == 1
        assert txns[0]["from"] == "Raj"
        assert txns[0]["to"] == "Deepak"
        assert txns[0]["amount"] == 500.0

    def test_amounts_balance_to_zero(self):
        balances = {"A": 150, "B": -100, "C": -50}
        txns = optimal_settlements(balances)
        net: dict[str, float] = {}
        for t in txns:
            net[t["from"]] = net.get(t["from"], 0) - t["amount"]
            net[t["to"]]   = net.get(t["to"],   0) + t["amount"]
        for person, balance in balances.items():
            assert net.get(person, 0) == pytest.approx(balance, abs=0.01)
