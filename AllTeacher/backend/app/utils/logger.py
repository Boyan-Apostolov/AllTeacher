"""Structured logging setup.

Call `configure_logging()` once in the app factory. After that, every
module gets a properly configured logger via the standard:

    log = logging.getLogger(__name__)

Format:
  - Development  : human-readable coloured lines (easy to read in terminal)
  - Production   : JSON lines (one JSON object per line, easy for log aggregators)

The JSON format includes: timestamp, level, logger name, message, and any
extra fields passed via the `extra` kwarg to log calls:

    log.info("plan generated", extra={"curriculum_id": cid, "duration_ms": 120})
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone


# ── formatters ──────────────────────────────────────────────────────────────

class _JsonFormatter(logging.Formatter):
    """Emit one JSON object per log record."""

    # Fields that live on every LogRecord but aren't useful in JSON output.
    _SKIP = frozenset({
        "args", "created", "exc_info", "exc_text", "filename", "funcName",
        "levelno", "lineno", "message", "module", "msecs", "msg",
        "pathname", "process", "processName", "relativeCreated", "stack_info",
        "taskName", "thread", "threadName",
    })

    def format(self, record: logging.LogRecord) -> str:
        record.message = record.getMessage()
        if record.exc_info:
            record.exc_text = self.formatException(record.exc_info)

        out: dict = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.message,
        }

        if record.exc_text:
            out["exc"] = record.exc_text

        # Include any extra= fields the caller passed in.
        for key, val in record.__dict__.items():
            if key not in self._SKIP and not key.startswith("_"):
                out[key] = val

        return json.dumps(out, default=str)


_DEV_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
_DEV_DATE   = "%H:%M:%S"


# ── public API ───────────────────────────────────────────────────────────────

def configure_logging(env: str = "development") -> None:
    """Configure the root logger.  Call once at app startup."""
    root = logging.getLogger()
    root.setLevel(logging.DEBUG if env == "development" else logging.INFO)

    # Remove any handlers already attached (e.g. by Flask's default setup).
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)

    if env == "production":
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter(_DEV_FORMAT, datefmt=_DEV_DATE))

    root.addHandler(handler)

    # Quiet down noisy third-party libraries.
    for lib in (
        "httpx", "httpcore", "openai", "posthog",
        "werkzeug", "hpack", "urllib3", "h2", "h11",
        "asyncio", "supabase", "httpx._client",
    ):
        logging.getLogger(lib).setLevel(logging.WARNING)
