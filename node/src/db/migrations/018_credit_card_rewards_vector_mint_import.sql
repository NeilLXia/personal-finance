ALTER TABLE credit_card_types
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_card_id TEXT,
  ADD COLUMN IF NOT EXISTS source_description TEXT,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS source_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS last_external_sync_at TIMESTAMPTZ;

ALTER TABLE credit_card_types
  DROP CONSTRAINT IF EXISTS credit_card_types_status_check,
  ADD CONSTRAINT credit_card_types_status_check
    CHECK (status IN ('active', 'in_review'));

CREATE UNIQUE INDEX IF NOT EXISTS credit_card_types_external_card_idx
  ON credit_card_types(external_source, external_card_id)
  WHERE external_source IS NOT NULL AND external_card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS credit_card_types_status_idx
  ON credit_card_types(status);

ALTER TABLE credit_card_earning_rewards
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'included',
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_reward_id TEXT,
  ADD COLUMN IF NOT EXISTS source_description TEXT,
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS match_strategy TEXT,
  ADD COLUMN IF NOT EXISTS source_fingerprint TEXT;

ALTER TABLE credit_card_earning_rewards
  DROP CONSTRAINT IF EXISTS credit_card_earning_rewards_status_check,
  ADD CONSTRAINT credit_card_earning_rewards_status_check
    CHECK (status IN ('included', 'needs_review', 'excluded'));

CREATE UNIQUE INDEX IF NOT EXISTS credit_card_earning_rewards_external_reward_idx
  ON credit_card_earning_rewards(credit_card_type_id, source, external_reward_id)
  WHERE external_reward_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS credit_card_earning_rewards_status_idx
  ON credit_card_earning_rewards(status);

ALTER TABLE credit_card_perk_awards
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'included',
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_perk_id TEXT,
  ADD COLUMN IF NOT EXISTS source_description TEXT,
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS match_strategy TEXT,
  ADD COLUMN IF NOT EXISTS source_fingerprint TEXT;

ALTER TABLE credit_card_perk_awards
  DROP CONSTRAINT IF EXISTS credit_card_perk_awards_status_check,
  ADD CONSTRAINT credit_card_perk_awards_status_check
    CHECK (status IN ('included', 'needs_review', 'excluded'));

CREATE UNIQUE INDEX IF NOT EXISTS credit_card_perk_awards_external_perk_idx
  ON credit_card_perk_awards(credit_card_type_id, source, external_perk_id)
  WHERE external_perk_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS credit_card_perk_awards_status_idx
  ON credit_card_perk_awards(status);
