CREATE TABLE IF NOT EXISTS properties (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  loan_original_amount NUMERIC(12, 2),
  loan_annual_interest_rate NUMERIC(7, 4),
  loan_monthly_payment NUMERIC(12, 2),
  loan_balance_start_month DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, address)
);

ALTER TABLE properties DROP COLUMN IF EXISTS label;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS loan_original_amount NUMERIC(12, 2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS loan_annual_interest_rate NUMERIC(7, 4);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS loan_monthly_payment NUMERIC(12, 2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS loan_balance_start_month DATE;

CREATE TABLE IF NOT EXISTS property_value_history (
  id BIGSERIAL PRIMARY KEY,
  property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  valuation_month DATE NOT NULL,
  estimated_value NUMERIC(12, 2) NOT NULL,
  loan_balance NUMERIC(12, 2),
  price_range_low NUMERIC(12, 2),
  price_range_high NUMERIC(12, 2),
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (property_id, valuation_month)
);

ALTER TABLE property_value_history ADD COLUMN IF NOT EXISTS loan_balance NUMERIC(12, 2);

CREATE INDEX IF NOT EXISTS properties_user_id_idx ON properties(user_id);
CREATE INDEX IF NOT EXISTS property_value_history_property_id_idx
  ON property_value_history(property_id);
CREATE INDEX IF NOT EXISTS property_value_history_valuation_month_idx
  ON property_value_history(valuation_month);
