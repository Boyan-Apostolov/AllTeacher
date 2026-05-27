"""Retry decorator for transient OpenAI API errors.

Usage:

    from app.utils.retry import retry_openai

    @retry_openai
    def _call_openai(client, messages):
        return client.chat.completions.create(...)

Retries on:
  - RateLimitError    (429 — quota hit, back off and try again)
  - APIConnectionError (network blip)
  - APITimeoutError   (slow response)

Strategy: exponential backoff — 1 s, 2 s, 4 s — then re-raises on the
fourth failure. Other OpenAI errors (BadRequestError, AuthenticationError,
etc.) are NOT retried — they indicate a problem with the request itself and
retrying would just waste tokens.
"""
from __future__ import annotations

import functools
import logging
import time
from typing import Callable, TypeVar

from openai import APIConnectionError, APITimeoutError, RateLimitError

log = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable)

_RETRYABLE = (RateLimitError, APIConnectionError, APITimeoutError)
_MAX_ATTEMPTS = 4          # 1 original + 3 retries
_BASE_DELAY   = 1.0        # seconds


def retry_openai(fn: F) -> F:
    """Decorator: retry `fn` on transient OpenAI errors with exponential backoff."""

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        delay = _BASE_DELAY
        for attempt in range(1, _MAX_ATTEMPTS + 1):
            try:
                return fn(*args, **kwargs)
            except _RETRYABLE as exc:
                if attempt == _MAX_ATTEMPTS:
                    log.error(
                        "OpenAI call failed after %d attempts: %s",
                        _MAX_ATTEMPTS,
                        exc,
                        extra={"attempt": attempt, "error_type": type(exc).__name__},
                    )
                    raise
                log.warning(
                    "Transient OpenAI error (%s), retrying in %.0fs (attempt %d/%d)",
                    type(exc).__name__,
                    delay,
                    attempt,
                    _MAX_ATTEMPTS - 1,
                    extra={"attempt": attempt, "error_type": type(exc).__name__, "delay_s": delay},
                )
                time.sleep(delay)
                delay *= 2   # exponential backoff

    return wrapper  # type: ignore[return-value]
