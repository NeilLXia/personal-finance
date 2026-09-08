CREATE TABLE IF NOT EXISTS transaction_category_rules (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_category TEXT NOT NULL,
  original_category_key TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  vendor_name_key TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'contains',
  manual_category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, original_category_key, vendor_name_key, match_type)
);

ALTER TABLE transaction_category_rules
  ADD COLUMN IF NOT EXISTS original_category_key TEXT NOT NULL DEFAULT '';
ALTER TABLE transaction_category_rules
  ADD COLUMN IF NOT EXISTS vendor_name_key TEXT NOT NULL DEFAULT '';
ALTER TABLE transaction_category_rules
  ADD COLUMN IF NOT EXISTS match_type TEXT NOT NULL DEFAULT 'contains';

UPDATE transaction_category_rules
SET
  original_category_key = LOWER(TRIM(original_category)),
  vendor_name_key = LOWER(TRIM(vendor_name))
WHERE original_category_key = '' OR vendor_name_key = '';

ALTER TABLE transaction_category_rules
  DROP CONSTRAINT IF EXISTS transaction_category_rules_user_id_original_category_vendor_key;
DROP INDEX IF EXISTS transaction_category_rules_user_id_original_category_vendor_key;
ALTER TABLE transaction_category_rules
  DROP CONSTRAINT IF EXISTS transaction_category_rules_user_id_original_category_key_vendor_name_key_key;
DROP INDEX IF EXISTS transaction_category_rules_user_category_vendor_key;

CREATE UNIQUE INDEX IF NOT EXISTS transaction_category_rules_user_category_vendor_key
  ON transaction_category_rules(user_id, original_category_key, vendor_name_key, match_type);
CREATE INDEX IF NOT EXISTS transaction_category_rules_user_id_idx
  ON transaction_category_rules(user_id);

CREATE TABLE IF NOT EXISTS budget_targets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  category_key TEXT NOT NULL,
  target_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
  net_target_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
  gross_target_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_key)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'budget_targets'
      AND column_name = 'monthly_amount'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'budget_targets'
      AND column_name = 'target_percent'
  ) THEN
    ALTER TABLE budget_targets
      RENAME COLUMN monthly_amount TO target_percent;
  END IF;
END $$;

ALTER TABLE budget_targets
  ADD COLUMN IF NOT EXISTS target_percent NUMERIC(6, 2) NOT NULL DEFAULT 0;
ALTER TABLE budget_targets
  ADD COLUMN IF NOT EXISTS net_target_percent NUMERIC(6, 2) NOT NULL DEFAULT 0;
ALTER TABLE budget_targets
  ADD COLUMN IF NOT EXISTS gross_target_percent NUMERIC(6, 2) NOT NULL DEFAULT 0;

UPDATE budget_targets
SET net_target_percent = target_percent
WHERE net_target_percent = 0
  AND target_percent <> 0;

CREATE INDEX IF NOT EXISTS budget_targets_user_id_idx
  ON budget_targets(user_id);
