-- Migration 015: request_logs
--
-- Stores one row per HTTP request hitting the Flask backend.
-- Used by the admin dashboard to show latency, error rates, and
-- per-user traffic patterns. PostHog captures the same data for
-- product analytics; this table is the source of truth for our
-- own dashboards and future alerts.
--
-- Columns
-- -------
-- request_id   UUID generated in middleware (ties this row to PostHog
--              events and Python log lines from the same request)
-- user_id      NULL for unauthenticated requests (health check, etc.)
-- method       HTTP verb (GET, POST, …)
-- path         URL path, no query string
-- endpoint     Flask endpoint name (e.g. "curriculum.plan")
-- status_code  HTTP status returned to the client (or 500 for unhandled exceptions)
-- duration_ms  Wall-clock milliseconds from before_request to after_request
-- error        Exception message for unhandled errors; NULL on success

CREATE TABLE IF NOT EXISTS request_logs (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id  uuid        NOT NULL,
    user_id     uuid        REFERENCES users(id) ON DELETE SET NULL,
    method      text        NOT NULL,
    path        text        NOT NULL,
    endpoint    text,
    status_code integer,
    duration_ms integer,
    error       text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Most dashboard queries filter by time descending
CREATE INDEX IF NOT EXISTS request_logs_created_at_idx
    ON request_logs (created_at DESC);

-- Per-user traffic / error queries
CREATE INDEX IF NOT EXISTS request_logs_user_id_idx
    ON request_logs (user_id);

-- Join with PostHog events or Python logs via request_id
CREATE INDEX IF NOT EXISTS request_logs_request_id_idx
    ON request_logs (request_id);

-- RLS: admins can read all rows; regular users can read only their own.
ALTER TABLE request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read all request_logs"
    ON request_logs FOR SELECT
    USING (
        auth.jwt() ->> 'email' = current_setting('app.admin_email', true)
    );

CREATE POLICY "users read own request_logs"
    ON request_logs FOR SELECT
    USING (user_id = auth.uid());

-- Service role (backend) can insert freely.
CREATE POLICY "service role insert request_logs"
    ON request_logs FOR INSERT
    WITH CHECK (true);
