"""Per-request logging middleware.

Registers three Flask hooks on the app:

  before_request   — generate a unique request_id, record start time
  after_request    — log method/path/status/duration to:
                       • Python logger (stdout)
                       • PostHog (api_request event)
                       • Supabase `request_logs` table
  teardown_request — log any unhandled exception that escaped the route

Usage (in create_app):

    from app.middleware.request_logging import register_request_logging
    register_request_logging(app)
"""
from __future__ import annotations

import logging
import time
import uuid

from flask import Flask, g, request

from app.db.supabase import service_client
from app.utils.posthog_client import get_ph_client

log = logging.getLogger(__name__)


def register_request_logging(app: Flask) -> None:
    """Attach the three request-lifecycle hooks to the Flask app."""

    @app.before_request
    def _before():
        g.request_id  = str(uuid.uuid4())
        g.request_t0  = time.monotonic()

    @app.after_request
    def _after(response):
        duration_ms = int((time.monotonic() - g.get("request_t0", time.monotonic())) * 1000)
        request_id  = g.get("request_id", "unknown")
        user_id     = g.get("user_id")
        status      = response.status_code
        method      = request.method
        path        = request.path
        endpoint    = request.endpoint or ""

        # ── 1. Python logger ─────────────────────────────────────────────
        log.info(
            "%s %s → %d (%dms)",
            method, path, status, duration_ms,
            extra={
                "request_id":  request_id,
                "user_id":     user_id,
                "status":      status,
                "duration_ms": duration_ms,
                "endpoint":    endpoint,
            },
        )

        # ── 2. PostHog event ─────────────────────────────────────────────
        ph = get_ph_client()
        ph.capture(
            distinct_id=user_id or "anonymous",
            event="api_request",
            properties={
                "request_id":  request_id,
                "method":      method,
                "path":        path,
                "endpoint":    endpoint,
                "status_code": status,
                "duration_ms": duration_ms,
            },
        )

        # ── 3. Supabase request_logs ─────────────────────────────────────
        _insert_request_log(
            request_id=request_id,
            user_id=user_id,
            method=method,
            path=path,
            endpoint=endpoint,
            status_code=status,
            duration_ms=duration_ms,
            error=None,
        )

        return response

    @app.teardown_request
    def _teardown(exc):
        if exc is None:
            return

        duration_ms = int((time.monotonic() - g.get("request_t0", time.monotonic())) * 1000)
        request_id  = g.get("request_id", "unknown")
        user_id     = g.get("user_id")
        error_msg   = f"{type(exc).__name__}: {exc}"

        # ── 1. Python logger ─────────────────────────────────────────────
        log.error(
            "Unhandled exception on %s %s — %s",
            request.method, request.path, error_msg,
            exc_info=exc,
            extra={
                "request_id":  request_id,
                "user_id":     user_id,
                "duration_ms": duration_ms,
            },
        )

        # ── 2. PostHog error event ────────────────────────────────────────
        ph = get_ph_client()
        ph.capture(
            distinct_id=user_id or "anonymous",
            event="api_error",
            properties={
                "request_id":  request_id,
                "method":      request.method,
                "path":        request.path,
                "endpoint":    request.endpoint or "",
                "duration_ms": duration_ms,
                "error":       error_msg,
            },
        )

        # ── 3. Supabase request_logs ─────────────────────────────────────
        _insert_request_log(
            request_id=request_id,
            user_id=user_id,
            method=request.method,
            path=request.path,
            endpoint=request.endpoint or "",
            status_code=500,
            duration_ms=duration_ms,
            error=error_msg,
        )


# ── helpers ──────────────────────────────────────────────────────────────────

def _insert_request_log(
    *,
    request_id: str,
    user_id: str | None,
    method: str,
    path: str,
    endpoint: str,
    status_code: int,
    duration_ms: int,
    error: str | None,
) -> None:
    """Best-effort insert into request_logs. Never raises."""
    try:
        db = service_client()
        if db is None:
            return
        db.table("request_logs").insert({
            "request_id":  request_id,
            "user_id":     user_id,
            "method":      method,
            "path":        path,
            "endpoint":    endpoint,
            "status_code": status_code,
            "duration_ms": duration_ms,
            "error":       error,
        }).execute()
    except Exception as exc:  # noqa: BLE001
        log.warning("request_logs insert failed: %s", exc)
