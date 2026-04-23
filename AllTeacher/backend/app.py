"""Flask app factory + entrypoint.

Run locally:
    python app.py

Run with gunicorn (prod):
    gunicorn -w 4 -b 0.0.0.0:8000 'app:create_app()'
"""
from flask import Flask
from flask_cors import CORS

from config import Config
from app.routes.health import bp as health_bp
from app.routes.auth import bp as auth_bp
from app.routes.curriculum import bp as curriculum_bp
from app.routes.session import bp as session_bp
from app.routes.webhooks import bp as webhooks_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    # Expo dev on LAN hits the backend cross-origin
    CORS(app, resources={r"/*": {"origins": "*"}})

    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(curriculum_bp)
    app.register_blueprint(session_bp)
    app.register_blueprint(webhooks_bp)

    @app.get("/")
    def index():
        return {"service": "allteacher-backend", "docs": "/health"}

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.FLASK_ENV == "development")
