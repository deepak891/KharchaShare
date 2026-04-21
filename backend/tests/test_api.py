"""
Integration tests for the HTTP API layer.

All external dependencies (Ollama, production group repository) are replaced
via dependency_overrides in conftest.py.  These tests exercise the full
FastAPI request/response cycle — routing, validation, serialisation — with
no network I/O.
"""

import pytest


# ── /health ───────────────────────────────────────────────────────────────────

class TestHealth:
    def test_returns_200(self, client):
        r = client.get("/health")
        assert r.status_code == 200

    def test_body_has_status_ok(self, client):
        r = client.get("/health")
        assert r.json()["status"] == "ok"

    def test_body_has_model_and_host(self, client):
        r = client.get("/health")
        body = r.json()
        assert "model" in body
        assert "ollama_host" in body


# ── POST /api/parse-expense ───────────────────────────────────────────────────

class TestParseExpense:
    _valid = {
        "text": "Dinner ₹300, split equally",
        "participants": ["Deepak", "Raj", "Priya"],
    }

    def test_valid_request_returns_200(self, client):
        r = client.post("/api/parse-expense", json=self._valid)
        assert r.status_code == 200

    def test_response_has_expected_fields(self, client):
        r = client.post("/api/parse-expense", json=self._valid)
        body = r.json()
        for field in ("description", "total", "currency", "splits", "confidence"):
            assert field in body, f"Missing field: {field}"

    def test_splits_count_matches_participants(self, client):
        r = client.post("/api/parse-expense", json=self._valid)
        assert len(r.json()["splits"]) == len(self._valid["participants"])

    def test_splits_amounts_sum_to_total(self, client):
        r = client.post("/api/parse-expense", json=self._valid)
        body = r.json()
        assert sum(s["amount"] for s in body["splits"]) == pytest.approx(body["total"])

    def test_empty_text_returns_422(self, client):
        r = client.post("/api/parse-expense",
                        json={"text": "   ", "participants": ["A", "B"]})
        assert r.status_code == 422

    def test_empty_participants_returns_422(self, client):
        r = client.post("/api/parse-expense",
                        json={"text": "Dinner 300", "participants": []})
        assert r.status_code == 422

    def test_missing_text_field_returns_422(self, client):
        r = client.post("/api/parse-expense", json={"participants": ["A"]})
        assert r.status_code == 422

    def test_missing_participants_field_returns_422(self, client):
        r = client.post("/api/parse-expense", json={"text": "Dinner 300"})
        assert r.status_code == 422


# ── POST /api/split/equal ─────────────────────────────────────────────────────

class TestSplitEqual:
    _valid = {"total": 300.0, "participants": ["Deepak", "Raj", "Priya"]}

    def test_valid_request_returns_200(self, client):
        r = client.post("/api/split/equal", json=self._valid)
        assert r.status_code == 200

    def test_returns_list(self, client):
        r = client.post("/api/split/equal", json=self._valid)
        assert isinstance(r.json(), list)

    def test_each_entry_has_person_amount_percentage(self, client):
        r = client.post("/api/split/equal", json=self._valid)
        for entry in r.json():
            assert "person" in entry
            assert "amount" in entry
            assert "percentage" in entry

    def test_amounts_sum_to_total(self, client):
        r = client.post("/api/split/equal", json=self._valid)
        total = sum(e["amount"] for e in r.json())
        assert total == pytest.approx(self._valid["total"])

    def test_count_matches_participants(self, client):
        r = client.post("/api/split/equal", json=self._valid)
        assert len(r.json()) == len(self._valid["participants"])

    def test_two_people_split(self, client):
        r = client.post("/api/split/equal",
                        json={"total": 100.0, "participants": ["A", "B"]})
        amounts = [e["amount"] for e in r.json()]
        assert sum(amounts) == pytest.approx(100.0)


# ── POST /api/parse-voice ─────────────────────────────────────────────────────

class TestParseVoice:
    def test_returns_501(self, client):
        r = client.post("/api/parse-voice")
        assert r.status_code == 501

    def test_body_mentions_coming_soon(self, client):
        r = client.post("/api/parse-voice")
        assert "coming soon" in r.json()["detail"].lower()


# ── POST /api/groups ──────────────────────────────────────────────────────────

class TestCreateGroup:
    _valid = {
        "name": "Goa Trip 2026",
        "emoji": "✈️",
        "color": "#DBEAFE",
        "members": ["Deepak", "Raj", "Priya"],
    }

    def test_valid_request_returns_201(self, client):
        r = client.post("/api/groups", json=self._valid)
        assert r.status_code == 201

    def test_response_has_generated_id(self, client):
        r = client.post("/api/groups", json=self._valid)
        body = r.json()
        assert "id" in body
        assert len(body["id"]) == 36  # UUID4

    def test_response_fields_match_request(self, client):
        r = client.post("/api/groups", json=self._valid)
        body = r.json()
        assert body["name"] == self._valid["name"]
        assert body["emoji"] == self._valid["emoji"]
        assert body["color"] == self._valid["color"]
        assert body["members"] == self._valid["members"]

    def test_net_balance_starts_at_zero(self, client):
        r = client.post("/api/groups", json=self._valid)
        assert r.json()["net_balance"] == 0.0

    def test_created_at_is_present(self, client):
        r = client.post("/api/groups", json=self._valid)
        assert "created_at" in r.json()

    def test_empty_name_returns_422(self, client):
        r = client.post("/api/groups", json={**self._valid, "name": "   "})
        assert r.status_code == 422

    def test_empty_members_returns_422(self, client):
        r = client.post("/api/groups", json={**self._valid, "members": []})
        assert r.status_code == 422

    def test_whitespace_only_members_filtered_returns_422(self, client):
        r = client.post("/api/groups", json={**self._valid, "members": ["  ", ""]})
        assert r.status_code == 422

    def test_missing_name_returns_422(self, client):
        payload = {k: v for k, v in self._valid.items() if k != "name"}
        r = client.post("/api/groups", json=payload)
        assert r.status_code == 422


# ── GET /api/groups ───────────────────────────────────────────────────────────

class TestListGroups:
    def test_returns_200(self, client):
        r = client.get("/api/groups")
        assert r.status_code == 200

    def test_returns_list(self, client):
        r = client.get("/api/groups")
        assert isinstance(r.json(), list)

    def test_created_group_appears_in_list(self, client):
        payload = {
            "name": "ListTest Group",
            "emoji": "🏠",
            "color": "#DCFCE7",
            "members": ["Alice", "Bob"],
        }
        client.post("/api/groups", json=payload)
        groups = client.get("/api/groups").json()
        names = [g["name"] for g in groups]
        assert "ListTest Group" in names

    def test_newest_group_is_first(self, client):
        client.post("/api/groups", json={
            "name": "Older Group", "emoji": "🎉", "color": "#FEF3C7", "members": ["X"],
        })
        client.post("/api/groups", json={
            "name": "Newer Group", "emoji": "🌊", "color": "#EDE9FE", "members": ["Y"],
        })
        groups = client.get("/api/groups").json()
        # The most recently created group must appear before older ones
        newer_idx = next(i for i, g in enumerate(groups) if g["name"] == "Newer Group")
        older_idx = next(i for i, g in enumerate(groups) if g["name"] == "Older Group")
        assert newer_idx < older_idx

    def test_each_group_has_required_fields(self, client):
        client.post("/api/groups", json={
            "name": "Field Check", "emoji": "🎓", "color": "#FEE2E2", "members": ["Z"],
        })
        groups = client.get("/api/groups").json()
        for group in groups:
            for field in ("id", "name", "emoji", "color", "members", "created_at", "net_balance"):
                assert field in group, f"Missing field '{field}' in group response"
