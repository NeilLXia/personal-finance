'use strict';

const db = require('../db/connection');

const upsert = async ({
  userId,
  address,
  loanOriginalAmount = null,
  loanAnnualInterestRate = null,
  loanMonthlyPayment = null,
  loanBalanceStartMonth = null,
}) => {
  const { rows } = await db.query(
    `
      INSERT INTO properties (
        user_id,
        address,
        loan_original_amount,
        loan_annual_interest_rate,
        loan_monthly_payment,
        loan_balance_start_month
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, address) DO UPDATE
      SET
        loan_original_amount = COALESCE(
          EXCLUDED.loan_original_amount,
          properties.loan_original_amount
        ),
        loan_annual_interest_rate = COALESCE(
          EXCLUDED.loan_annual_interest_rate,
          properties.loan_annual_interest_rate
        ),
        loan_monthly_payment = COALESCE(
          EXCLUDED.loan_monthly_payment,
          properties.loan_monthly_payment
        ),
        loan_balance_start_month = COALESCE(
          EXCLUDED.loan_balance_start_month,
          properties.loan_balance_start_month
        ),
        is_active = TRUE,
        updated_at = NOW()
      RETURNING *
    `,
    [
      userId,
      address,
      loanOriginalAmount,
      loanAnnualInterestRate,
      loanMonthlyPayment,
      loanBalanceStartMonth,
    ],
  );

  return rows[0];
};

const findByUserId = async (userId) => {
  const { rows } = await db.query(
    `
      SELECT *
      FROM properties
      WHERE user_id = $1 AND is_active = TRUE
      ORDER BY address ASC
    `,
    [userId],
  );

  return rows;
};

const findByIdForUser = async ({ id, userId }) => {
  const { rows } = await db.query(
    `
      SELECT *
      FROM properties
      WHERE id = $1 AND user_id = $2 AND is_active = TRUE
    `,
    [id, userId],
  );

  return rows[0] || null;
};

const updateByIdForUser = async ({
  id,
  userId,
  address,
  loanOriginalAmount = null,
  loanAnnualInterestRate = null,
  loanMonthlyPayment = null,
  loanBalanceStartMonth = null,
}) => {
  const { rows } = await db.query(
    `
      UPDATE properties
      SET
        address = $3,
        loan_original_amount = $4,
        loan_annual_interest_rate = $5,
        loan_monthly_payment = $6,
        loan_balance_start_month = $7,
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND is_active = TRUE
      RETURNING *
    `,
    [
      id,
      userId,
      address,
      loanOriginalAmount,
      loanAnnualInterestRate,
      loanMonthlyPayment,
      loanBalanceStartMonth,
    ],
  );

  return rows[0] || null;
};

const deactivateByIdForUser = async ({ id, userId }) => {
  const { rows } = await db.query(
    `
      UPDATE properties
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND is_active = TRUE
      RETURNING *
    `,
    [id, userId],
  );

  return rows[0] || null;
};

const findWithLatestValuesByUserId = async (userId) => {
  const { rows } = await db.query(
    `
      SELECT
        properties.*,
        latest_value.valuation_month,
        latest_value.estimated_value,
        latest_value.loan_balance,
        latest_value.price_range_low,
        latest_value.price_range_high
      FROM properties
      LEFT JOIN LATERAL (
        SELECT *
        FROM property_value_history
        WHERE property_value_history.property_id = properties.id
        ORDER BY property_value_history.valuation_month DESC
        LIMIT 1
      ) latest_value ON TRUE
      WHERE properties.user_id = $1 AND properties.is_active = TRUE
      ORDER BY properties.address ASC
    `,
    [userId],
  );

  return rows;
};

const hasMonthlyValuation = async ({
  propertyId,
  userId,
  valuationMonth = null,
}) => {
  const { rows } = await db.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM property_value_history
        INNER JOIN properties
          ON properties.id = property_value_history.property_id
        WHERE
          property_value_history.property_id = $1
          AND properties.user_id = $3
          AND DATE_TRUNC('month', property_value_history.valuation_month)::date =
            DATE_TRUNC(
              'month',
              COALESCE($2, DATE_TRUNC('month', CURRENT_DATE)::date)
            )::date
      ) AS exists
    `,
    [propertyId, valuationMonth, userId],
  );

  return rows[0].exists;
};

const createMonthlyValuation = async ({
  propertyId,
  userId,
  valuationMonth = null,
  estimatedValue,
  priceRangeLow,
  priceRangeHigh,
  loanBalance,
  rawResponse,
}) => {
  const { rows } = await db.query(
    `
      INSERT INTO property_value_history (
        property_id,
        valuation_month,
        estimated_value,
        loan_balance,
        price_range_low,
        price_range_high,
        raw_response
      )
      SELECT
        $1,
        COALESCE($2, DATE_TRUNC('month', CURRENT_DATE)::date),
        $3,
        $4,
        $5,
        $6,
        $7
      WHERE EXISTS (
        SELECT 1 FROM properties
        WHERE properties.id = $1 AND properties.user_id = $8
      )
      ON CONFLICT (property_id, valuation_month) DO UPDATE
      SET
        loan_balance = EXCLUDED.loan_balance
      RETURNING *
    `,
    [
      propertyId,
      valuationMonth,
      estimatedValue,
      loanBalance,
      priceRangeLow,
      priceRangeHigh,
      rawResponse,
      userId,
    ],
  );

  return rows[0] || null;
};

const updateMonthlyLoanBalance = async ({
  propertyId,
  userId,
  valuationMonth = null,
  loanBalance,
}) => {
  const { rows } = await db.query(
    `
      UPDATE property_value_history
      SET loan_balance = $3
      WHERE
        property_id = $1
        AND property_id IN (
          SELECT id FROM properties WHERE user_id = $4
        )
        AND DATE_TRUNC('month', valuation_month)::date =
          DATE_TRUNC(
            'month',
            COALESCE($2, DATE_TRUNC('month', CURRENT_DATE)::date)
          )::date
      RETURNING *
    `,
    [propertyId, valuationMonth, loanBalance, userId],
  );

  return rows[0] || null;
};

module.exports = {
  upsert,
  findByUserId,
  findByIdForUser,
  updateByIdForUser,
  deactivateByIdForUser,
  findWithLatestValuesByUserId,
  hasMonthlyValuation,
  createMonthlyValuation,
  updateMonthlyLoanBalance,
};
