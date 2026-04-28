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

    # Tier list rendered to the admin dashboard. Keep in sync with the
    # `subscriptions.tier` CHECK constraint and the iOS paywall.
    TIER_PRICES_EUR_CENTS: dict[str, int] = {
        "free":  0,
        "pro":   900,
        "power": 1900,
    }

    @classmethod
    def is_configured(cls) -> dict:
        """Quick check for /health to show which integrations are wired."""
        return {
            "supabase": bool(cls.SUPABASE_URL and cls.SUPABASE_ANON_KEY),
            "openai": bool(cls.OPENAI_API_KEY),
            "revenuecat": bool(cls.REVENUECAT_WEBHOOK_SECRET),
        }
