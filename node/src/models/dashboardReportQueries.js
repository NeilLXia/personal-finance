'use strict';

// Read-only, report-shaped queries that exist only to assemble the dashboard
// payload (grouped aggregates, date-bucketed history, cash-flow slices). Kept
// out of the entity models so those stay focused on CRUD; the only consumer is
// services/dashboard. Registered as `models.dashboardReports`.

const db = require('../db/connection');

const findCashFlowTransactionsByUserIdAndEnvironment = async ({
  userId,
  plaidEnvironment,
  startDate,
  endDate,
}) => {
  const { rows } = await db.query(
    `
      SELECT
        transactions.*,
        accounts.name AS account_name,
        accounts.mask AS account_mask,
        accounts.type AS account_type,
        accounts.subtype AS account_subtype,
        plaid_items.institution_name
      FROM transactions
      INNER JOIN accounts ON accounts.id = transactions.account_id
      INNER JOIN plaid_items
        ON plaid_items.plaid_item_id = accounts.plaid_item_id
      WHERE
        accounts.user_id = $1
        AND plaid_items.plaid_environment = $2
        AND plaid_items.is_active = TRUE
        AND COALESCE(transactions.manual_date, transactions.date) >= $3
        AND COALESCE(transactions.manual_date, transactions.date) <= $4
      ORDER BY COALESCE(transactions.manual_date, transactions.date) ASC, transactions.id ASC
    `,
    [userId, plaidEnvironment, startDate, endDate],
  );

  return rows;
};

const findTransactionYearsByUserIdAndEnvironment = async ({
  userId,
  plaidEnvironment,
}) => {
  const { rows } = await db.query(
    `
      SELECT DISTINCT
        EXTRACT(YEAR FROM COALESCE(transactions.manual_date, transactions.date))::int AS year
      FROM transactions
      INNER JOIN accounts ON accounts.id = transactions.account_id
      INNER JOIN plaid_items
        ON plaid_items.plaid_item_id = accounts.plaid_item_id
      WHERE
        accounts.user_id = $1
        AND plaid_items.plaid_environment = $2
        AND plaid_items.is_active = TRUE
      ORDER BY year DESC
    `,
    [userId, plaidEnvironment],
  );

  return rows.map((row) => row.year);
};

const findNetWorthAccountHistoryByUserIdAndEnvironment = async (
  userId,
  plaidEnvironment,
) => {
  const { rows } = await db.query(
    `
      SELECT
        accounts.id,
        accounts.name,
        accounts.mask,
        accounts.official_name,
        accounts.subtype,
        accounts.type,
        plaid_items.institution_name,
        account_balance_history.balance_date,
        CASE
          WHEN accounts.type = 'credit'
            THEN -1 * account_balance_history.balance_current
          ELSE account_balance_history.balance_current
        END AS balance
      FROM account_balance_history
      INNER JOIN accounts ON accounts.id = account_balance_history.account_id
      INNER JOIN plaid_items
        ON plaid_items.plaid_item_id = accounts.plaid_item_id
      WHERE
        accounts.user_id = $1
        AND plaid_items.plaid_environment = $2
        AND plaid_items.is_active = TRUE
        AND accounts.type IN ('depository', 'investment', 'credit')
      ORDER BY account_balance_history.balance_date ASC, plaid_items.institution_name ASC, accounts.name ASC
    `,
    [userId, plaidEnvironment],
  );

  return rows;
};

// Latest valuation per property per calendar month, used by the three
// property-history reports below.
const MONTHLY_LATEST_CTE = `
  monthly_latest AS (
    SELECT DISTINCT ON (
      property_value_history.property_id,
      DATE_TRUNC('month', property_value_history.valuation_month)
    )
      property_value_history.property_id,
      DATE_TRUNC('month', property_value_history.valuation_month)::date
        AS valuation_month,
      property_value_history.estimated_value,
      property_value_history.loan_balance
    FROM property_value_history
    ORDER BY
      property_value_history.property_id,
      DATE_TRUNC('month', property_value_history.valuation_month),
      property_value_history.valuation_month DESC
  )
`;

const findPropertyMonthlyHistoryByUserId = async (userId) => {
  const { rows } = await db.query(
    `
      WITH ${MONTHLY_LATEST_CTE}
      SELECT
        monthly_latest.valuation_month,
        SUM(
          monthly_latest.estimated_value
          - COALESCE(monthly_latest.loan_balance, 0)
        ) AS real_estate
      FROM monthly_latest
      INNER JOIN properties
        ON properties.id = monthly_latest.property_id
      WHERE properties.user_id = $1 AND properties.is_active = TRUE
      GROUP BY monthly_latest.valuation_month
      ORDER BY monthly_latest.valuation_month ASC
    `,
    [userId],
  );

  return rows;
};

const findPropertyValuationHistoryByUserId = async (userId) => {
  const { rows } = await db.query(
    `
      WITH ${MONTHLY_LATEST_CTE}
      SELECT
        properties.id,
        properties.address,
        monthly_latest.valuation_month,
        monthly_latest.estimated_value,
        monthly_latest.loan_balance
      FROM monthly_latest
      INNER JOIN properties
        ON properties.id = monthly_latest.property_id
      WHERE properties.user_id = $1 AND properties.is_active = TRUE
      ORDER BY monthly_latest.valuation_month ASC, properties.address ASC
    `,
    [userId],
  );

  return rows;
};

const findPropertyMonthlyPrincipalPaidByUserId = async (userId) => {
  const { rows } = await db.query(
    `
      WITH ${MONTHLY_LATEST_CTE}
      SELECT
        monthly_latest.valuation_month,
        SUM(
          GREATEST(
            0,
            COALESCE(properties.loan_monthly_payment, 0)
            - COALESCE(monthly_latest.loan_balance, 0)
              * (COALESCE(properties.loan_annual_interest_rate, 0) / 100 / 12)
          )
        ) AS principal_paid
      FROM monthly_latest
      INNER JOIN properties
        ON properties.id = monthly_latest.property_id
      WHERE
        properties.user_id = $1
        AND properties.is_active = TRUE
        AND properties.loan_monthly_payment IS NOT NULL
        AND properties.loan_annual_interest_rate IS NOT NULL
        AND monthly_latest.loan_balance IS NOT NULL
      GROUP BY monthly_latest.valuation_month
      ORDER BY monthly_latest.valuation_month ASC
    `,
    [userId],
  );

  return rows;
};

const findPropertyLatestTotalByUserId = async (userId) => {
  const { rows } = await db.query(
    `
      SELECT
        COALESCE(
          SUM(
            latest_value.estimated_value
            - COALESCE(latest_value.loan_balance, 0)
          ),
          0
        ) AS total
      FROM properties
      LEFT JOIN LATERAL (
        SELECT estimated_value, loan_balance
        FROM property_value_history
        WHERE property_value_history.property_id = properties.id
        ORDER BY property_value_history.valuation_month DESC
        LIMIT 1
      ) latest_value ON TRUE
      WHERE properties.user_id = $1 AND properties.is_active = TRUE
    `,
    [userId],
  );

  return Number(rows[0].total || 0);
};

module.exports = {
  findCashFlowTransactionsByUserIdAndEnvironment,
  findTransactionYearsByUserIdAndEnvironment,
  findNetWorthAccountHistoryByUserIdAndEnvironment,
  findPropertyMonthlyHistoryByUserId,
  findPropertyValuationHistoryByUserId,
  findPropertyMonthlyPrincipalPaidByUserId,
  findPropertyLatestTotalByUserId,
};
