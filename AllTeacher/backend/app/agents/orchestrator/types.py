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


class ExerciseEvalPayload(TypedDict, total=False):
    id: str
    score: float
    verdict: str
    feedback: str
    gap: str               # why this submission missed the goal
    weak_areas: list[str]
    strengths: list[str]
    next_focus: str
    status: str


class LessonPayload(TypedDict, total=False):
    id: str
    curriculum_id: str
    week_id: str
    module_index: int
    concept_title: str
    content_json: dict[str, Any]
    status: str          # 'pending' | 'ready' | 'seen'
    seen_at: str | None
    created_at: str | None


__all__ = [
    "AssessorStepPayload",
    "PlanPayload",
    "ExercisesPayload",
    "ExerciseEvalPayload",
    "LessonPayload",
]
