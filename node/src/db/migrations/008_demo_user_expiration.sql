ALTER TABLE users
  ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMPTZ;

UPDATE users
SET demo_expires_at = NULL
WHERE is_demo = FALSE;

CREATE INDEX IF NOT EXISTS users_demo_expires_at_idx
  ON users(demo_expires_at)
  WHERE is_demo = TRUE;
