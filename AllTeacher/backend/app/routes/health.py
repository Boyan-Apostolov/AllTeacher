"""GET /health - used by the iOS app to prove end-to-end connectivity."""
from flask import Blueprint, jsonify
from config import Config

bp = Blueprint("health", __name__)


@bp.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "allteacher-backend",
        "env": Config.FLASK_ENV,
        "configured": {
            **Config.is_configured(),
            "unsplash": bool(Config.UNSPLASH_ACCESS_KEY),
            "youtube": bool(Config.YOUTUBE_API_KEY),
        },
    })
