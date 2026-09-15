CREATE TABLE IF NOT EXISTS credit_card_perk_completions (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  perk_award_id BIGINT NOT NULL REFERENCES credit_card_perk_awards(id) ON DELETE CASCADE,
  cycle_start DATE NOT NULL,
  occurrence_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, perk_award_id, cycle_start, occurrence_index)
);

CREATE INDEX IF NOT EXISTS credit_card_perk_completions_lookup_idx
  ON credit_card_perk_completions(account_id, cycle_start);
