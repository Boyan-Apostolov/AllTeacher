"""Master Orchestrator agent.

The Orchestrator is the only thing routes import from `app.agents`. It owns
the curriculum lifecycle and dispatches the appropriate subagent for each
high-level intent:

  - start_curriculum            → Assessor (first question)
  - submit_assessor_answer      → Assessor (next question / final summary)
  - generate_plan               → Planner
  - generate_exercises          → Exercise Writer
  - submit_exercise             → Evaluator (single submission scoring)
  - (future) tracker / adapter  → re-plan based on accumulated feedback

Subagents (`assessor`, `planner`, …) stay pure: they take structured input
and return structured output, no DB or HTTP. The Orchestrator owns the
Supabase reads/writes and the conditional logic between agents.

State machine on `curricula`:

       new ──[start_curriculum]──▶ assessor_status='in_progress'
                                          │
                              [submit_assessor_answer]*
                                          │
                                          ▼
                                 assessor_status='complete'
                                          │
                                  [generate_plan]
                                          │
                                          ▼
                                 planner_status='complete'
                                          │
                                  (Exercise Writer, Evaluator,
                                   Tracker, Adapter — TBD)

This module is intentionally not async — Flask routes are sync today. We
can swap to async later without touching route code.

The implementation is split across a few files for readability — each
covers one phase of the lifecycle:

  - errors.py      : OrchestratorError + subclasses (HTTP status hints)
  - types.py       : TypedDict response shapes
  - _base.py       : `db` + row loaders shared by every phase
  - _assessment.py : Assessor + Planner phase
  - _exercises.py  : Exercise Writer + Evaluator phase
"""
from __future__ import annotations

from ._assessment import _AssessmentMixin
from ._base import _OrchestratorBase
from ._exercises import _ExercisesMixin
from .errors import (
    BadAgentResponse,
    Conflict,
    NotFound,
    OrchestratorError,
)
from .types import (
    AssessorStepPayload,
    ExerciseEvalPayload,
    ExercisesPayload,
    PlanPayload,
)


class Orchestrator(_AssessmentMixin, _ExercisesMixin, _OrchestratorBase):
    """Stateless object built per-request — pass the Supabase client in.

    Composes the per-phase mixins onto `_OrchestratorBase`, which owns the
    `db` handle and shared row loaders. Routes call methods directly on
    instances of this class; they don't need to know about the split.
    """


__all__ = [
    "Orchestrator",
    "OrchestratorError",
    "NotFound",
    "Conflict",
    "BadAgentResponse",
    "AssessorStepPayload",
    "PlanPayload",
    "ExercisesPayload",
    "ExerciseEvalPayload",
]
