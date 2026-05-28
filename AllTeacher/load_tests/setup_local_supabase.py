#!/usr/bin/env python3
"""One-shot setup: apply all migrations + seed load-test users into local Supabase.

Run from the repo root:
    python3 load_tests/setup_local_supabase.py

Requires psycopg2:
    pip install psycopg2-binary   # or: pip3 install psycopg2-binary
"""
import os
import sys
import glob

DB_URL = os.getenv(
    "DB_URL",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

try:
    import psycopg2
except ImportError:
    sys.exit(
        "psycopg2 not found. Install it with:\n"
        "  pip install psycopg2-binary\n"
        "then re-run this script."
    )

repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
migration_dir = os.path.join(repo_root, "backend", "db", "migrations")
seed_file = os.path.join(repo_root, "load_tests", "seed_load_test_users.sql")

migration_files = sorted(glob.glob(os.path.join(migration_dir, "*.sql")))

print(f"Connecting to {DB_URL} ...")
try:
    conn = psycopg2.connect(DB_URL)
except Exception as e:
    sys.exit(f"Could not connect: {e}\nIs `supabase start` running?")

conn.autocommit = True
cur = conn.cursor()

print(f"\nApplying {len(migration_files)} migration(s)...")
for path in migration_files:
    name = os.path.basename(path)
    try:
        cur.execute(open(path).read())
        print(f"  ✓  {name}")
    except Exception as e:
        print(f"  ✗  {name}: {e}")

print("\nSeeding load-test users...")
try:
    cur.execute(open(seed_file).read())
    print("  ✓  seed_load_test_users.sql")
except Exception as e:
    print(f"  ✗  seed_load_test_users.sql: {e}")

cur.close()
conn.close()

print("""
Done!  Start Flask with:

  cd backend
  STUB_AGENTS=true \\
  STUB_DB=false \\
  LOAD_TEST_SECRET=loadtest \\
  SUPABASE_URL=http://127.0.0.1:54321 \\
  SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH \\
  SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz \\
  SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long \\
  flask --app main run --port 5001

Then run Locust from the repo root:

  locust -f load_tests/locustfile.py --headless \\
      -u 10 -r 2 --run-time 60s \\
      --host http://localhost:5001
""")
