'use strict';

// Characterization tests for the split categorization modules
// (transactions/transactionCategory, transactions/cashFlowClassification,
// transactions/categoryRules).

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canonicalizeExpenseCategory,
  normalizeTransactionVendorRuleText,
  summarizeTransactionsByCategory,
} = require('../src/services/transactions/transactionCategory');
const {
  getCashFlowTransactionType,
  getSavingsCashFlowAmount,
} = require('../src/services/transactions/cashFlowClassification');
const {
  normalizeTransactionRuleMatchType,
  isManualCategoryRuleExcluded,
  findTransactionCategoryRule,
  applyTransactionCategoryRules,
} = require('../src/services/transactions/categoryRules');

const checking = { account_type: 'depository', account_subtype: 'checking' };
const brokerage = { account_type: 'investment', account_subtype: 'brokerage' };

test('canonicalizeExpenseCategory maps Restaurants -> Dining', () => {
  assert.equal(canonicalizeExpenseCategory('Food and Drink, Restaurants'), 'Dining');
  assert.equal(canonicalizeExpenseCategory('Restaurants'), 'Dining');
  assert.equal(canonicalizeExpenseCategory('Groceries'), 'Groceries');
});

test('normalizeTransactionVendorRuleText strips trailing ids / web ids', () => {
  assert.equal(
    normalizeTransactionVendorRuleText('ACME CORP WEB ID: 123456'),
    'acme corp',
  );
});

test('getCashFlowTransactionType: spend on a checking account is an expense', () => {
  assert.equal(getCashFlowTransactionType({ ...checking, amount: 12.5 }), 'expenses');
});

test('getCashFlowTransactionType: deposit to checking is income', () => {
  assert.equal(getCashFlowTransactionType({ ...checking, amount: -2000 }), 'income');
});

test('getCashFlowTransactionType: transfers and CC payments have no cash-flow effect', () => {
  assert.equal(
    getCashFlowTransactionType({ ...checking, amount: 500, category: 'Transfer' }),
    null,
  );
  assert.equal(
    getCashFlowTransactionType({
      ...checking,
      amount: 300,
      name: 'CREDIT CARD PAYMENT',
    }),
    null,
  );
});

test('getCashFlowTransactionType: Plaid bank fees have no cash-flow effect', () => {
  assert.equal(
    getCashFlowTransactionType({
      ...checking,
      amount: 35,
      category: 'Bank Fees',
    }),
    null,
  );
  assert.equal(
    getCashFlowTransactionType({
      ...checking,
      amount: 35,
      category: 'Bank Fees, Overdraft Fees',
    }),
    null,
  );
  assert.equal(
    getCashFlowTransactionType({
      account_type: 'credit',
      account_subtype: 'credit card',
      amount: 95,
      category: 'Bank Fees',
      name: 'ANNUAL MEMBERSHIP FEE',
    }),
    null,
  );
});

test('getCashFlowTransactionType: any movement on an equity account is savings', () => {
  assert.equal(getCashFlowTransactionType({ ...brokerage, amount: 250 }), 'savings');
});

test('getSavingsCashFlowAmount: sign depends on account kind', () => {
  // equity account: Plaid-positive (outflow) -> negative savings figure
  assert.equal(getSavingsCashFlowAmount({ ...brokerage, amount: 250 }), -250);
  assert.equal(getSavingsCashFlowAmount({ ...brokerage, amount: -250 }), 250);
  // non-equity account: keeps Plaid sign flipped the usual way
  assert.equal(getSavingsCashFlowAmount({ ...checking, amount: 250 }), 250);
  assert.equal(getSavingsCashFlowAmount({ ...checking, amount: -250 }), -250);
});

test('normalizeTransactionRuleMatchType falls back to "contains"', () => {
  assert.equal(normalizeTransactionRuleMatchType('bogus'), 'contains');
  assert.equal(normalizeTransactionRuleMatchType('exact'), 'exact');
});

test('findTransactionCategoryRule prefers exact over contains', () => {
  const txn = {
    ...checking,
    category: 'Shops',
    name: 'TARGET STORE 123',
    merchant_name: 'Target',
  };
  const rules = [
    { original_category: 'Shops', vendor_name: 'target', match_type: 'contains', manual_category: 'Shopping' },
    { original_category: 'Shops', vendor_name: 'target', match_type: 'exact', manual_category: 'Household' },
  ];
  assert.equal(findTransactionCategoryRule(txn, rules).manual_category, 'Household');
});

test('Amazon transactions can use manual category rules', () => {
  const txn = {
    ...checking,
    category: 'Shops',
    name: 'Amazon Marketplace',
    merchant_name: 'Amazon',
  };
  const rules = [
    {
      original_category: 'Shops',
      vendor_name: 'amazon',
      match_type: 'exact',
      manual_category: 'Shopping',
    },
  ];

  assert.equal(isManualCategoryRuleExcluded(txn), false);
  assert.equal(findTransactionCategoryRule(txn, rules).manual_category, 'Shopping');
});

test('applyTransactionCategoryRules stamps display/cash-flow fields', () => {
  const [row] = applyTransactionCategoryRules(
    [{ ...checking, category: 'Groceries', name: 'SAFEWAY', amount: 40, date: '2026-03-01' }],
    [],
  );
  assert.equal(row.display_category, 'Groceries');
  assert.equal(row.is_expense, true);
  assert.equal(row.cash_flow_type, 'expenses');
});

test('applyTransactionCategoryRules excludes Plaid bank fees even with a manual category', () => {
  const [row] = applyTransactionCategoryRules(
    [
      {
        ...checking,
        category: 'Bank Fees',
        manual_category: 'Utilities',
        name: 'ANNUAL MEMBERSHIP FEE',
        amount: 12,
        date: '2026-03-01',
      },
    ],
    [],
  );

  assert.equal(row.cash_flow_type, null);
  assert.equal(row.is_expense, false);
});

test('summarizeTransactionsByCategory groups and sign-flips amounts', () => {
  const summary = summarizeTransactionsByCategory([
    { display_category: 'Dining', amount: 10 },
    { display_category: 'Dining', amount: 20 },
    { display_category: 'Groceries', amount: 50 },
  ]);
  assert.deepEqual(
    summary.map((c) => [c.category, c.amount, c.count]),
    [
      ['Groceries', -50, 1],
      ['Dining', -30, 2],
    ],
  );
});
