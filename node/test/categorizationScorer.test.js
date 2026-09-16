'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  scoreTransactionCategorization,
} = require('../src/services/categorization/categorizationScorer');

const transaction = ({
  id = 1,
  amount = 25,
  category = 'Shops',
  name = 'Local Store',
  merchantName = 'Local Store',
  manualCategory = null,
  displayCategory = 'Shops',
} = {}) => ({
  id,
  amount,
  category,
  name,
  merchant_name: merchantName,
  manual_category: manualCategory,
  display_category: displayCategory,
});

const pattern = ({
  originalCategoryKey = 'shops',
  vendorNameKey = 'local store',
  manualCategory = 'Shopping',
  matchCount = 4,
  averageAmount = 25,
} = {}) => ({
  original_category_key: originalCategoryKey,
  vendor_name_key: vendorNameKey,
  manual_category: manualCategory,
  match_count: matchCount,
  average_amount: averageAmount,
});

test('scoreTransactionCategorization uses current user history before starter patterns', () => {
  const result = scoreTransactionCategorization({
    transaction: transaction(),
    userPatterns: [pattern({ manualCategory: 'Shopping' })],
    starterPatterns: [pattern({ manualCategory: 'Groceries', matchCount: 20 })],
  });

  assert.equal(result.suggested_category, 'Shopping');
  assert.equal(result.evidence.suggested_source, 'user_history');
  assert.equal(result.confidence, 0.9);
});

test('scoreTransactionCategorization uses starter patterns when user history is absent', () => {
  const result = scoreTransactionCategorization({
    transaction: transaction(),
    starterPatterns: [pattern({ manualCategory: 'Shopping' })],
  });

  assert.equal(result.suggested_category, 'Shopping');
  assert.equal(result.evidence.suggested_source, 'starter_pattern');
  assert.equal(result.confidence, 0.78);
});

test('scoreTransactionCategorization flags a rule conflict when history strongly disagrees', () => {
  const result = scoreTransactionCategorization({
    transaction: transaction(),
    userRules: [
      {
        original_category: 'Shops',
        original_category_key: 'shops',
        vendor_name: 'Local Store',
        vendor_name_key: 'local store',
        match_type: 'exact',
        manual_category: 'Shopping',
      },
    ],
    userPatterns: [pattern({ manualCategory: 'Groceries' })],
  });

  assert.equal(result.assigned_category, 'Shopping');
  assert.equal(result.assigned_source, 'rule');
  assert.equal(result.suggested_category, 'Groceries');
  assert.equal(result.review_required, true);
  assert.ok(result.review_reasons.includes('rule_conflict'));
});

test('scoreTransactionCategorization flags an amount outlier against the matched vendor history', () => {
  const result = scoreTransactionCategorization({
    transaction: transaction({ amount: 500 }),
    userRules: [
      {
        original_category: 'Shops',
        original_category_key: 'shops',
        vendor_name: 'Local Store',
        vendor_name_key: 'local store',
        match_type: 'exact',
        manual_category: 'Shopping',
      },
    ],
    userPatterns: [
      pattern({ manualCategory: 'Shopping', matchCount: 10, averageAmount: 25 }),
    ],
  });

  assert.equal(result.assigned_source, 'rule');
  assert.ok(result.review_reasons.includes('amount_outlier'));
});

test('scoreTransactionCategorization merges history rows whose raw vendor text differs but normalizes to the same vendor', () => {
  const result = scoreTransactionCategorization({
    transaction: transaction({
      name: 'Amazon.com*112233445',
      merchantName: 'Amazon.com*112233445',
      category: 'Shops',
    }),
    userPatterns: [
      pattern({
        vendorNameKey: 'amazon.com*112233445',
        manualCategory: 'Shopping',
        matchCount: 3,
        averageAmount: 20,
      }),
      pattern({
        vendorNameKey: 'amazon.com*998877665',
        manualCategory: 'Shopping',
        matchCount: 7,
        averageAmount: 40,
      }),
    ],
  });

  assert.equal(result.suggested_category, 'Shopping');
  assert.equal(result.evidence.suggested_source, 'user_history');
  assert.equal(result.evidence.user_vendor_matches, 10);
});

test('scoreTransactionCategorization flags ambiguous vendors even when a rule matches', () => {
  const result = scoreTransactionCategorization({
    transaction: transaction({
      name: 'Amazon Marketplace',
      merchantName: 'Amazon',
    }),
    userRules: [
      {
        original_category: 'Shops',
        original_category_key: 'shops',
        vendor_name: 'Amazon',
        vendor_name_key: 'amazon',
        match_type: 'exact',
        manual_category: 'Shopping',
      },
    ],
  });

  assert.equal(result.assigned_category, 'Shopping');
  assert.equal(result.review_required, true);
  assert.ok(result.review_reasons.includes('ambiguous_vendor'));
});
