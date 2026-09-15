ALTER TABLE credit_card_earning_rewards
  DROP COLUMN IF EXISTS effective_month_start,
  DROP COLUMN IF EXISTS effective_month_end;

ALTER TABLE credit_card_perk_awards
  DROP COLUMN IF EXISTS effective_month_start,
  DROP COLUMN IF EXISTS effective_month_end;
