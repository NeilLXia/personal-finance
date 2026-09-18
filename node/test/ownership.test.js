'use strict';

// Cross-user ownership isolation at the model layer: user 1 must never be able
// to read or mutate an entity owned by user 2 by passing its id.
//
// Requires a reachable database (the same one `npm start` uses). Run: npm test

require('dotenv').config({ quiet: true });

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { resolveDatabaseSecret } = require('../src/config/databaseSecret');

// Populated in before(): db/connection builds its pool from process.env at
// require time, so the Secrets Manager credentials must land first.
let db;
let models;

const stamp = `own-${Date.now()}`;
let u1;
let u2;
const owned = {};

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

  u1 = await mkUser('u1');
  u2 = await mkUser('u2');

  // --- entities owned by u2 -------------------------------------------------
  const item = (
    await db.query(
      `INSERT INTO plaid_items (user_id, plaid_item_id, access_token, plaid_environment)
       VALUES ($1, $2, 'test-token', 'sandbox') RETURNING *`,
      [u2.id, `${stamp}-item`],
    )
  ).rows[0];
  owned.plaidItemId = item.plaid_item_id;

  const account = (
    await db.query(
      `INSERT INTO accounts (user_id, plaid_account_id, plaid_item_id, name)
       VALUES ($1, $2, $3, 'Checking') RETURNING *`,
      [u2.id, `${stamp}-acct`, item.plaid_item_id],
    )
  ).rows[0];

  const txn = (
    await db.query(
      `INSERT INTO transactions (account_id, plaid_transaction_id, amount, name, date, pending)
       VALUES ($1, $2, 12.34, 'Coffee', CURRENT_DATE, false) RETURNING *`,
      [account.id, `${stamp}-txn`],
    )
  ).rows[0];
  owned.transactionId = txn.id;
  owned.plaidTransactionId = txn.plaid_transaction_id;

  const property = (
    await db.query(
      `INSERT INTO properties (user_id, address) VALUES ($1, $2) RETURNING *`,
      [u2.id, `${stamp} 123 Main St`],
    )
  ).rows[0];
  owned.propertyId = property.id;
  await db.query(
    `INSERT INTO property_value_history (property_id, valuation_month, estimated_value, loan_balance)
     VALUES ($1, DATE_TRUNC('month', CURRENT_DATE)::date, 500000, 250000)`,
    [property.id],
  );

  owned.budgetTargetId = (
    await db.query(
      `INSERT INTO budget_targets (user_id, category, category_key)
       VALUES ($1, 'Housing', 'housing') RETURNING *`,
      [u2.id],
    )
  ).rows[0].id;

  owned.ruleId = (
    await db.query(
      `INSERT INTO transaction_category_rules
         (user_id, original_category, original_category_key, vendor_name, vendor_name_key, match_type, manual_category)
       VALUES ($1, 'Food', 'food', 'Cafe', 'cafe', 'contains', 'Dining') RETURNING *`,
      [u2.id],
    )
  ).rows[0].id;

  owned.uploadId = (
    await db.query(
      `INSERT INTO payslip_uploads (user_id, original_filename, page_count)
       VALUES ($1, 'stub.pdf', 1) RETURNING *`,
      [u2.id],
    )
  ).rows[0].id;
});

after(async () => {
  if (!db) return; // before() failed before the connection was loaded
  if (u1) await db.query('DELETE FROM users WHERE id = $1', [u1.id]);
  if (u2) await db.query('DELETE FROM users WHERE id = $1', [u2.id]);
  await db.closePool();
});

const rowExists = async (table, id) => {
  const { rows } = await db.query(
    `SELECT 1 FROM ${table} WHERE id = $1`,
    [id],
  );
  return rows.length === 1;
};

test('transactions.findByIdForUserId — foreign user gets nothing', async () => {
  assert.equal(
    await models.transactions.findByIdForUserId({
      id: owned.transactionId,
      userId: u1.id,
    }),
    null,
  );
  assert.ok(
    await models.transactions.findByIdForUserId({
      id: owned.transactionId,
      userId: u2.id,
    }),
  );
});

test('transactions.updateManualCategoryForUserId — foreign user cannot mutate', async () => {
  await models.transactions.updateManualCategoryForUserId({
    id: owned.transactionId,
    userId: u1.id,
    manualCategory: 'Hacked',
  });
  const { rows } = await db.query(
    'SELECT manual_category FROM transactions WHERE id = $1',
    [owned.transactionId],
  );
  assert.notEqual(rows[0].manual_category, 'Hacked');
});

test('transactions.updateManualDateForUserId — foreign user cannot mutate', async () => {
  await models.transactions.updateManualDateForUserId({
    id: owned.transactionId,
    userId: u1.id,
    manualDate: '1999-01-01',
  });
  const { rows } = await db.query(
    'SELECT manual_date FROM transactions WHERE id = $1',
    [owned.transactionId],
  );
  assert.equal(rows[0].manual_date, null);
});

test('transactions.deleteByPlaidTransactionIdsForUserId — foreign user deletes nothing', async () => {
  const deleted = await models.transactions.deleteByPlaidTransactionIdsForUserId({
    plaidTransactionIds: [owned.plaidTransactionId],
    userId: u1.id,
  });
  assert.deepEqual(deleted, []);
  assert.ok(await rowExists('transactions', owned.transactionId));
});

test('properties.findByIdForUser — foreign user gets nothing', async () => {
  assert.equal(
    await models.properties.findByIdForUser({
      id: owned.propertyId,
      userId: u1.id,
    }),
    null,
  );
  assert.ok(
    await models.properties.findByIdForUser({
      id: owned.propertyId,
      userId: u2.id,
    }),
  );
});

test('properties.hasMonthlyValuation — scoped to owner', async () => {
  assert.equal(
    await models.properties.hasMonthlyValuation({
      propertyId: owned.propertyId,
      userId: u1.id,
    }),
    false,
  );
  assert.equal(
    await models.properties.hasMonthlyValuation({
      propertyId: owned.propertyId,
      userId: u2.id,
    }),
    true,
  );
});

test('properties.updateMonthlyLoanBalance — foreign user cannot mutate', async () => {
  const result = await models.properties.updateMonthlyLoanBalance({
    propertyId: owned.propertyId,
    userId: u1.id,
    loanBalance: 1,
  });
  assert.equal(result, null);
  const { rows } = await db.query(
    `SELECT loan_balance FROM property_value_history
     WHERE property_id = $1 AND valuation_month = DATE_TRUNC('month', CURRENT_DATE)::date`,
    [owned.propertyId],
  );
  assert.equal(Number(rows[0].loan_balance), 250000);
});

test('properties.createMonthlyValuation — foreign user cannot insert', async () => {
  const result = await models.properties.createMonthlyValuation({
    propertyId: owned.propertyId,
    userId: u1.id,
    valuationMonth: '2099-01-01',
    estimatedValue: 1,
    priceRangeLow: 1,
    priceRangeHigh: 1,
    loanBalance: 1,
    rawResponse: {},
  });
  assert.equal(result, null);
  const { rows } = await db.query(
    `SELECT 1 FROM property_value_history
     WHERE property_id = $1 AND valuation_month = '2099-01-01'`,
    [owned.propertyId],
  );
  assert.equal(rows.length, 0);
});

test('budgetTargets.deleteByIdForUserId — foreign user deletes nothing', async () => {
  await models.budgetTargets.deleteByIdForUserId({
    id: owned.budgetTargetId,
    userId: u1.id,
  });
  assert.ok(await rowExists('budget_targets', owned.budgetTargetId));
});

test('transactionCategoryRules.deleteByIdForUserId — foreign user deletes nothing', async () => {
  await models.transactionCategoryRules.deleteByIdForUserId({
    id: owned.ruleId,
    userId: u1.id,
  });
  assert.ok(await rowExists('transaction_category_rules', owned.ruleId));
});

test('transactionCategoryRules.updateByIdForUserId — foreign user cannot mutate', async () => {
  const result = await models.transactionCategoryRules.updateByIdForUserId({
    id: owned.ruleId,
    userId: u1.id,
    originalCategory: 'x',
    originalCategoryKey: 'x',
    vendorName: 'x',
    vendorNameKey: 'x',
    matchType: 'contains',
    manualCategory: 'Hacked',
  });
  assert.equal(result, null);
  const { rows } = await db.query(
    'SELECT manual_category FROM transaction_category_rules WHERE id = $1',
    [owned.ruleId],
  );
  assert.equal(rows[0].manual_category, 'Dining');
});

test('payslips.updateUploadCounts — foreign user cannot mutate', async () => {
  const result = await models.payslips.updateUploadCounts({
    id: owned.uploadId,
    userId: u1.id,
    importedCount: 99,
    skippedCount: 99,
  });
  assert.equal(result, undefined);
  const { rows } = await db.query(
    'SELECT imported_count FROM payslip_uploads WHERE id = $1',
    [owned.uploadId],
  );
  assert.equal(rows[0].imported_count, 0);
});

test('plaidItems.deleteByPlaidItemIdForUser — foreign user deletes nothing', async () => {
  await models.plaidItems.deleteByPlaidItemIdForUser({
    plaidItemId: owned.plaidItemId,
    userId: u1.id,
  });
  const { rows } = await db.query(
    'SELECT 1 FROM plaid_items WHERE plaid_item_id = $1',
    [owned.plaidItemId],
  );
  assert.equal(rows.length, 1);
});
