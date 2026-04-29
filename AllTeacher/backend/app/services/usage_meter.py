"""Per-request token-usage meter.

Why this lives in its own module
--------------------------------
We want to log every OpenAI call (which agent, which model, how many
tokens, computed cost) so the admin dashboard can plot spend over time
and pinpoint which agents are burning the most. Plumbing user_id +
curriculum_id through every agent's signature would be invasive — agents
are pure (`{input dict} → {output dict}`) and we like them that way.

Instead the orchestrator opens a meter at the start of a request via
`begin(user_id=..., curriculum_id=..., agent="...")` and the inner
agent code calls `record(model, usage)` after each `chat.completions
.create`. The meter stores the events on a ContextVar so anything inside
the same request — even nested agent calls — sees the same scope without
having to thread it through arguments. `flush()` at the end of the
request inserts the rows into `token_usage_log`.

Failure mode
------------
The meter never raises into the request path. A logged event that fails
to flush gets dropped with a warning — the user-facing response is more
important than perfect cost accounting, and the orchestrator can't
swallow exceptions on the user's behalf.
"""
from __future__ import annotations

import logging
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from config import Config
from app.db.supabase import service_client


log = logging.getLogger(__name__)


@dataclass
class _Event:
    agent: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    cost_cents: float


@dataclass
class _Scope:
    user_id: str | None = None
    curriculum_id: str | None = None
    # Default agent label written to events that didn't pass one
    # explicitly — usually set by the orchestrator before the call.
    default_agent: str = "unknown"
    events: list[_Event] = field(default_factory=list)


_scope: ContextVar[_Scope | None] = ContextVar("usage_meter_scope", default=None)


# --- public API ---------------------------------------------------------

def begin(
    *,
    user_id: str | None,
    curriculum_id: str | None = None,
    default_agent: str = "unknown",
) -> _Scope:
    """Open a fresh usage scope on the current ContextVar.

    Returns the scope so the caller can inspect totals before flush
    (the admin overview cares about per-request roll-ups too).
    """
    scope = _Scope(
        user_id=user_id,
        curriculum_id=curriculum_id,
        default_agent=default_agent,
    )
    _scope.set(scope)
    return scope


def set_agent(agent: str) -> None:
    """Update the default agent label for subsequent record() calls.

    Used by the orchestrator to flip the label as it dispatches between
    subagents within a single request: `set_agent("explainer")` →
    explainer call → `set_agent("evaluator")` → evaluator call.
    """
    scope = _scope.get()
    if scope is not None:
        scope.default_agent = agent


def record(
    *,
    model: str,
    usage: Any,
    agent: str | None = None,
) -> None:
    """Record one OpenAI call's token usage.

    `usage` is the `completion.usage` object the OpenAI SDK returns
    (has `prompt_tokens` and `completion_tokens`). We accept Any so we
    don't import the SDK type here — keeps this module agent-agnostic.
    """
    scope = _scope.get()
    if scope is None:
        # Called outside a request scope (e.g. a background script or
        # a unit test that didn't open one). Just no-op rather than
        # crash the agent.
        return

    prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
    completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)

    # Caller can attach a precomputed cost (TTS uses this — its pricing
    # is per-character, not per-token, so the meter's standard
    # `_cost_cents` lookup would massively under-bill). Honour the
    # override when present, fall back to the model-pricing table
    # otherwise.
    override = getattr(usage, "cost_cents_override", None)
    if override is not None:
        cost_cents = float(override)
    else:
        cost_cents = _cost_cents(model, prompt_tokens, completion_tokens)

    scope.events.append(
        _Event(
            agent=agent or scope.default_agent,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_cents=cost_cents,
        )
    )


def flush() -> None:
    """Persist all recorded events to token_usage_log + clear the scope.

    Best-effort: if the Supabase insert fails, log and drop. We never
    want billing telemetry to bubble up into the request response.
    """
    scope = _scope.get()
    if scope is None or not scope.events:
        _scope.set(None)
        return

    rows = [
        {
            "user_id": scope.user_id,
            "curriculum_id": scope.curriculum_id,
            "agent": ev.agent,
            "model": ev.model,
            "prompt_tokens": ev.prompt_tokens,
            "completion_tokens": ev.completion_tokens,
            # Round to 4 decimals — matches the column's numeric(12,4).
            "cost_cents": round(ev.cost_cents, 4),
        }
        for ev in scope.events
    ]

    try:
        client = service_client()
        if client is not None:
            client.table("token_usage_log").insert(rows).execute()
    except Exception as exc:  # noqa: BLE001 — telemetry must not raise
        log.warning("usage_meter flush failed: %s (dropped %d events)", exc, len(rows))
    finally:
        _scope.set(None)


def current_totals() -> dict[str, Any]:
    """Snapshot of the current scope — handy for inline diagnostics."""
    scope = _scope.get()
    if scope is None:
        return {"events": 0, "cost_cents": 0.0}
    return {
        "events": len(scope.events),
        "prompt_tokens": sum(e.prompt_tokens for e in scope.events),
        "completion_tokens": sum(e.completion_tokens for e in scope.events),
        "cost_cents": sum(e.cost_cents for e in scope.events),
    }


# --- internals ----------------------------------------------------------

def _cost_cents(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Convert token counts → cents using Config.OPENAI_PRICING_USD_PER_1K.

    Pricing is in USD; we just store cents-of-USD and let the dashboard
    decide whether to convert at display time. (EUR-denominated revenue
    is held in cents-of-EUR on `subscriptions`. The dashboard treats
    them as comparable for rough margin estimates — close enough for the
    "is the business healthy?" lens this is for.)
    """
    pricing = Config.OPENAI_PRICING_USD_PER_1K
    rates = pricing.get(model) or pricing.get("default") or {
        "prompt": 0.001,
        "completion": 0.004,
    }
    usd = (
        (prompt_tokens / 1000.0) * rates["prompt"]
        + (completion_tokens / 1000.0) * rates["completion"]
    )
    return usd * 100.0  # USD → cents
