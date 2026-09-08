'use strict';

const db = require('../db/connection');
const { createOwnershipConflictError } = require('./ownershipError');

const upsert = async ({
  userId,
  plaidAccountId,
  plaidItemId,
  name,
  mask,
  officialName,
  subtype,
  type,
  balanceAvailable,
  balanceCurrent,
  balanceLimit,
  isoCurrencyCode,
  unofficialCurrencyCode,
}) => {
  const { rows } = await db.query(
    `
      INSERT INTO accounts (
        user_id,
        plaid_account_id,
        plaid_item_id,
        name,
        mask,
        official_name,
        subtype,
        type,
        balance_available,
        balance_current,
        balance_limit,
        iso_currency_code,
        unofficial_currency_code
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (plaid_account_id) DO UPDATE
      SET
        plaid_item_id = EXCLUDED.plaid_item_id,
        name = EXCLUDED.name,
        mask = EXCLUDED.mask,
        official_name = EXCLUDED.official_name,
        subtype = EXCLUDED.subtype,
        type = EXCLUDED.type,
        balance_available = EXCLUDED.balance_available,
        balance_current = EXCLUDED.balance_current,
        balance_limit = EXCLUDED.balance_limit,
        iso_currency_code = EXCLUDED.iso_currency_code,
        unofficial_currency_code = EXCLUDED.unofficial_currency_code,
        updated_at = NOW()
      WHERE accounts.user_id = EXCLUDED.user_id
      RETURNING *
    `,
    [
      userId,
      plaidAccountId,
      plaidItemId,
      name,
      mask,
      officialName,
      subtype,
      type,
      balanceAvailable,
      balanceCurrent,
      balanceLimit,
      isoCurrencyCode,
      unofficialCurrencyCode,
    ],
  );

  if (!rows[0]) {
    throw createOwnershipConflictError('Plaid account');
  }

  return rows[0];
};

const findByUserIdAndEnvironment = async (userId, plaidEnvironment) => {
  const { rows } = await db.query(
    `
      SELECT
        accounts.*,
        plaid_items.institution_name,
        plaid_items.institution_id
      FROM accounts
      INNER JOIN plaid_items
        ON plaid_items.plaid_item_id = accounts.plaid_item_id
      WHERE
        accounts.user_id = $1
        AND plaid_items.plaid_environment = $2
        AND plaid_items.is_active = TRUE
      ORDER BY plaid_items.institution_name ASC, accounts.name ASC
    `,
    [userId, plaidEnvironment],
  );

  return rows;
};

const findByPlaidAccountId = async (plaidAccountId) => {
  const { rows } = await db.query(
    'SELECT * FROM accounts WHERE plaid_account_id = $1',
    [plaidAccountId],
  );

  return rows[0] || null;
};

module.exports = {
  upsert,
  findByUserIdAndEnvironment,
  findByPlaidAccountId,
};
