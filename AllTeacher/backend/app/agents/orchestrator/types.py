"""Response shapes returned by orchestrator methods.

These mirror the JSON the route layer serialises out to clients — they exist
so the type checker can catch mismatches between the orchestrator and routes.
"""
from __future__ import annotations

from typing import Any, TypedDict


class AssessorStepPayload(TypedDict, total=False):
    id: str
    next: dict[str, Any] | None        # {"question": "...", "options": [...]}
    complete: dict[str, Any] | None    # full Assessor summary


class PlanPayload(TypedDict):
    id: str
    plan: dict[str, Any]
    weeks: list[dict[str, Any]]


class ExercisesPayload(TypedDict):
    curriculum_id: str
    week_id: str | None
    exercises: list[dict[str, Any]]


class ExerciseEvalPayload(TypedDict):
    id: str
    score: float
    verdict: str
    feedback: str
    weak_areas: list[str]
    next_focus: str
    status: str


__all__ = [
    "AssessorStepPayload",
    "PlanPayload",
    "ExercisesPayload",
    "ExerciseEvalPayload",
]
