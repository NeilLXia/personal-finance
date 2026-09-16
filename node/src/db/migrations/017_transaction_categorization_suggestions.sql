CREATE TABLE IF NOT EXISTS transaction_categorization_batches (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  model_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transaction_categorization_batches_month_check
    CHECK (month ~ '^\d{4}-\d{2}$'),
  CONSTRAINT transaction_categorization_batches_scope_check
    CHECK (scope IN ('user_only', 'user_and_starter_patterns')),
  CONSTRAINT transaction_categorization_batches_status_check
    CHECK (status IN ('pending', 'partial', 'approved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS transaction_categorization_batches_user_month_idx
  ON transaction_categorization_batches(user_id, month, created_at DESC);

CREATE TABLE IF NOT EXISTS transaction_categorization_suggestions (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL
    REFERENCES transaction_categorization_batches(id) ON DELETE CASCADE,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  assigned_category TEXT,
  assigned_source TEXT NOT NULL,
  suggested_category TEXT NOT NULL,
  confidence NUMERIC(5, 4) NOT NULL,
  review_required BOOLEAN NOT NULL DEFAULT TRUE,
  review_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_category TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, transaction_id),
  CONSTRAINT transaction_categorization_suggestions_source_check
    CHECK (
      assigned_source IN (
        'manual_category',
        'rule',
        'user_history',
        'starter_pattern',
        'plaid_default',
        'model'
      )
    ),
  CONSTRAINT transaction_categorization_suggestions_status_check
    CHECK (status IN ('pending', 'approved', 'edited', 'dismissed')),
  CONSTRAINT transaction_categorization_suggestions_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS transaction_categorization_suggestions_batch_idx
  ON transaction_categorization_suggestions(batch_id);
CREATE INDEX IF NOT EXISTS transaction_categorization_suggestions_transaction_idx
  ON transaction_categorization_suggestions(transaction_id);

CREATE TABLE IF NOT EXISTS transaction_categorization_training_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  suggestion_id BIGINT REFERENCES transaction_categorization_suggestions(id)
    ON DELETE SET NULL,
  source TEXT NOT NULL,
  suggested_category TEXT,
  approved_category TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transaction_categorization_training_events_action_check
    CHECK (action IN ('approved', 'edited', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS transaction_categorization_training_events_user_idx
  ON transaction_categorization_training_events(user_id, created_at DESC);
