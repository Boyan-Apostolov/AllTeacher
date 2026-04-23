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
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

    REVENUECAT_WEBHOOK_SECRET = os.getenv("REVENUECAT_WEBHOOK_SECRET", "")

    @classmethod
    def is_configured(cls) -> dict:
        """Quick check for /health to show which integrations are wired."""
        return {
            "supabase": bool(cls.SUPABASE_URL and cls.SUPABASE_ANON_KEY),
            "openai": bool(cls.OPENAI_API_KEY),
            "revenuecat": bool(cls.REVENUECAT_WEBHOOK_SECRET),
        }
