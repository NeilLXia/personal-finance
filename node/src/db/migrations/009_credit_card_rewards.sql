CREATE TABLE IF NOT EXISTS credit_card_types (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  annual_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_card_earning_rewards (
  id BIGSERIAL PRIMARY KEY,
  credit_card_type_id BIGINT NOT NULL REFERENCES credit_card_types(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  reward_percent NUMERIC(7, 4) NOT NULL,
  effective_month_start DATE NOT NULL,
  effective_month_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_card_earning_rewards_type_id_idx
  ON credit_card_earning_rewards(credit_card_type_id);

CREATE TABLE IF NOT EXISTS credit_card_perk_awards (
  id BIGSERIAL PRIMARY KEY,
  credit_card_type_id BIGINT NOT NULL REFERENCES credit_card_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dollar_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  completion_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  effective_month_start DATE NOT NULL,
  effective_month_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_card_perk_awards_type_id_idx
  ON credit_card_perk_awards(credit_card_type_id);

CREATE TABLE IF NOT EXISTS credit_card_account_types (
  account_id BIGINT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  credit_card_type_id BIGINT NOT NULL REFERENCES credit_card_types(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_card_account_types_type_id_idx
  ON credit_card_account_types(credit_card_type_id);
