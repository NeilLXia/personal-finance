ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'user';

ALTER TABLE users
  ALTER COLUMN account_type SET DEFAULT 'user';

UPDATE users
SET account_type = 'user'
WHERE account_type IS NULL;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_account_type_check;

ALTER TABLE users
  ADD CONSTRAINT users_account_type_check
  CHECK (account_type IN ('admin', 'user'));

UPDATE users
SET account_type = 'admin'
WHERE id = 1;

UPDATE users
SET account_type = 'user'
WHERE id <> 1
  AND account_type <> 'user';

ALTER TABLE users
  ALTER COLUMN account_type SET NOT NULL;
