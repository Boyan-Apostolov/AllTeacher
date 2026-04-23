"""Supabase client wrappers.

Two clients:
  * `anon_client()`    uses the anon key, respects Row-Level Security.
  * `service_client()` uses the service role key, BYPASSES RLS.
                       Only use server-side for trusted operations.
"""
from functools import lru_cache
from supabase import create_client, Client

from config import Config


@lru_cache(maxsize=1)
def anon_client() -> Client | None:
    if not (Config.SUPABASE_URL and Config.SUPABASE_ANON_KEY):
        return None
    return create_client(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY)


@lru_cache(maxsize=1)
def service_client() -> Client | None:
    if not (Config.SUPABASE_URL and Config.SUPABASE_SERVICE_ROLE_KEY):
        return None
    return create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_ROLE_KEY)
