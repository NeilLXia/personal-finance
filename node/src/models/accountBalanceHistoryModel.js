'use strict';

const db = require('../db/connection');

const createDailySnapshot = async ({
  accountId,
  balanceDate = null,
  balanceAvailable,
  balanceCurrent,
  balanceLimit,
  isoCurrencyCode,
  unofficialCurrencyCode,
}) => {
  const { rows } = await db.query(
    `
      INSERT INTO account_balance_history (
        account_id,
        balance_date,
        balance_available,
        balance_current,
        balance_limit,
        iso_currency_code,
        unofficial_currency_code
      )
      VALUES (
        $1,
        COALESCE($2, CURRENT_DATE),
        $3,
        $4,
        $5,
        $6,
        $7
      )
      ON CONFLICT (account_id, balance_date) DO NOTHING
      RETURNING *
    `,
    [
      accountId,
      balanceDate,
      balanceAvailable,
      balanceCurrent,
      balanceLimit,
      isoCurrencyCode,
      unofficialCurrencyCode,
    ],
  );

  return rows[0] || null;
};

const hasDailySnapshotsForPlaidItemId = async ({
  plaidItemId,
  balanceDate = null,
}) => {
  const { rows } = await db.query(
    `
      SELECT
        COUNT(accounts.id)::int AS account_count,
        COUNT(account_balance_history.id)::int AS snapshot_count
      FROM accounts
      LEFT JOIN account_balance_history
        ON account_balance_history.account_id = accounts.id
        AND account_balance_history.balance_date = COALESCE($2, CURRENT_DATE)
      WHERE accounts.plaid_item_id = $1
    `,
    [plaidItemId, balanceDate],
  );
  const row = rows[0];

  return row.account_count > 0 && row.account_count === row.snapshot_count;
};

const hasMonthlySnapshotsForPlaidItemId = async ({
  plaidItemId,
  balanceMonth = null,
}) => {
  const { rows } = await db.query(
    `
      SELECT
        COUNT(accounts.id)::int AS account_count,
        COUNT(DISTINCT account_balance_history.account_id)::int AS snapshot_count
      FROM accounts
      LEFT JOIN account_balance_history
        ON account_balance_history.account_id = accounts.id
        AND DATE_TRUNC('month', account_balance_history.balance_date)::date =
          DATE_TRUNC('month', COALESCE($2, CURRENT_DATE)::date)::date
      WHERE accounts.plaid_item_id = $1
    `,
    [plaidItemId, balanceMonth],
  );
  const row = rows[0];

  return row.account_count > 0 && row.account_count === row.snapshot_count;
};

module.exports = {
  createDailySnapshot,
  hasDailySnapshotsForPlaidItemId,
  hasMonthlySnapshotsForPlaidItemId,
};
