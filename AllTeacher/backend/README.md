# AllTeacher Backend

Flask API + OpenAI agent orchestrator. Runs behind Traefik on a home VPS in production, `python app.py` locally for dev.

## Quick start

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # then fill in keys
python app.py
```

Hit it:

```bash
curl http://localhost:8000/health
```

## Layout

```
backend/
  app.py                  # Flask entrypoint / create_app()
  config.py               # Env-backed config
  requirements.txt
  Dockerfile              # gunicorn prod image
  docker-compose.yml      # Traefik-labeled service
  app/
    agents/               # orchestrator + subagents
    db/supabase.py        # anon + service-role Supabase clients
    middleware/
      auth.py             # Supabase JWT -> g.user_id
      tier_check.py       # Free/Pro/Power gates
    routes/
      health.py           # GET /health
      auth.py             # GET /auth/me
      curriculum.py       # CRUD curricula (stubs)
      session.py          # POST /session/<id>/message (SSE stub)
      webhooks.py         # RevenueCat webhook
```

See `../SETUP.md` for Supabase + OpenAI key setup.
