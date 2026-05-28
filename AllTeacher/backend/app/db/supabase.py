"""Supabase client wrappers.

Two clients:
  * `anon_client()`    uses the anon key, respects Row-Level Security.
  * `service_client()` uses the service role key, BYPASSES RLS.
                       Only use server-side for trusted operations.

Per-request caching via flask.g: each HTTP request gets a fresh Client with
an empty connection pool. This prevents httpx.ReadError (errno 35 / EAGAIN)
caused by stale HTTP/2 connections being reused across requests from a
long-lived lru_cache singleton.

Stub mode
---------
Set STUB_DB=true to get an in-memory stub client instead of the real
Supabase client. Combine with STUB_AGENTS=true and LOAD_TEST_SECRET for
fully-offline load tests — no Supabase instance required.
"""
import os

from supabase import create_client, Client

from config import Config

_STUB_DB: bool = os.getenv("STUB_DB", "").lower() in ("1", "true", "yes")


def _stub_client():
    from app.db.stub_supabase import StubSupabaseClient  # noqa: PLC0415
    return StubSupabaseClient()


def _make_service() -> Client | None:
    if _STUB_DB:
        return _stub_client()
    if not (Config.SUPABASE_URL and Config.SUPABASE_SERVICE_ROLE_KEY):
        return None
    return create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_ROLE_KEY)


def _make_anon() -> Client | None:
    if _STUB_DB:
        return _stub_client()
    if not (Config.SUPABASE_URL and Config.SUPABASE_ANON_KEY):
        return None
    return create_client(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY)


def anon_client() -> Client | None:
    try:
        from flask import g, has_request_context
        if has_request_context():
            if not hasattr(g, "_supabase_anon"):
                g._supabase_anon = _make_anon()
            return g._supabase_anon
    except RuntimeError:
        pass
    return _make_anon()


def service_client() -> Client | None:
    try:
        from flask import g, has_request_context
        if has_request_context():
            if not hasattr(g, "_supabase_service"):
                g._supabase_service = _make_service()
            return g._supabase_service
    except RuntimeError:
        pass
    return _make_service()
