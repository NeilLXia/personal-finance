'use strict';

// Exercises approveSuggestionsForUser against a real database: it was
// previously only ever invoked through a mocked service-layer test, so its
// batched SQL (UPDATE ... FROM UNNEST(...)) had zero real-engine coverage.
//
// Requires a reachable database (the same one `npm start` uses). Run: npm test

require('dotenv').config({ quiet: true });

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { resolveDatabaseSecret } = require('../src/config/databaseSecret');

let db;
let models;

const stamp = `catsuggest-${Date.now()}`;
let owner;
let foreignUser;
let batch;
let suggestionA;
let suggestionB;
let foreignSuggestion;

before(async () => {
  await resolveDatabaseSecret();
  db = require('../src/db/connection');
  models = require('../src/models');

  const mkUser = async (tag) => {
    const { rows } = await db.query(
      `INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *`,
      [`${stamp}-${tag}@test.local`, `Test ${tag}`],
    );
    return rows[0];
  };

  const mkAccountForUser = async (user, tag) => {
    const item = (
      await db.query(
        `INSERT INTO plaid_items (user_id, plaid_item_id, access_token, plaid_environment)
         VALUES ($1, $2, 'test-token', 'sandbox') RETURNING *`,
        [user.id, `${stamp}-${tag}-item`],
      )
    ).rows[0];

    return (
      await db.query(
        `INSERT INTO accounts (user_id, plaid_account_id, plaid_item_id, name)
         VALUES ($1, $2, $3, 'Checking') RETURNING *`,
        [user.id, `${stamp}-${tag}-acct`, item.plaid_item_id],
      )
    ).rows[0];
  };

  const mkTransaction = async (account, tag, amount) =>
    (
      await db.query(
        `INSERT INTO transactions (account_id, plaid_transaction_id, amount, name, date, pending)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, false) RETURNING *`,
        [account.id, `${stamp}-${tag}`, amount, tag],
      )
    ).rows[0];

  const mkSuggestion = async ({
    batchId,
    transactionId,
    suggestedCategory,
    assignedSource = 'plaid_default',
  }) =>
    (
      await db.query(
        `INSERT INTO transaction_categorization_suggestions (
           batch_id, transaction_id, assigned_category, assigned_source,
           suggested_category, confidence, status
         )
         VALUES ($1, $2, $3, $4, $5, 0.5, 'pending')
         RETURNING *`,
        [batchId, transactionId, suggestedCategory, assignedSource, suggestedCategory],
      )
    ).rows[0];

  owner = await mkUser('owner');
  foreignUser = await mkUser('foreign');

  const ownerAccount = await mkAccountForUser(owner, 'owner');
  const foreignAccount = await mkAccountForUser(foreignUser, 'foreign');

  const txnA = await mkTransaction(ownerAccount, 'txn-a', 12);
  const txnB = await mkTransaction(ownerAccount, 'txn-b', 34);
  const foreignTxn = await mkTransaction(foreignAccount, 'txn-foreign', 56);

  batch = (
    await db.query(
      `INSERT INTO transaction_categorization_batches (user_id, month, scope, status, model_version)
       VALUES ($1, '2026-08', 'user_only', 'pending', 'test-model') RETURNING *`,
      [owner.id],
    )
  ).rows[0];

  const foreignBatch = (
    await db.query(
      `INSERT INTO transaction_categorization_batches (user_id, month, scope, status, model_version)
       VALUES ($1, '2026-08', 'user_only', 'pending', 'test-model') RETURNING *`,
      [foreignUser.id],
    )
  ).rows[0];

  suggestionA = await mkSuggestion({
    batchId: batch.id,
    transactionId: txnA.id,
    suggestedCategory: 'Dining',
    assignedSource: 'rule',
  });
  suggestionB = await mkSuggestion({
    batchId: batch.id,
    transactionId: txnB.id,
    suggestedCategory: 'Groceries',
  });
  foreignSuggestion = await mkSuggestion({
    batchId: foreignBatch.id,
    transactionId: foreignTxn.id,
    suggestedCategory: 'Shopping',
  });
});

after(async () => {
  if (!db) return;
  if (owner) await db.query('DELETE FROM users WHERE id = $1', [owner.id]);
  if (foreignUser) await db.query('DELETE FROM users WHERE id = $1', [foreignUser.id]);
  await db.closePool();
});

test('approveSuggestionsForUser batches transaction/suggestion updates and logs training events', async () => {
  const approved = await models.categorizationSuggestions.approveSuggestionsForUser({
    suggestionIds: [suggestionA.id, suggestionB.id],
    userId: owner.id,
    categoryBySuggestionId: new Map([[Number(suggestionB.id), 'Travel']]),
  });

  assert.equal(approved.length, 2);

  const { rows: transactionRows } = await db.query(
    `SELECT id, manual_category FROM transactions WHERE id = ANY($1::bigint[]) ORDER BY id`,
    [[suggestionA.transaction_id, suggestionB.transaction_id]],
  );
  assert.equal(transactionRows[0].manual_category, 'Dining');
  assert.equal(transactionRows[1].manual_category, 'Travel');

  const { rows: suggestionRows } = await db.query(
    `SELECT id, status, approved_category, approved_at FROM transaction_categorization_suggestions
     WHERE id = ANY($1::bigint[]) ORDER BY id`,
    [[suggestionA.id, suggestionB.id]],
  );
  assert.equal(suggestionRows[0].status, 'approved');
  assert.equal(suggestionRows[0].approved_category, 'Dining');
  assert.ok(suggestionRows[0].approved_at);
  assert.equal(suggestionRows[1].status, 'edited');
  assert.equal(suggestionRows[1].approved_category, 'Travel');

  const { rows: trainingRows } = await db.query(
    `SELECT transaction_id, suggestion_id, source, suggested_category, approved_category, action
     FROM transaction_categorization_training_events
     WHERE suggestion_id = ANY($1::bigint[]) ORDER BY suggestion_id`,
    [[suggestionA.id, suggestionB.id]],
  );
  assert.deepEqual(trainingRows, [
    {
      transaction_id: suggestionA.transaction_id,
      suggestion_id: suggestionA.id,
      source: 'rule',
      suggested_category: 'Dining',
      approved_category: 'Dining',
      action: 'approved',
    },
    {
      transaction_id: suggestionB.transaction_id,
      suggestion_id: suggestionB.id,
      source: 'plaid_default',
      suggested_category: 'Groceries',
      approved_category: 'Travel',
      action: 'edited',
    },
  ]);

  const { rows: batchRows } = await db.query(
    `SELECT status FROM transaction_categorization_batches WHERE id = $1`,
    [batch.id],
  );
  assert.equal(batchRows[0].status, 'approved');
});

test('approveSuggestionsForUser ignores suggestions owned by another user', async () => {
  const approved = await models.categorizationSuggestions.approveSuggestionsForUser({
    suggestionIds: [foreignSuggestion.id],
    userId: owner.id,
    categoryBySuggestionId: new Map(),
  });

  assert.equal(approved.length, 0);

  const { rows } = await db.query(
    `SELECT status FROM transaction_categorization_suggestions WHERE id = $1`,
    [foreignSuggestion.id],
  );
  assert.equal(rows[0].status, 'pending');
});
