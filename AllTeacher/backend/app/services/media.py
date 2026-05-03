"""Audio + image + video media services.

Owns:
  - tts_to_url         → OpenAI TTS → Supabase Storage → public URL
  - unsplash_photo_url → Unsplash API → photo URL for a query
  - youtube_search_url → YouTube Data API v3 → embed URL for a query

All public functions fail *soft* (return None on any error) so the
orchestrator can skip media decoration rather than crash a user session.
Keys for audio are deterministic content hashes (sha256) so re-running
with the same text reuses the cached file.
"""
from __future__ import annotations

import hashlib
import logging
import urllib.parse
import urllib.request
import json as _json
from typing import Any

from openai import OpenAI

from config import Config
from app.db.supabase import service_client
from app.services import usage_meter


log = logging.getLogger(__name__)


# --- Unsplash ---------------------------------------------------------

def unsplash_photo_url(query: str) -> str | None:
    """Return a landscape Unsplash photo URL for `query`, or None.

    Uses the /photos/random endpoint (free tier, 50 req/hr per
    access-key). Returns the `regular` size (~1080px wide) which is
    appropriate for in-app display without being wasteful.

    Fails soft: returns None when UNSPLASH_ACCESS_KEY is unset, quota
    is hit, or the network call errors — the caller simply omits the
    image rather than crashing.
    """
    key = Config.UNSPLASH_ACCESS_KEY
    if not key:
        return None
    query = (query or "").strip()
    if not query:
        return None
    try:
        params = urllib.parse.urlencode({
            "query": query,
            "orientation": "landscape",
            "content_filter": "high",
            "client_id": key,
        })
        url = f"https://api.unsplash.com/photos/random?{params}"
        req = urllib.request.Request(url, headers={"Accept-Version": "v1"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = _json.loads(resp.read().decode())
        photo_url = (data.get("urls") or {}).get("regular")
        return photo_url or None
    except Exception as exc:
        log.warning("unsplash_photo_url failed for %r: %s", query, exc)
        return None


# --- YouTube ----------------------------------------------------------

def youtube_search_url(query: str) -> str | None:
    """Return a YouTube embed URL (`https://www.youtube.com/embed/{id}`)
    for the first short, embeddable video matching `query`, or None.

    Uses YouTube Data API v3. Prefers short videos (< 4 minutes) and
    restricts to embeddable results. Falls back to medium duration when
    no short video is found.

    Fails soft: returns None when YOUTUBE_API_KEY is unset, quota is
    hit, or no suitable video is found.
    """
    key = Config.YOUTUBE_API_KEY
    if not key:
        return None
    query = (query or "").strip()
    if not query:
        return None

    def _search(duration: str) -> str | None:
        params = urllib.parse.urlencode({
            "part": "id",
            "q": query,
            "type": "video",
            "videoEmbeddable": "true",
            "safeSearch": "strict",
            "videoDuration": duration,
            "maxResults": 5,
            "key": key,
        })
        url = f"https://www.googleapis.com/youtube/v3/search?{params}"
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = _json.loads(resp.read().decode())
            items = data.get("items") or []
            for item in items:
                vid_id = (item.get("id") or {}).get("videoId")
                if vid_id:
                    return (
                        f"https://www.youtube.com/embed/{vid_id}"
                        "?autoplay=0&rel=0&modestbranding=1"
                    )
        except Exception as exc:
            log.warning("youtube_search_url(%r, %s) failed: %s", query, duration, exc)
        return None

    return _search("short") or _search("medium")


# --- public API ---------------------------------------------------------

def tts_to_url(
    text: str,
    *,
    language: str | None = None,  # currently informational; OpenAI TTS
                                  # auto-detects from the input text
    voice: str | None = None,
    model: str | None = None,
) -> str | None:
    """Render `text` to mp3 via OpenAI TTS, upload to Supabase Storage,
    return the public URL. Returns None on any failure.

    Cache: keyed by sha256(text + voice + model). A second call with
    the same inputs short-circuits to the cached URL without re-spending
    TTS or upload budget.
    """
    text = (text or "").strip()
    if not text:
        return None

    voice_id = voice or Config.OPENAI_TTS_VOICE
    model_id = model or Config.OPENAI_TTS_MODEL

    key = _audio_cache_key(text, voice_id, model_id)
    bucket = Config.STORAGE_BUCKET_AUDIO
    object_path = f"{key}.mp3"

    db = service_client()
    if db is None:
        log.warning("tts_to_url: supabase service client not configured")
        return None

    # Cache hit: object already exists. We don't need to HEAD the file —
    # `get_public_url` returns a URL whether or not the object exists,
    # and the cheapest correctness check is a `list` against the prefix.
    cached = _cached_public_url(db, bucket, object_path)
    if cached:
        return cached

    # Cache miss — synthesise + upload.
    try:
        audio_bytes = _synthesise(text, voice=voice_id, model=model_id)
    except Exception as exc:  # noqa: BLE001 — fail soft
        log.warning("tts_to_url: synthesis failed: %s", exc)
        return None
    if not audio_bytes:
        return None

    try:
        _ensure_bucket(db, bucket)
        db.storage.from_(bucket).upload(
            path=object_path,
            file=audio_bytes,
            file_options={
                "content-type": "audio/mpeg",
                # Override the supabase-py default `upsert=false` so a
                # rare race between two concurrent generators doesn't
                # 409. Treat the bucket like a content-addressed store.
                "upsert": "true",
            },
        )
    except Exception as exc:  # noqa: BLE001 — fail soft
        log.warning("tts_to_url: upload failed: %s", exc)
        return None

    public_url = _public_url(db, bucket, object_path)
    if not public_url:
        return None

    # Best-effort cost ledger. TTS pricing is per-character; we map
    # char_count → prompt_tokens so the existing meter can record it
    # under the same `(prompt_tokens, completion_tokens, cost_cents)`
    # schema. The cost computation lives in usage_meter._cost_cents,
    # which keys off Config.OPENAI_PRICING_USD_PER_1K — but for TTS
    # we want OPENAI_TTS_USD_PER_1K_CHARS instead, so we compute the
    # cost here and shove the totals into a synthetic usage object.
    try:
        char_count = len(text)
        usage_meter.record(
            model=model_id,
            agent="tts",
            usage=_TtsUsage(
                prompt_tokens=char_count,
                completion_tokens=0,
                cost_cents_override=_tts_cost_cents(model_id, char_count),
            ),
        )
    except Exception:  # noqa: BLE001 — never raise out of telemetry
        pass

    return public_url


# --- internals ----------------------------------------------------------


def _synthesise(text: str, *, voice: str, model: str) -> bytes | None:
    """Round-trip to OpenAI TTS. Returns the raw mp3 bytes."""
    api_key = Config.OPENAI_API_KEY
    if not api_key:
        log.warning("OPENAI_API_KEY not configured")
        return None
    client = OpenAI(api_key=api_key)

    # The non-streaming form is fine for our payload sizes (a single
    # phrase, usually < 200 chars). Streaming would only help if we
    # were rendering long passages — Explainer-narration territory.
    response = client.audio.speech.create(
        model=model,
        voice=voice,
        input=text,
        # mp3 is the SDK default but pin it explicitly so a future
        # default change doesn't mismatch the .mp3 path we upload to.
        response_format="mp3",
    )
    # The SDK exposes `.content` (bytes) on newer versions and
    # `.read()` on older ones; try both shapes.
    content = getattr(response, "content", None)
    if content is None and hasattr(response, "read"):
        content = response.read()
    if content is None and hasattr(response, "iter_bytes"):
        content = b"".join(response.iter_bytes())
    return content


def _audio_cache_key(text: str, voice: str, model: str) -> str:
    h = hashlib.sha256()
    h.update(model.encode("utf-8"))
    h.update(b"|")
    h.update(voice.encode("utf-8"))
    h.update(b"|")
    h.update(text.encode("utf-8"))
    return h.hexdigest()


def _ensure_bucket(db: Any, bucket: str) -> None:
    """Create the bucket if it doesn't exist. Idempotent — `create_bucket`
    raises a 409-ish error when the bucket already exists; we swallow
    that and treat any other error as fatal-ish (the upload below will
    fail loudly anyway)."""
    try:
        db.storage.create_bucket(bucket, options={"public": True})
    except Exception as exc:  # noqa: BLE001
        # supabase-py wraps the underlying StorageException; the cheap
        # check is "did the message say already exists?" The bucket may
        # also have been created out-of-band via the dashboard — same
        # outcome.
        msg = str(exc).lower()
        if "already exists" in msg or "duplicate" in msg or "409" in msg:
            return
        # Re-raise so the upload-side except can record the failure
        # consistently — we don't want a "permission denied on
        # create_bucket" to silently masquerade as a successful upload.
        raise


def _cached_public_url(db: Any, bucket: str, object_path: str) -> str | None:
    """Return the public URL if the object already exists in the bucket,
    None otherwise. Uses `list` rather than HEAD so we don't depend on
    a particular supabase-py method shape."""
    try:
        listing = db.storage.from_(bucket).list(
            path="",
            options={
                "limit": 1,
                "search": object_path,
            },
        ) or []
    except Exception:
        return None
    for item in listing:
        # Each item is a dict-like with `name`. We searched by exact
        # filename so a single match is enough.
        name = item.get("name") if isinstance(item, dict) else None
        if name == object_path:
            return _public_url(db, bucket, object_path)
    return None


def _public_url(db: Any, bucket: str, object_path: str) -> str | None:
    try:
        url = db.storage.from_(bucket).get_public_url(object_path)
    except Exception:
        return None
    # supabase-py returns the URL as a string on newer versions and a
    # `{"publicURL": "..."}` dict on a few older ones.
    if isinstance(url, str):
        return url
    if isinstance(url, dict):
        return url.get("publicURL") or url.get("public_url")
    return None


def _tts_cost_cents(model: str, char_count: int) -> float:
    """Per-character TTS cost in USD-cents. Mirrors usage_meter's
    cents-of-USD convention — see its `_cost_cents` docstring."""
    rate = Config.OPENAI_TTS_USD_PER_1K_CHARS.get(model)
    if rate is None:
        # Fall back to tts-1 pricing rather than 0.0; missing pricing
        # should still register a cost so the admin notices.
        rate = Config.OPENAI_TTS_USD_PER_1K_CHARS.get("tts-1", 0.015)
    usd = (char_count / 1000.0) * rate
    return usd * 100.0


class _TtsUsage:
    """Synthetic usage object for `usage_meter.record` so TTS calls land
    in the same `token_usage_log` table as text-completion calls. The
    meter calls `_cost_cents(model, prompt_tokens, completion_tokens)`
    via `Config.OPENAI_PRICING_USD_PER_1K`, but TTS pricing keys off
    char count instead of tokens — so we attach an override the meter
    will prefer when present (see usage_meter._cost_cents).

    `usage_meter.record` honours `cost_cents_override` when present, so
    the synthesised cost computed in `_tts_cost_cents` lands in the
    `token_usage_log.cost_cents` column unmodified.
    """

    def __init__(
        self,
        *,
        prompt_tokens: int,
        completion_tokens: int,
        cost_cents_override: float | None = None,
    ):
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.cost_cents_override = cost_cents_override
