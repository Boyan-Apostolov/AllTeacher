"""Central config — reads from environment (.env in dev)."""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    PORT = int(os.getenv("PORT", "8000"))

    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.4-nano")
    # Smaller/faster model for agents whose work doesn't benefit from
    # top-tier reasoning (e.g. the Explainer's short lessons). Falls back
    # to OPENAI_MODEL if unset so existing deploys keep current behaviour.
    # Recommended setting: gpt-4o-mini.
    OPENAI_FAST_MODEL = os.getenv("OPENAI_FAST_MODEL") or os.getenv(
        "OPENAI_MODEL", "gpt-5.4-nano"
    )

    REVENUECAT_WEBHOOK_SECRET = os.getenv("REVENUECAT_WEBHOOK_SECRET", "")

    # Third-party media APIs — optional. If not set, the orchestrator
    # silently skips video_choice generation and image decoration.
    YOUTUBE_API_KEY  = os.getenv("YOUTUBE_API_KEY", "")
    UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "")

    # Admin dashboard gating. Only requests whose verified Supabase JWT
    # email matches ADMIN_EMAIL get through the @admin_only decorator.
    # Single-account by design — there is one operator (us). Add a
    # comma-separated parser later if we ever need a small allowlist.
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "boian4934@gmail.com")

    # OpenAI pricing per 1K tokens (USD), used by the usage_meter to
    # write `cost_cents` on the token_usage_log row. Numbers come from
    # the public pricing page; update here if OpenAI changes them — the
    # ledger keeps the historical cost as recorded, so a price change
    # only affects calls made after the deploy.
    #
    # Fallback ('default') applies to any model name we haven't mapped
    # explicitly — keeps the meter from blowing up on a new model id.
    OPENAI_PRICING_USD_PER_1K: dict[str, dict[str, float]] = {
        "gpt-4o":           {"prompt": 0.0025, "completion": 0.010},
        "gpt-4o-mini":      {"prompt": 0.00015, "completion": 0.0006},
        "gpt-4.1":          {"prompt": 0.002,  "completion": 0.008},
        "gpt-4.1-mini":     {"prompt": 0.0004, "completion": 0.0016},
        "gpt-4.1-nano":     {"prompt": 0.0001, "completion": 0.0004},
        # Speculative placeholders for the gpt-5.4-* family currently set
        # as defaults — overwrite once real pricing is published.
        "gpt-5.4-nano":     {"prompt": 0.0001, "completion": 0.0004},
        "gpt-5.4-mini":     {"prompt": 0.0004, "completion": 0.0016},
        "default":          {"prompt": 0.001,  "completion": 0.004},
    }

    # OpenAI TTS pricing — flat per-character rate, not per-token. The
    # usage_meter still keys on (prompt_tokens, completion_tokens), so
    # `app/services/media.py::tts_to_url` synthesises a usage object
    # with `prompt_tokens = char_count` (and completion=0) and the
    # pricing entry below treats `prompt` as $/1K characters.
    OPENAI_TTS_USD_PER_1K_CHARS: dict[str, float] = {
        "tts-1":     0.015,   # $15 / 1M chars
        "tts-1-hd":  0.030,   # $30 / 1M chars — HD voices, deferred
    }
    # Default voice + model — overrideable per call. `alloy` is neutral
    # and gender-ambiguous, fine for language-learning prompts where we
    # don't want to bias the user toward gendered speech.
    OPENAI_TTS_MODEL = os.getenv("OPENAI_TTS_MODEL", "tts-1")
    OPENAI_TTS_VOICE = os.getenv("OPENAI_TTS_VOICE", "alloy")

    # Supabase Storage buckets the backend writes to. Bucket names must
    # be globally unique within the project — keep these prefixed if
    # other apps share the same Supabase project.
    STORAGE_BUCKET_AUDIO = os.getenv("STORAGE_BUCKET_AUDIO", "exercise-audio")
    STORAGE_BUCKET_LESSON_MEDIA = os.getenv(
        "STORAGE_BUCKET_LESSON_MEDIA", "lesson-media"
    )

    # Tier list rendered to the admin dashboard. Keep in sync with the
    # `subscriptions.tier` CHECK constraint and the iOS paywall.
    TIER_PRICES_EUR_CENTS: dict[str, int] = {
        "free":  0,
        "pro":   900,
        "power": 1900,
    }

    # Per-tier capacity caps. None = unlimited.
    #   - CURRICULUM_CAPS: max concurrently-active curricula a user can
    #     own. Free users finish or archive the existing one before
    #     starting another track. Power is uncapped.
    # Enforcement lives in `orchestrator/_assessment.py::start_curriculum`
    # — raises 402 `tier_curriculum_cap` when exceeded.
    CURRICULUM_CAPS: dict[str, int | None] = {
        "free":  1,
        "pro":   3,
        "power": None,
    }

    # Minimum tier required to receive Adapter (re-planner) re-runs after
    # exercise submissions. Free users still get scoring + tracker
    # updates; the Adapter is the "your plan adapts to you" Pro hook.
    # Soft-skipped at the orchestrator level — never fails a submit.
    ADAPTER_TIER_MIN: str = "pro"

    @classmethod
    def is_configured(cls) -> dict:
        """Quick check for /health to show which integrations are wired."""
        return {
            "supabase": bool(cls.SUPABASE_URL and cls.SUPABASE_ANON_KEY),
            "openai": bool(cls.OPENAI_API_KEY),
            "revenuecat": bool(cls.REVENUECAT_WEBHOOK_SECRET),
        }
