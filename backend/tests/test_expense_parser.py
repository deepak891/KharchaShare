"""
Unit tests for OllamaExpenseParser.

The Ollama client is replaced with an AsyncMock — no network, no model required.
Each test covers one behaviour of the parser in isolation.
"""

import json
import pytest

from services.expense_parser import OllamaExpenseParser


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_response(payload: dict) -> dict:
    return {"message": {"content": json.dumps(payload)}}


VALID_PAYLOAD = {
    "description": "Dinner",
    "total": 3200.0,
    "currency": "INR",
    "paid_by": None,
    "splits": [
        {"person": "Deepak", "amount": 1200.0, "percentage": 37.5},
        {"person": "Raj",    "amount": 800.0,  "percentage": 25.0},
        {"person": "Priya",  "amount": 1200.0, "percentage": 37.5},
    ],
    "notes": "Raj excluded from drinks",
    "confidence": 0.9,
}

PARTICIPANTS = ["Deepak", "Raj", "Priya"]


# ── Happy-path tests ──────────────────────────────────────────────────────────

class TestOllamaExpenseParserHappyPath:
    @pytest.mark.asyncio
    async def test_parse_returns_parsed_expense(self, mock_ollama_client):
        parser = OllamaExpenseParser(client=mock_ollama_client, model="qwen2.5:7b")
        result = await parser.parse("Dinner 3200 Raj no drinks", PARTICIPANTS)

        assert result.total == 3200.0
        assert result.description == "Dinner"
        assert result.currency == "INR"
        assert result.confidence == 0.9

    @pytest.mark.asyncio
    async def test_parse_returns_all_participants(self, mock_ollama_client):
        parser = OllamaExpenseParser(client=mock_ollama_client, model="qwen2.5:7b")
        result = await parser.parse("Dinner 3200", PARTICIPANTS)

        persons = {s.person for s in result.splits}
        assert persons == set(PARTICIPANTS)

    @pytest.mark.asyncio
    async def test_parse_amounts_sum_to_total(self, mock_ollama_client):
        parser = OllamaExpenseParser(client=mock_ollama_client, model="qwen2.5:7b")
        result = await parser.parse("Dinner 3200", PARTICIPANTS)

        assert sum(s.amount for s in result.splits) == pytest.approx(result.total)

    @pytest.mark.asyncio
    async def test_parse_model_is_passed_to_client(self, mock_ollama_client):
        parser = OllamaExpenseParser(client=mock_ollama_client, model="qwen2.5:3b")
        await parser.parse("test", ["A"])

        call_kwargs = mock_ollama_client.chat.call_args
        assert call_kwargs.kwargs["model"] == "qwen2.5:3b"


# ── Missing-participant backfill ──────────────────────────────────────────────

class TestMissingParticipantBackfill:
    @pytest.mark.asyncio
    async def test_missing_participant_gets_zero_amount(self, mock_ollama_client):
        """Model omits 'Priya' from splits — parser must add her with ₹0."""
        payload = {**VALID_PAYLOAD, "splits": [
            {"person": "Deepak", "amount": 1600.0, "percentage": 50.0},
            {"person": "Raj",    "amount": 1600.0, "percentage": 50.0},
        ]}
        mock_ollama_client.chat.return_value = _make_response(payload)

        parser = OllamaExpenseParser(client=mock_ollama_client, model="qwen2.5:7b")
        result = await parser.parse("Dinner", PARTICIPANTS)

        persons = {s.person for s in result.splits}
        assert "Priya" in persons
        priya = next(s for s in result.splits if s.person == "Priya")
        assert priya.amount == 0.0


# ── Rounding correction ───────────────────────────────────────────────────────

class TestRoundingCorrection:
    @pytest.mark.asyncio
    async def test_rounding_remainder_absorbed(self, mock_ollama_client):
        """Model returns amounts that are off by 0.01 — parser must fix the sum."""
        payload = {**VALID_PAYLOAD, "total": 100.0, "splits": [
            {"person": "Deepak", "amount": 33.33, "percentage": 33.33},
            {"person": "Raj",    "amount": 33.33, "percentage": 33.33},
            {"person": "Priya",  "amount": 33.33, "percentage": 33.33},
        ]}
        mock_ollama_client.chat.return_value = _make_response(payload)

        parser = OllamaExpenseParser(client=mock_ollama_client, model="qwen2.5:7b")
        result = await parser.parse("Dinner 100", PARTICIPANTS)

        assert sum(s.amount for s in result.splits) == pytest.approx(100.0)


# ── Error handling ────────────────────────────────────────────────────────────

class TestErrorHandling:
    @pytest.mark.asyncio
    async def test_invalid_json_raises_value_error(self, mock_ollama_client):
        mock_ollama_client.chat.return_value = {"message": {"content": "not json at all"}}

        parser = OllamaExpenseParser(client=mock_ollama_client, model="qwen2.5:7b")
        with pytest.raises(ValueError, match="invalid JSON"):
            await parser.parse("anything", ["A", "B"])

    @pytest.mark.asyncio
    async def test_markdown_fenced_json_is_cleaned(self, mock_ollama_client):
        """Model wraps response in ```json ... ``` despite format='json'."""
        fenced = "```json\n" + json.dumps(VALID_PAYLOAD) + "\n```"
        mock_ollama_client.chat.return_value = {"message": {"content": fenced}}

        parser = OllamaExpenseParser(client=mock_ollama_client, model="qwen2.5:7b")
        result = await parser.parse("Dinner 3200", PARTICIPANTS)

        assert result.total == 3200.0

    @pytest.mark.asyncio
    async def test_ollama_client_exception_propagates(self, mock_ollama_client):
        mock_ollama_client.chat.side_effect = ConnectionError("Ollama unreachable")

        parser = OllamaExpenseParser(client=mock_ollama_client, model="qwen2.5:7b")
        with pytest.raises(ConnectionError):
            await parser.parse("anything", ["A"])
