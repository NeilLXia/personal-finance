'use strict';

const db = require('../db/connection');

const createBatchWithSuggestions = async ({
  userId,
  month,
  scope,
  modelVersion,
  suggestions,
}) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `
        INSERT INTO transaction_categorization_batches (
          user_id,
          month,
          scope,
          model_version
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [userId, month, scope, modelVersion],
    );
    const batch = rows[0];

    if (suggestions.length === 0) {
      await client.query('COMMIT');
      return { batch, suggestions: [] };
    }

    const values = [];
    const placeholders = suggestions
      .map((suggestion, index) => {
        const offset = index * 9;
        values.push(
          batch.id,
          suggestion.transaction_id,
          suggestion.assigned_category,
          suggestion.assigned_source,
          suggestion.suggested_category,
          suggestion.confidence,
          suggestion.review_required,
          suggestion.review_reasons,
          JSON.stringify(suggestion.evidence || {}),
        );

        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}::jsonb)`;
      })
      .join(', ');
    const inserted = await client.query(
      `
        INSERT INTO transaction_categorization_suggestions (
          batch_id,
          transaction_id,
          assigned_category,
          assigned_source,
          suggested_category,
          confidence,
          review_required,
          review_reasons,
          evidence
        )
        VALUES ${placeholders}
        RETURNING *
      `,
      values,
    );

    await client.query('COMMIT');
    return { batch, suggestions: inserted.rows };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const findBatchForUser = async ({ batchId, userId }) => {
  const { rows } = await db.query(
    `
      SELECT *
      FROM transaction_categorization_batches
      WHERE id = $1 AND user_id = $2
    `,
    [batchId, userId],
  );

  return rows[0] || null;
};

const findSuggestionsByBatchForUser = async ({ batchId, userId }) => {
  const { rows } = await db.query(
    `
      SELECT
        suggestions.*,
        transactions.amount,
        transactions.date,
        transactions.manual_date,
        transactions.name,
        transactions.merchant_name,
        transactions.category,
        transactions.manual_category AS transaction_manual_category,
        accounts.name AS account_name,
        accounts.mask AS account_mask,
        plaid_items.institution_name
      FROM transaction_categorization_suggestions suggestions
      INNER JOIN transaction_categorization_batches batches
        ON batches.id = suggestions.batch_id
      INNER JOIN transactions
        ON transactions.id = suggestions.transaction_id
      INNER JOIN accounts
        ON accounts.id = transactions.account_id
      INNER JOIN plaid_items
        ON plaid_items.plaid_item_id = accounts.plaid_item_id
      WHERE
        suggestions.batch_id = $1
        AND batches.user_id = $2
        AND accounts.user_id = $2
      ORDER BY suggestions.review_required DESC, suggestions.confidence ASC, transactions.date DESC
    `,
    [batchId, userId],
  );

  return rows;
};

const findSuggestionsByIdsForUser = async ({ suggestionIds, userId }) => {
  if (suggestionIds.length === 0) {
    return [];
  }

  const { rows } = await db.query(
    `
      SELECT suggestions.*
      FROM transaction_categorization_suggestions suggestions
      INNER JOIN transaction_categorization_batches batches
        ON batches.id = suggestions.batch_id
      INNER JOIN transactions
        ON transactions.id = suggestions.transaction_id
      INNER JOIN accounts
        ON accounts.id = transactions.account_id
      WHERE
        suggestions.id = ANY($1::bigint[])
        AND batches.user_id = $2
        AND accounts.user_id = $2
    `,
    [suggestionIds, userId],
  );

  return rows;
};

const approveSuggestionsForUser = async ({
  suggestionIds,
  userId,
  categoryBySuggestionId,
}) => {
  if (suggestionIds.length === 0) {
    return [];
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const suggestions = await client.query(
      `
        SELECT suggestions.*
        FROM transaction_categorization_suggestions suggestions
        INNER JOIN transaction_categorization_batches batches
          ON batches.id = suggestions.batch_id
        INNER JOIN transactions
          ON transactions.id = suggestions.transaction_id
        INNER JOIN accounts
          ON accounts.id = transactions.account_id
        WHERE
          suggestions.id = ANY($1::bigint[])
          AND batches.user_id = $2
          AND accounts.user_id = $2
          AND suggestions.status = 'pending'
        FOR UPDATE OF suggestions
      `,
      [suggestionIds, userId],
    );

    if (suggestions.rows.length === 0) {
      await client.query('COMMIT');
      return [];
    }

    const ids = [];
    const transactionIds = [];
    const approvedCategories = [];
    const actions = [];
    const assignedSources = [];
    const suggestedCategories = [];

    suggestions.rows.forEach((suggestion) => {
      const approvedCategory =
        categoryBySuggestionId.get(Number(suggestion.id)) ||
        suggestion.suggested_category;
      const action =
        approvedCategory === suggestion.suggested_category ? 'approved' : 'edited';

      ids.push(suggestion.id);
      transactionIds.push(suggestion.transaction_id);
      approvedCategories.push(approvedCategory);
      actions.push(action);
      assignedSources.push(suggestion.assigned_source);
      suggestedCategories.push(suggestion.suggested_category);
    });

    // Batched equivalents of the old per-suggestion loop: one UPDATE, one
    // UPDATE, and one INSERT ... SELECT regardless of how many suggestions
    // are being approved, instead of 3 round trips per suggestion.
    await client.query(
      `
        UPDATE transactions
        SET manual_category = updates.approved_category, updated_at = NOW()
        FROM accounts, UNNEST($1::bigint[], $2::text[]) AS updates(transaction_id, approved_category)
        WHERE
          transactions.id = updates.transaction_id
          AND transactions.account_id = accounts.id
          AND accounts.user_id = $3
      `,
      [transactionIds, approvedCategories, userId],
    );

    const updatedSuggestions = await client.query(
      `
        UPDATE transaction_categorization_suggestions AS suggestions
        SET
          status = updates.action,
          approved_category = updates.approved_category,
          approved_at = NOW(),
          updated_at = NOW()
        FROM UNNEST($1::bigint[], $2::text[], $3::text[]) AS updates(id, action, approved_category)
        WHERE suggestions.id = updates.id
        RETURNING suggestions.*
      `,
      [ids, actions, approvedCategories],
    );

    await client.query(
      `
        INSERT INTO transaction_categorization_training_events (
          user_id,
          transaction_id,
          suggestion_id,
          source,
          suggested_category,
          approved_category,
          action
        )
        SELECT
          $1,
          updates.transaction_id,
          updates.suggestion_id,
          updates.source,
          updates.suggested_category,
          updates.approved_category,
          updates.action
        FROM UNNEST(
          $2::bigint[], $3::bigint[], $4::text[], $5::text[], $6::text[], $7::text[]
        ) AS updates(
          transaction_id, suggestion_id, source, suggested_category, approved_category, action
        )
      `,
      [
        userId,
        transactionIds,
        ids,
        assignedSources,
        suggestedCategories,
        approvedCategories,
        actions,
      ],
    );

    const approved = updatedSuggestions.rows;

    await client.query(
      `
        UPDATE transaction_categorization_batches batches
        SET
          status = CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM transaction_categorization_suggestions suggestions
              WHERE suggestions.batch_id = batches.id
                AND suggestions.status = 'pending'
            ) THEN 'approved'
            ELSE 'partial'
          END,
          updated_at = NOW()
        WHERE batches.id IN (
          SELECT DISTINCT batch_id
          FROM transaction_categorization_suggestions
          WHERE id = ANY($1::bigint[])
        )
      `,
      [suggestionIds],
    );

    await client.query('COMMIT');
    return approved;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const dismissSuggestionForUser = async ({ suggestionId, userId }) => {
  const { rows } = await db.query(
    `
      UPDATE transaction_categorization_suggestions suggestions
      SET status = 'dismissed', updated_at = NOW()
      FROM transaction_categorization_batches batches
      WHERE
        suggestions.id = $1
        AND suggestions.batch_id = batches.id
        AND batches.user_id = $2
        AND suggestions.status = 'pending'
      RETURNING suggestions.*
    `,
    [suggestionId, userId],
  );

  return rows[0] || null;
};

const findCategorizationPatterns = async ({ userIds = [], adminOnly = false }) => {
  const params = [];
  const filters = [
    'transactions.manual_category IS NOT NULL',
    "TRIM(transactions.manual_category) <> ''",
    'transactions.pending = FALSE',
  ];

  if (adminOnly) {
    filters.push("users.account_type = 'admin'");
  } else {
    params.push(userIds);
    filters.push(`accounts.user_id = ANY($${params.length}::bigint[])`);
  }

  const { rows } = await db.query(
    `
      SELECT
        LOWER(TRIM(COALESCE(transactions.category, ''))) AS original_category_key,
        LOWER(TRIM(
          REGEXP_REPLACE(
            REGEXP_REPLACE(
              COALESCE(transactions.merchant_name, transactions.name, ''),
              '\\s+(WEB ID|ID|#)[:#]?\\s*[A-Z0-9-]+.*$',
              '',
              'i'
            ),
            '\\s+[0-9]{2,}$',
            '',
            'g'
          )
        )) AS vendor_name_key,
        transactions.manual_category,
        COUNT(*)::int AS match_count,
        AVG(ABS(transactions.amount)) AS average_amount
      FROM transactions
      INNER JOIN accounts
        ON accounts.id = transactions.account_id
      INNER JOIN users
        ON users.id = accounts.user_id
      WHERE ${filters.join('\n        AND ')}
      GROUP BY original_category_key, vendor_name_key, transactions.manual_category
      HAVING COUNT(*) >= 1
    `,
    params,
  );

  return rows;
};

module.exports = {
  approveSuggestionsForUser,
  createBatchWithSuggestions,
  dismissSuggestionForUser,
  findBatchForUser,
  findCategorizationPatterns,
  findSuggestionsByBatchForUser,
  findSuggestionsByIdsForUser,
};
