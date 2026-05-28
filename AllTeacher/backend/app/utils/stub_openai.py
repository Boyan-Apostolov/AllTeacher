"""Stub OpenAI client for load / smoke testing.

Activated when the STUB_AGENTS environment variable is set to any truthy
value (e.g. ``STUB_AGENTS=true``).  Returns canned JSON responses instead
of hitting the real OpenAI API — zero cost, deterministic, ~instant.

Usage
-----
Export the env var before starting Flask:

    STUB_AGENTS=true LOAD_TEST_SECRET=mysecret flask run

The stub inspects the ``json_schema.name`` field in ``response_format`` to
pick the right canned payload, so every agent gets a structurally valid
response and won't crash on JSON parsing.

Streaming evaluator
-------------------
``chat.completions.create(stream=True)`` returns a minimal iterator that
yields a single delta + a [DONE] sentinel, enough to keep the SSE route
happy.
"""
from __future__ import annotations

import json
import time
import types
from typing import Any, Iterator


# ── canned agent payloads ────────────────────────────────────────────────────

_CANNED: dict[str, Any] = {
    # Assessor — return a ready-made summary on the first call
    "assessor_response": {
        "kind": "complete",
        "question": None,
        "summary": {
            "level": "beginner",
            "learning_style": "practice",
            "time_budget_mins_per_week": 60,
            "domain": "language",
            "target_language": "fr",
            "notes": "Stub assessment — load test mode.",
        },
    },
    # Planner
    "planner_response": {
        "weeks": [
            {
                "week_number": 1,
                "theme": "Introduction",
                "objectives": ["Understand basics", "Build vocabulary"],
                "modules": [
                    {
                        "title": "Greetings",
                        "description": "Common greetings and introductions.",
                        "skills": ["listening", "speaking"],
                    }
                ],
            }
        ],
        "total_weeks": 4,
        "notes": "Stub plan — load test mode.",
    },
    # Explainer / lesson
    "lesson_response": {
        "title": "Greetings",
        "body": "In this lesson you will learn basic greetings. Bonjour means hello.",
        "key_points": ["Bonjour = Hello", "Au revoir = Goodbye"],
        "language": "en",
    },
    # Exercise writer
    "exercises_response": {
        "exercises": [
            {
                "type": "multiple_choice",
                "prompt": "What does 'Bonjour' mean?",
                "options": ["Hello", "Goodbye", "Thank you", "Please"],
                "answer": "Hello",
                "explanation": "'Bonjour' is the standard French greeting.",
            }
        ]
    },
    # Evaluator
    "evaluator_response": {
        "score": 85,
        "feedback": "Good work! Your answer is mostly correct.",
        "weak_areas": [],
        "strong_areas": ["vocabulary"],
        "next_steps": "Continue to the next exercise.",
    },
    # Adapter
    "adapter_response": {
        "adjustments": [],
        "notes": "No adjustments needed — stub mode.",
    },
    # Tracker
    "tracker_response": {
        "mastery": 0.7,
        "completed_modules": 1,
        "streak_days": 1,
    },
}

_DEFAULT_PAYLOAD = {"stub": True, "message": "No canned payload for this schema."}


# ── helpers ──────────────────────────────────────────────────────────────────

def _make_usage():
    """Fake usage object with token counts of zero."""
    return types.SimpleNamespace(
        prompt_tokens=0,
        completion_tokens=0,
        total_tokens=0,
    )


def _make_choice(content: str):
    return types.SimpleNamespace(
        message=types.SimpleNamespace(
            content=content,
            parsed=None,
            role="assistant",
        ),
        finish_reason="stop",
        index=0,
    )


def _make_completion(schema_name: str):
    payload = _CANNED.get(schema_name, _DEFAULT_PAYLOAD)
    content = json.dumps(payload)
    return types.SimpleNamespace(
        id="stub-cmpl-0",
        model="stub",
        object="chat.completion",
        created=int(time.time()),
        choices=[_make_choice(content)],
        usage=_make_usage(),
    )


def _make_stream(schema_name: str) -> Iterator:
    """Minimal SSE-style iterator for streaming calls."""
    payload = _CANNED.get(schema_name, _DEFAULT_PAYLOAD)
    content = json.dumps(payload)

    # Yield a single content delta then a final chunk
    delta_chunk = types.SimpleNamespace(
        id="stub-cmpl-0",
        model="stub",
        object="chat.completion.chunk",
        created=int(time.time()),
        choices=[
            types.SimpleNamespace(
                delta=types.SimpleNamespace(content=content, role="assistant"),
                finish_reason=None,
                index=0,
            )
        ],
        usage=None,
        parsed=None,
    )
    stop_chunk = types.SimpleNamespace(
        id="stub-cmpl-0",
        model="stub",
        object="chat.completion.chunk",
        created=int(time.time()),
        choices=[
            types.SimpleNamespace(
                delta=types.SimpleNamespace(content="", role=None),
                finish_reason="stop",
                index=0,
            )
        ],
        usage=_make_usage(),
        parsed=payload,
    )

    yield delta_chunk
    yield stop_chunk


# ── stub completions namespace ────────────────────────────────────────────────

class _StubCompletions:
    def create(self, *, messages=None, response_format=None, stream=False, **_kwargs):
        # Determine which canned payload to return from the schema name.
        schema_name = ""
        if isinstance(response_format, dict):
            schema_name = (
                response_format.get("json_schema", {}).get("name", "")
                or response_format.get("name", "")
            )

        if stream:
            return _make_stream(schema_name)
        return _make_completion(schema_name)


class _StubChat:
    completions = _StubCompletions()


# ── public stub client ────────────────────────────────────────────────────────

class StubOpenAIClient:
    """Drop-in replacement for the real OpenAI client.

    Implements only the surface area used by AllTeacher agents:
      - client.chat.completions.create(...)
    """

    chat = _StubChat()

    # Agents occasionally access client.models or client.audio — stub them.
    class _Noop:
        def __getattr__(self, _name):
            def _stub(*_a, **_kw):
                return None
            return _stub

    models = _Noop()
    audio = _Noop()
