'use strict';

const db = require('../db/connection');

const upsert = async ({
  accountId,
  plaidTransactionId,
  amount,
  category,
  date,
  merchantName,
  name,
  pending,
}) => {
  const { rows } = await db.query(
    `
      INSERT INTO transactions (
        account_id,
        plaid_transaction_id,
        amount,
        category,
        date,
        merchant_name,
        name,
        pending
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (plaid_transaction_id) DO UPDATE
      SET
        account_id = EXCLUDED.account_id,
        amount = EXCLUDED.amount,
        category = EXCLUDED.category,
        date = EXCLUDED.date,
        merchant_name = EXCLUDED.merchant_name,
        name = EXCLUDED.name,
        pending = EXCLUDED.pending,
        updated_at = NOW()
      RETURNING *
    `,
    [
      accountId,
      plaidTransactionId,
      amount,
      category,
      date,
      merchantName,
      name,
      pending,
    ],
  );

  return rows[0];
};

const findByIdForUserId = async ({ id, userId }) => {
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
      WHERE transactions.id = $1 AND accounts.user_id = $2
    `,
    [id, userId],
  );

  return rows[0] || null;
};

const updateManualCategoryForUserId = async ({
  id,
  userId,
  manualCategory,
}) => {
  const { rows } = await db.query(
    `
      UPDATE transactions
      SET
        manual_category = $3,
        updated_at = NOW()
      FROM accounts
      WHERE
        transactions.account_id = accounts.id
        AND transactions.id = $1
        AND accounts.user_id = $2
      RETURNING transactions.*
    `,
    [id, userId, manualCategory],
  );

  return rows[0] || null;
};

const updateManualDateForUserId = async ({
  id,
  userId,
  manualDate,
}) => {
  const { rows } = await db.query(
    `
      UPDATE transactions
      SET
        manual_date = $3,
        updated_at = NOW()
      FROM accounts
      WHERE
        transactions.account_id = accounts.id
        AND transactions.id = $1
        AND accounts.user_id = $2
      RETURNING transactions.*
    `,
    [id, userId, manualDate],
  );

  return rows[0] || null;
};

const findByUserIdEnvironmentAndDateRange = async ({
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
      ORDER BY COALESCE(transactions.manual_date, transactions.date) DESC, transactions.id DESC
    `,
    [userId, plaidEnvironment, startDate, endDate],
  );

  return rows;
};

const findIncomeMatchForPayslip = async ({
  userId,
  plaidEnvironment,
  checkDate,
  netPay,
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
        AND transactions.pending = FALSE
        AND COALESCE(transactions.manual_date, transactions.date) = $3
        AND ABS(ABS(transactions.amount) - $4::numeric) < 0.01
        AND (
          transactions.amount < 0
          OR LOWER(COALESCE(transactions.manual_category, '')) = 'income'
        )
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(transactions.manual_category, '')) = 'income' THEN 0
          ELSE 1
        END,
        transactions.id ASC
      LIMIT 1
    `,
    [userId, plaidEnvironment, checkDate, netPay],
  );

  return rows[0] || null;
};

const deleteByPlaidTransactionIdsForUserId = async ({
  plaidTransactionIds,
  userId,
}) => {
  if (plaidTransactionIds.length === 0) {
    return [];
  }

  const { rows } = await db.query(
    `
      DELETE FROM transactions
      WHERE plaid_transaction_id = ANY($1)
        AND account_id IN (
          SELECT id FROM accounts WHERE user_id = $2
        )
      RETURNING *
    `,
    [plaidTransactionIds, userId],
  );

  return rows;
};

module.exports = {
  upsert,
  findByIdForUserId,
  updateManualCategoryForUserId,
  updateManualDateForUserId,
  findByUserIdEnvironmentAndDateRange,
  findIncomeMatchForPayslip,
  deleteByPlaidTransactionIdsForUserId,
};
