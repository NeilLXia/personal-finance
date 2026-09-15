ALTER TABLE credit_card_perk_awards
  ADD COLUMN IF NOT EXISTS frequency_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS frequency_period TEXT NOT NULL DEFAULT 'per_year';

ALTER TABLE credit_card_perk_awards
  DROP CONSTRAINT IF EXISTS credit_card_perk_awards_frequency_count_check,
  ADD CONSTRAINT credit_card_perk_awards_frequency_count_check
    CHECK (frequency_count BETWEEN 1 AND 24);

ALTER TABLE credit_card_perk_awards
  DROP CONSTRAINT IF EXISTS credit_card_perk_awards_frequency_period_check,
  ADD CONSTRAINT credit_card_perk_awards_frequency_period_check
    CHECK (frequency_period IN ('per_year', 'per_quarter', 'per_month'));
