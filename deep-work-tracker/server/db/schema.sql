-- Deep-Work Tracker schema
-- Run with: psql -U postgres -d deep_work_tracker -f db/schema.sql

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
  id      SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  color   VARCHAR(7) NOT NULL DEFAULT '#6366f1'
          CHECK (color ~* '^#[0-9a-f]{6}$'),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS sessions (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id           INTEGER REFERENCES tags(id) ON DELETE SET NULL,
  started_at       TIMESTAMP NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  note             TEXT
);

-- Analytics queries will filter by user and time range
CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON sessions (user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags (user_id);

COMMIT;

-- ============================================================
-- Seed: demo user + ~90 days of fake sessions
--   login: demo@demo.com / demo1234
-- Idempotent: re-running refreshes the demo user's sessions
-- (existing demo sessions are deleted and regenerated).
-- ============================================================
DO $$
DECLARE
  demo_id   INTEGER;
  tag_ids   INTEGER[];
  d         DATE;
  i         INTEGER;
  n         INTEGER;
  -- morning-weighted: 6–11am appears far more often than afternoon/evening
  hour_pool INTEGER[] := ARRAY[6,7,7,8,8,8,9,9,9,10,10,10,11,11,14,15,16,17,19,21];
  notes     TEXT[]    := ARRAY['Deep focus', 'Flow state', 'Kept getting distracted',
                               'Solid session', 'Slow start, strong finish', NULL, NULL, NULL];
BEGIN
  -- demo user (hash = bcrypt('demo1234', 10 rounds))
  INSERT INTO users (name, email, password_hash)
  VALUES ('Demo User', 'demo@demo.com', '$2b$10$6H84Kpn9UbBsRlkfORsLvO8xnpO0F7miZ8sAdmC/P9J2uHDYAadTW')
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO demo_id FROM users WHERE email = 'demo@demo.com';

  INSERT INTO tags (user_id, name, color) VALUES
    (demo_id, 'DSA',     '#ef4444'),
    (demo_id, 'Web Dev', '#3b82f6'),
    (demo_id, 'College', '#f59e0b'),
    (demo_id, 'Reading', '#10b981')
  ON CONFLICT (user_id, name) DO NOTHING;

  SELECT array_agg(id) INTO tag_ids FROM tags WHERE user_id = demo_id;

  -- start fresh so re-running the file never duplicates sessions
  DELETE FROM sessions WHERE user_id = demo_id;

  FOR d IN SELECT generate_series(CURRENT_DATE - 89, CURRENT_DATE, '1 day')::date LOOP
    -- guaranteed zero-session days (every 9th calendar day) so streak logic is testable
    CONTINUE WHEN EXTRACT(DAY FROM d)::int % 9 = 0;
    -- plus random rest days; weekends skipped more often than weekdays
    CONTINUE WHEN random() < CASE WHEN EXTRACT(ISODOW FROM d) >= 6 THEN 0.35 ELSE 0.15 END;

    n := 1 + floor(random() * 3)::int;  -- 1–3 sessions that day
    FOR i IN 1..n LOOP
      INSERT INTO sessions (user_id, tag_id, started_at, duration_minutes, note)
      VALUES (
        demo_id,
        tag_ids[1 + floor(random() * array_length(tag_ids, 1))::int],
        d + make_interval(
              hours => hour_pool[1 + floor(random() * array_length(hour_pool, 1))::int],
              mins  => floor(random() * 60)::int),
        25 + floor(random() * 96)::int,  -- 25–120 minutes
        notes[1 + floor(random() * array_length(notes, 1))::int]
      );
    END LOOP;
  END LOOP;
END $$;
