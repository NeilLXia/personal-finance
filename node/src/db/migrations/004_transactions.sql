CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plaid_transaction_id TEXT UNIQUE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  category TEXT,
  date DATE NOT NULL,
  manual_date DATE,
  merchant_name TEXT,
  name TEXT NOT NULL,
  manual_category TEXT,
  pending BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS manual_category TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS manual_date DATE;

CREATE INDEX IF NOT EXISTS transactions_account_id_idx ON transactions(account_id);
CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(date);
CREATE INDEX IF NOT EXISTS transactions_effective_date_idx
  ON transactions((COALESCE(manual_date, date)));
