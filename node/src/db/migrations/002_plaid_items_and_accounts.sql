CREATE TABLE IF NOT EXISTS plaid_items (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plaid_item_id TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  plaid_environment TEXT NOT NULL DEFAULT 'sandbox',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  transactions_cursor TEXT,
  institution_id TEXT,
  institution_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS plaid_environment TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE plaid_items
SET plaid_environment = CASE
  WHEN access_token LIKE 'access-production-%' THEN 'production'
  WHEN access_token LIKE 'access-sandbox-%' THEN 'sandbox'
  ELSE plaid_environment
END;

UPDATE plaid_items
SET is_active = TRUE;

CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plaid_item_id TEXT NOT NULL,
  plaid_account_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  mask TEXT,
  official_name TEXT,
  subtype TEXT,
  type TEXT,
  balance_available NUMERIC(12, 2),
  balance_current NUMERIC(12, 2),
  balance_limit NUMERIC(12, 2),
  iso_currency_code TEXT,
  unofficial_currency_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS balance_available NUMERIC(12, 2);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS balance_current NUMERIC(12, 2);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS balance_limit NUMERIC(12, 2);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS iso_currency_code TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS unofficial_currency_code TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounts_plaid_item_id_fkey'
  ) THEN
    ALTER TABLE accounts
    ADD CONSTRAINT accounts_plaid_item_id_fkey
    FOREIGN KEY (plaid_item_id)
    REFERENCES plaid_items(plaid_item_id)
    ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON accounts(user_id);

CREATE TABLE IF NOT EXISTS account_balance_history (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  balance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  balance_available NUMERIC(12, 2),
  balance_current NUMERIC(12, 2),
  balance_limit NUMERIC(12, 2),
  iso_currency_code TEXT,
  unofficial_currency_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, balance_date)
);

CREATE INDEX IF NOT EXISTS account_balance_history_account_id_idx
  ON account_balance_history(account_id);
CREATE INDEX IF NOT EXISTS account_balance_history_balance_date_idx
  ON account_balance_history(balance_date);

INSERT INTO account_balance_history (
  account_id,
  balance_date,
  balance_available,
  balance_current,
  balance_limit,
  iso_currency_code,
  unofficial_currency_code
)
SELECT
  id,
  CURRENT_DATE,
  balance_available,
  balance_current,
  balance_limit,
  iso_currency_code,
  unofficial_currency_code
FROM accounts
WHERE balance_current IS NOT NULL
ON CONFLICT (account_id, balance_date) DO NOTHING;
