ALTER TABLE credit_card_account_types
  ADD COLUMN IF NOT EXISTS effective_month DATE NOT NULL DEFAULT DATE '2000-01-01';
