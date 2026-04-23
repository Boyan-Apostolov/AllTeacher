"""Orchestrator - sequences subagents per user request.

This is a stub. The full implementation will:
  1. Detect domain (language / code / music / academic / creative / fitness / professional)
  2. Load conversation history from `sessions.conversation_history_json`
  3. Dispatch to appropriate subagent(s)
  4. Stream tokens back via SSE
  5. Persist new state (exercises, scores, mastery) to Supabase
"""
from openai import OpenAI
from config import Config


def openai_client() -> OpenAI | None:
    if not Config.OPENAI_API_KEY:
        return None
    return OpenAI(api_key=Config.OPENAI_API_KEY)


def run(user_id: str, curriculum_id: str, user_message: str, native_lang: str, target_lang: str):
    """Entry point - yields response chunks for SSE streaming.

    Subagents to call (in order, depending on state):
      assessor -> planner -> fetcher -> exercise_writer -> evaluator -> tracker -> adapter
    """
    raise NotImplementedError("orchestrator not yet implemented")
