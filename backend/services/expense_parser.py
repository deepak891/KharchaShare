"""
OllamaExpenseParser — converts free-text expense descriptions into structured splits
using a locally-running Ollama model (qwen2.5:7b by default).

Design notes:
  - The Ollama client is injected via __init__ (Dependency Inversion).
    The module never reads os.getenv or creates its own client.
  - Three private methods each have one job:
      _build_prompt   → prompt engineering only
      _extract_json   → JSON extraction / cleaning only
      _validate       → rounding correction + missing-participant backfill only
  - parse() is the only public surface — callers only need to know about ParsedExpense.
"""

import json
import re

import ollama

from models.schemas import ParsedExpense, SplitResult

_SYSTEM_PROMPT = """\
You are an expense splitting assistant for KharchaShare, a bill-splitting app used in India.

Parse the user's expense description and return a JSON split.

You understand:
- Indian context: INR is the default currency, common expenses include dhabas, cabs, hotels, trips
- Item exclusions: "Raj didn't have drinks" → reduce Raj's share by the drink portion
- Dietary splits: vegetarians don't pay for meat dishes
- Paid-by attribution: "paid by Rahul" → Rahul fronted the money
- Ambiguous totals: set confidence < 0.6 if the amount isn't clear

Always return ONLY a valid JSON object matching the exact schema provided. No prose, no markdown.\
"""


class OllamaExpenseParser:
    """
    Implements ExpenseParserProtocol using a locally-running Ollama model.

    Args:
        client: An ollama.AsyncClient (injected — never created here).
        model:  The Ollama model name to use for inference.
    """

    def __init__(self, client: ollama.AsyncClient, model: str) -> None:
        self._client = client
        self._model = model

    async def parse(self, text: str, participants: list[str]) -> ParsedExpense:
        """
        Call the Ollama model and return a validated ParsedExpense.

        Raises:
            ValueError: if the model returns unparseable output.
        """
        response = await self._client.chat(
            model=self._model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": self._build_prompt(text, participants)},
            ],
            format="json",
            options={
                "temperature": 0.1,
                "num_predict": 512,
            },
        )

        raw: str = response["message"]["content"]

        try:
            data = self._extract_json(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"Model returned invalid JSON: {exc}\nRaw output: {raw[:300]}"
            ) from exc

        return self._validate(data, participants)

    # ── Private helpers ───────────────────────────────────────────────────────

    def _build_prompt(self, text: str, participants: list[str]) -> str:
        joined = ", ".join(participants)
        return f"""Expense description: "{text}"
Participants: {joined}

Return this JSON schema exactly (no other text):
{{
  "description": "<1-3 word name, e.g. Dinner>",
  "total": <number>,
  "currency": "INR",
  "paid_by": "<name or null>",
  "splits": [
    {{"person": "<exact participant name>", "amount": <number>, "percentage": <number>}}
  ],
  "notes": "<one sentence explaining the split logic>",
  "confidence": <0.0–1.0>
}}

Rules:
- splits must include ALL of: {joined}
- amounts in splits must sum to total (round to nearest rupee)
- percentages must sum to 100
- set confidence < 0.6 if total is missing or ambiguous"""

    @staticmethod
    def _extract_json(raw: str) -> dict:
        """
        Strip markdown code fences if the model added them despite format='json',
        then parse.  Falls back to regex extraction if there is surrounding text.
        """
        text = raw.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
        text = text.strip()

        if not text.startswith("{"):
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                text = match.group()

        return json.loads(text)

    @staticmethod
    def _validate(data: dict, participants: list[str]) -> ParsedExpense:
        """
        Ensure every participant has a split entry and that amounts sum exactly
        to total.  Distributes any rounding remainder to the largest-share person.
        """
        total = float(data["total"])
        splits_by_person: dict[str, dict] = {
            s["person"]: s for s in data.get("splits", [])
        }

        for p in participants:
            if p not in splits_by_person:
                splits_by_person[p] = {"person": p, "amount": 0.0, "percentage": 0.0}

        remainder = round(total - sum(s["amount"] for s in splits_by_person.values()), 2)
        if abs(remainder) > 0:
            largest = max(splits_by_person.values(), key=lambda s: s["amount"])
            largest["amount"] = round(largest["amount"] + remainder, 2)

        for s in splits_by_person.values():
            s["percentage"] = round((s["amount"] / total * 100) if total else 0.0, 2)

        return ParsedExpense(
            description=data.get("description", ""),
            total=total,
            currency=data.get("currency", "INR"),
            paid_by=data.get("paid_by"),
            splits=[SplitResult(**s) for s in splits_by_person.values()],
            notes=data.get("notes", ""),
            confidence=float(data.get("confidence", 0.0)),
        )
