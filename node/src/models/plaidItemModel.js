'use strict';

const db = require('../db/connection');
const { createOwnershipConflictError } = require('./ownershipError');
const {
  decryptToken,
  encryptToken,
} = require('../services/security/tokenEncryptionService');

const encryptAccessToken = ({ accessToken, userId, plaidItemId }) =>
  encryptToken(accessToken, { userId, plaidItemId });

const decryptPlaidItem = async (plaidItem) => {
  if (!plaidItem?.access_token) {
    return plaidItem;
  }

  return {
    ...plaidItem,
    access_token: await decryptToken(plaidItem.access_token, {
      userId: plaidItem.user_id,
      plaidItemId: plaidItem.plaid_item_id,
    }),
  };
};

const decryptPlaidItems = (plaidItems) => Promise.all(plaidItems.map(decryptPlaidItem));

const upsert = async ({
  userId,
  plaidItemId,
  accessToken,
  plaidEnvironment,
  institutionId,
  institutionName,
}) => {
  const encryptedAccessToken = await encryptAccessToken({
    accessToken,
    userId,
    plaidItemId,
  });
  const { rows } = await db.query(
    `
      INSERT INTO plaid_items (
        user_id,
        plaid_item_id,
        access_token,
        plaid_environment,
        institution_id,
        institution_name
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (plaid_item_id) DO UPDATE
      SET
        access_token = EXCLUDED.access_token,
        plaid_environment = EXCLUDED.plaid_environment,
        is_active = TRUE,
        institution_id = EXCLUDED.institution_id,
        institution_name = EXCLUDED.institution_name,
        updated_at = NOW()
      WHERE plaid_items.user_id = EXCLUDED.user_id
      RETURNING *
    `,
    [
      userId,
      plaidItemId,
      encryptedAccessToken,
      plaidEnvironment,
      institutionId,
      institutionName,
    ],
  );

  if (!rows[0]) {
    throw createOwnershipConflictError('Plaid Item');
  }

  return decryptPlaidItem(rows[0]);
};

const findByUserId = async (userId) => {
  const { rows } = await db.query(
    'SELECT * FROM plaid_items WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId],
  );

  return decryptPlaidItems(rows);
};

const findByUserIdAndEnvironment = async (userId, plaidEnvironment) => {
  const { rows } = await db.query(
    `
      SELECT *
      FROM plaid_items
      WHERE user_id = $1 AND plaid_environment = $2 AND is_active = TRUE
      ORDER BY updated_at DESC
    `,
    [userId, plaidEnvironment],
  );

  return decryptPlaidItems(rows);
};

const findInstitutionStatusesByUserIdAndEnvironment = async (
  userId,
  plaidEnvironment,
) => {
  const { rows } = await db.query(
    `
      SELECT
        COALESCE(
          plaid_items.institution_name,
          plaid_items.institution_id,
          'Unknown institution'
        ) AS institution_name,
        plaid_items.institution_id,
        plaid_items.plaid_environment,
        (
          ARRAY_AGG(plaid_items.plaid_item_id ORDER BY plaid_items.is_active DESC, plaid_items.updated_at DESC)
        )[1] AS plaid_item_id,
        BOOL_OR(plaid_items.is_active) AS has_active_access_token,
        BOOL_OR(NOT plaid_items.is_active) AS has_stale_access_token,
        COUNT(DISTINCT plaid_items.id)::int AS item_count,
        COUNT(DISTINCT accounts.id)::int AS account_count,
        MAX(plaid_items.updated_at) AS last_updated_at
      FROM plaid_items
      LEFT JOIN accounts ON accounts.plaid_item_id = plaid_items.plaid_item_id
      WHERE plaid_items.user_id = $1 AND plaid_items.plaid_environment = $2
      GROUP BY
        institution_name,
        plaid_items.institution_id,
        plaid_items.plaid_environment
      ORDER BY has_stale_access_token DESC, institution_name ASC
    `,
    [userId, plaidEnvironment],
  );

  return decryptPlaidItems(rows);
};

const findActiveNonDemoItems = async () => {
  const { rows } = await db.query(
    `
      SELECT plaid_items.*
      FROM plaid_items
      INNER JOIN users ON users.id = plaid_items.user_id
      WHERE plaid_items.is_active = TRUE
        AND users.is_demo = FALSE
      ORDER BY plaid_items.updated_at DESC
    `,
  );

  return decryptPlaidItems(rows);
};

const deletePlaidItemsByIds = async (client, itemIds) => {
  if (itemIds.length === 0) {
    return {
      deletedItems: [],
      deletedAccounts: [],
      deletedTransactions: [],
    };
  }

  const deletedTransactions = await client.query(
    `
      DELETE FROM transactions
      WHERE account_id IN (
        SELECT id
        FROM accounts
        WHERE plaid_item_id = ANY($1)
      )
      RETURNING *
    `,
    [itemIds],
  );
  const deletedAccounts = await client.query(
    `
      DELETE FROM accounts
      WHERE plaid_item_id = ANY($1)
      RETURNING *
    `,
    [itemIds],
  );
  const deletedItems = await client.query(
    `
      DELETE FROM plaid_items
      WHERE plaid_item_id = ANY($1)
      RETURNING *
    `,
    [itemIds],
  );

  return {
    deletedItems: deletedItems.rows,
    deletedAccounts: deletedAccounts.rows,
    deletedTransactions: deletedTransactions.rows,
  };
};

const deleteOlderByInstitution = async ({
  userId,
  plaidEnvironment,
  institutionId,
  institutionName,
  keepPlaidItemId,
}) => {
  const institutionKey = institutionId || institutionName;

  if (!institutionKey) {
    return {
      deletedItems: [],
      deletedAccounts: [],
      deletedTransactions: [],
    };
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `
        SELECT plaid_item_id
        FROM plaid_items
        WHERE
          user_id = $1
          AND plaid_environment = $2
          AND plaid_item_id <> $3
          AND COALESCE(institution_id, institution_name) = $4
      `,
      [userId, plaidEnvironment, keepPlaidItemId, institutionKey],
    );
    const result = await deletePlaidItemsByIds(
      client,
      rows.map((item) => item.plaid_item_id),
    );
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const staleCoveredItemQuery = (whereClause = '') => `
  WITH item_accounts AS (
    SELECT
      plaid_items.id,
      plaid_items.plaid_item_id,
      plaid_items.user_id,
      plaid_items.plaid_environment,
      COALESCE(
        plaid_items.institution_id,
        plaid_items.institution_name,
        plaid_items.plaid_item_id
      ) AS institution_key,
      plaid_items.updated_at,
      COALESCE(
        ARRAY_AGG(
          DISTINCT CONCAT_WS(
            '|',
            accounts.name,
            accounts.mask,
            accounts.official_name,
            accounts.subtype,
            accounts.type
          )
        ) FILTER (WHERE accounts.id IS NOT NULL),
        ARRAY[]::text[]
      ) AS account_signatures
    FROM plaid_items
    LEFT JOIN accounts ON accounts.plaid_item_id = plaid_items.plaid_item_id
    ${whereClause}
    GROUP BY plaid_items.id
  )
  SELECT old_items.plaid_item_id
  FROM item_accounts old_items
  WHERE EXISTS (
    SELECT 1
    FROM item_accounts newer_items
    WHERE
      newer_items.user_id = old_items.user_id
      AND newer_items.plaid_environment = old_items.plaid_environment
      AND newer_items.institution_key = old_items.institution_key
      AND newer_items.id <> old_items.id
      AND (
        newer_items.updated_at > old_items.updated_at
        OR (
          newer_items.updated_at = old_items.updated_at
          AND newer_items.id > old_items.id
        )
      )
      AND old_items.account_signatures <@ newer_items.account_signatures
  )
`;

const pruneStaleForUserEnvironment = async ({ userId, plaidEnvironment }) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      staleCoveredItemQuery(
        'WHERE plaid_items.user_id = $1 AND plaid_items.plaid_environment = $2',
      ),
      [userId, plaidEnvironment],
    );
    const result = await deletePlaidItemsByIds(
      client,
      rows.map((item) => item.plaid_item_id),
    );
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const pruneStaleDuplicates = async () => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const { rows } = await client.query(staleCoveredItemQuery());
    const result = await deletePlaidItemsByIds(
      client,
      rows.map((item) => item.plaid_item_id),
    );
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const findByPlaidItemId = async (plaidItemId) => {
  const { rows } = await db.query(
    'SELECT * FROM plaid_items WHERE plaid_item_id = $1',
    [plaidItemId],
  );

  return decryptPlaidItem(rows[0] || null);
};

const deleteByPlaidItemIdForUser = async ({ plaidItemId, userId }) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `
        SELECT plaid_item_id
        FROM plaid_items
        WHERE plaid_item_id = $1 AND user_id = $2
      `,
      [plaidItemId, userId],
    );
    const result = await deletePlaidItemsByIds(
      client,
      rows.map((item) => item.plaid_item_id),
    );
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const updateTransactionsCursor = async ({ id, transactionsCursor }) => {
  const { rows } = await db.query(
    `
      UPDATE plaid_items
      SET
        transactions_cursor = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, transactionsCursor],
  );

  return rows[0] || null;
};

module.exports = {
  upsert,
  findByUserId,
  findByUserIdAndEnvironment,
  findInstitutionStatusesByUserIdAndEnvironment,
  findActiveNonDemoItems,
  deleteOlderByInstitution,
  pruneStaleForUserEnvironment,
  pruneStaleDuplicates,
  findByPlaidItemId,
  deleteByPlaidItemIdForUser,
  updateTransactionsCursor,
};
