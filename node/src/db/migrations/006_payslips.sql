CREATE TABLE IF NOT EXISTS payslip_uploads (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payslip_uploads_user_id_idx
  ON payslip_uploads(user_id);

CREATE TABLE IF NOT EXISTS payslips (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  upload_id BIGINT REFERENCES payslip_uploads(id) ON DELETE SET NULL,
  payslip_identifier TEXT NOT NULL,
  employee_name TEXT,
  employer_name TEXT,
  employee_id TEXT,
  pay_period_begin DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  check_date DATE NOT NULL,
  check_number TEXT,
  hours_worked NUMERIC(10, 2),
  gross_pay NUMERIC(12, 2),
  pre_tax_deductions NUMERIC(12, 2),
  pretax_401k NUMERIC(12, 2),
  pretax_401k_bonus_deferral NUMERIC(12, 2),
  pretax_dental NUMERIC(12, 2),
  pretax_fsa_healthcare NUMERIC(12, 2),
  pretax_hsa NUMERIC(12, 2),
  pretax_medical NUMERIC(12, 2),
  associate_taxes NUMERIC(12, 2),
  social_security_tax NUMERIC(12, 2),
  medicare_tax NUMERIC(12, 2),
  federal_withholding_tax NUMERIC(12, 2),
  state_tax NUMERIC(12, 2),
  ca_disability_insurance_tax NUMERIC(12, 2),
  post_tax_deductions NUMERIC(12, 2),
  posttax_401k_roth NUMERIC(12, 2),
  posttax_401k_bonus_deferral_roth NUMERIC(12, 2),
  net_pay NUMERIC(12, 2),
  income_transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, payslip_identifier)
);

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS payslip_identifier TEXT NOT NULL DEFAULT '';
UPDATE payslips
SET payslip_identifier = CONCAT_WS(
  '|',
  COALESCE(employee_id, ''),
  pay_period_begin::TEXT,
  pay_period_end::TEXT,
  check_date::TEXT,
  COALESCE(check_number, '')
)
WHERE payslip_identifier = '';
ALTER TABLE payslips
  DROP CONSTRAINT IF EXISTS payslips_user_id_employee_id_pay_period_begin_pay_period_end_check_key;
DROP INDEX IF EXISTS payslips_user_id_employee_id_pay_period_begin_pay_period_end_check_key;
DROP INDEX IF EXISTS payslips_user_identifier_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payslips_user_id_payslip_identifier_key'
  ) THEN
    ALTER TABLE payslips
      ADD CONSTRAINT payslips_user_id_payslip_identifier_key
      UNIQUE (user_id, payslip_identifier);
  END IF;
END $$;
ALTER TABLE payslips DROP COLUMN IF EXISTS page_number;
ALTER TABLE payslips DROP COLUMN IF EXISTS ytd_hours_worked;
ALTER TABLE payslips DROP COLUMN IF EXISTS ytd_gross_pay;
ALTER TABLE payslips DROP COLUMN IF EXISTS ytd_pre_tax_deductions;
ALTER TABLE payslips DROP COLUMN IF EXISTS ytd_associate_taxes;
ALTER TABLE payslips DROP COLUMN IF EXISTS ytd_post_tax_deductions;
ALTER TABLE payslips DROP COLUMN IF EXISTS ytd_net_pay;
ALTER TABLE payslips DROP COLUMN IF EXISTS payment_account_name;
ALTER TABLE payslips DROP COLUMN IF EXISTS payment_account_mask;
ALTER TABLE payslips DROP COLUMN IF EXISTS raw_text;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS social_security_tax NUMERIC(12, 2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS medicare_tax NUMERIC(12, 2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS federal_withholding_tax NUMERIC(12, 2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS state_tax NUMERIC(12, 2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS ca_disability_insurance_tax NUMERIC(12, 2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS pretax_401k NUMERIC(12, 2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS pretax_401k_bonus_deferral NUMERIC(12, 2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS pretax_dental NUMERIC(12, 2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS pretax_fsa_healthcare NUMERIC(12, 2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS pretax_hsa NUMERIC(12, 2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS pretax_medical NUMERIC(12, 2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS posttax_401k_roth NUMERIC(12, 2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS posttax_401k_bonus_deferral_roth NUMERIC(12, 2);
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS income_transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payslips_user_id_idx
  ON payslips(user_id);
CREATE INDEX IF NOT EXISTS payslips_check_date_idx
  ON payslips(check_date);
CREATE INDEX IF NOT EXISTS payslips_income_transaction_id_idx
  ON payslips(income_transaction_id);
