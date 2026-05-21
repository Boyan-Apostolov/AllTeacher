"""Exceptions raised by the orchestrator.

Every error carries an HTTP status hint so the route layer can map them to a
response without having to switch on the exception class.
"""
from __future__ import annotations


class OrchestratorError(Exception):
    """Base class for orchestrator failures. `status` is an HTTP code hint."""

    status: int = 500
    code: str = "orchestrator_error"

    def __init__(
        self,
        code: str | None = None,
        status: int | None = None,
        detail: str | None = None,
    ):
        if code is not None:
            self.code = code
        if status is not None:
            self.status = status
        super().__init__(detail or self.code)


class NotFound(OrchestratorError):
    status = 404
    code = "not_found"


class Conflict(OrchestratorError):
    status = 409


class BadAgentResponse(OrchestratorError):
    status = 500
    code = "bad_agent_response"


__all__ = [
    "OrchestratorError",
    "NotFound",
    "Conflict",
    "BadAgentResponse",
]
