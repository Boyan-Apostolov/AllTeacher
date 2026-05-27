"""PostHog client + PostHog-wrapped OpenAI client.

Two singletons live here:

  get_ph_client()      → the raw PostHog client for manual event capture
  get_openai_client()  → an OpenAI client wrapped by PostHog so every
                         chat.completions.create call is automatically
                         recorded as an LLM trace in PostHog's
                         observability dashboard (model, tokens, latency,
                         cost, input/output messages).

Agents should import `get_openai_client` instead of constructing their
own `OpenAI(api_key=...)`. The wrapper is transparent — the returned
object has exactly the same API as the real OpenAI client.

PostHog config (add to .env):
  POSTHOG_API_KEY=phc_xxx
  POSTHOG_HOST=https://eu.i.posthog.com   # or https://us.i.posthog.com

If POSTHOG_API_KEY is not set the PostHog client is a no-op stub that
swallows all calls silently, so the app runs fine without PostHog in
local dev.
"""
from __future__ import annotations

import logging

from config import Config

log = logging.getLogger(__name__)


# ── PostHog client ────────────────────────────────────────────────────────────

_ph_client = None


def get_ph_client():
    """Return the singleton PostHog client (or a no-op stub if unconfigured)."""
    global _ph_client
    if _ph_client is not None:
        return _ph_client

    if not Config.POSTHOG_API_KEY:
        log.debug("POSTHOG_API_KEY not set — PostHog is disabled")
        _ph_client = _NoopPostHog()
        return _ph_client

    try:
        import posthog  # noqa: PLC0415
        client = posthog.Posthog(
            Config.POSTHOG_API_KEY,
            host=Config.POSTHOG_HOST,
        )
        _ph_client = client
        log.info("PostHog client initialised (host=%s)", Config.POSTHOG_HOST)
    except ImportError:
        log.warning("posthog package not installed — PostHog is disabled")
        _ph_client = _NoopPostHog()

    return _ph_client


# ── PostHog-wrapped OpenAI client ─────────────────────────────────────────────

_openai_client = None


def get_openai_client():
    """Return a fresh OpenAI client per call, wrapped with PostHog if available.

    We intentionally do NOT cache a singleton here. The OpenAI SDK manages
    an internal httpx connection pool, and a streaming response that is
    abandoned mid-flight (e.g. the iOS client disconnects) can leave a
    connection stuck in that pool. With a singleton, the next caller tries
    to reuse that stuck connection and hangs. A per-call client is cheap
    to construct (no network round-trip in __init__) and avoids the
    connection-pool exhaustion problem entirely.

    A 55-second read timeout is set so that a genuinely stuck OpenAI call
    raises APITimeoutError, which the @retry_openai decorator catches and
    retries with backoff instead of hanging the request indefinitely.

    PostHog wrapping is applied on top of the plain client so every
    chat.completions call is automatically recorded as an LLM trace. The
    wrap is purely additive — it intercepts the call, fires an async event
    to PostHog's background queue, and returns the real response unchanged.
    If wrap_openai is unavailable the plain client is returned as-is.
    """
    import httpx  # noqa: PLC0415
    from openai import OpenAI  # noqa: PLC0415
    if not Config.OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not configured")

    # Plain client — used as fallback if PostHog wrapping fails.
    client = OpenAI(
        api_key=Config.OPENAI_API_KEY,
        timeout=httpx.Timeout(
            connect=10.0,
            read=55.0,
            write=10.0,
            pool=5.0,
        ),
    )

    ph = get_ph_client()
    if isinstance(ph, _NoopPostHog):
        return client

    # PostHog v7+ replaced wrap_openai with a drop-in OpenAI subclass.
    # We pass posthog_client so traces go to our project. distinct_id is
    # left unset here — pass `posthog_distinct_id=user_id` per-call if
    # you want traces linked to a specific user in the LLM dashboard.
    try:
        from posthog.ai.openai.openai import OpenAI as PostHogOpenAI  # noqa: PLC0415
        ph_client = PostHogOpenAI(
            api_key=Config.OPENAI_API_KEY,
            posthog_client=ph,
            timeout=httpx.Timeout(
                connect=10.0,
                read=55.0,
                write=10.0,
                pool=5.0,
            ),
        )
        log.info("OpenAI client wrapped with PostHog LLM observability")
        return ph_client
    except ImportError:
        log.warning("posthog.ai.openai not found — LLM traces disabled")
        return client
    except Exception as exc:
        log.warning("PostHog OpenAI init failed (%s) — using plain client", exc)
        return client


# ── no-op stub ────────────────────────────────────────────────────────────────

class _NoopPostHog:
    """Drop-in stub used when PostHog is unconfigured or the package is missing.

    Swallows all method calls so the rest of the code never has to branch on
    whether PostHog is enabled.
    """

    def capture(self, *args, **kwargs):
        pass

    def identify(self, *args, **kwargs):
        pass

    def group(self, *args, **kwargs):
        pass

    def flush(self):
        pass

    def shutdown(self):
        pass
