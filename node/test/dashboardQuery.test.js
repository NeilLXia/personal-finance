'use strict';

// Pure unit tests for the dashboard query parsers (no server, no service layer).

require('dotenv').config({ quiet: true });

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseDashboardQuery,
  parseTransactionQuery,
} = require('../src/routes/dashboard.params');

const dash = (query) => parseDashboardQuery({ query });
const txn = (query) => parseTransactionQuery({ query });

const expectStatus = (fn, status, messageMatch) => {
  try {
    fn();
    assert.fail('expected a validation error to be thrown');
  } catch (error) {
    assert.equal(error.status, status);
    if (messageMatch) assert.match(error.message, messageMatch);
  }
};

test('valid: month + trailing range', () => {
  const result = dash({
    month: '2026-03',
    transaction_range: '3',
    income_allocation_range: '12',
  });
  assert.equal(result.month, '2026-03');
  assert.equal(result.transactionRange, '3');
  assert.equal(result.incomeAllocationRange, '12');
  assert.equal(result.transactionStartDate, undefined);
});

test('valid: custom range with both dates', () => {
  const result = dash({
    transaction_range: 'custom',
    transaction_start_date: '2026-01-01',
    transaction_end_date: '2026-01-31',
  });
  assert.equal(result.transactionStartDate, '2026-01-01');
  assert.equal(result.transactionEndDate, '2026-01-31');
});

test('reject: custom range missing an end date', () => {
  expectStatus(
    () => dash({ transaction_range: 'custom', transaction_start_date: '2026-01-01' }),
    400,
    /both required when transaction_range=custom/,
  );
});

test('reject: dates supplied without range=custom', () => {
  expectStatus(
    () =>
      dash({
        transaction_range: '3',
        transaction_start_date: '2026-01-01',
        transaction_end_date: '2026-01-31',
      }),
    400,
    /only allowed when transaction_range=custom/,
  );
});

test('reject: start date after end date', () => {
  expectStatus(
    () =>
      dash({
        transaction_range: 'custom',
        transaction_start_date: '2026-02-01',
        transaction_end_date: '2026-01-01',
      }),
    400,
    /on or before/,
  );
});

test('reject: unknown query parameter (typo)', () => {
  expectStatus(
    () => dash({ transaction_rang: '3' }),
    400,
    /Unknown query parameter\(s\): transaction_rang/,
  );
});

test('reject: malformed month', () => {
  expectStatus(() => dash({ month: 'March' }), 400);
});

test('parseTransactionQuery: rejects income_allocation params', () => {
  expectStatus(
    () => txn({ month: '2026-03', income_allocation_range: '12' }),
    400,
    /income_allocation_range/,
  );
});

test('parseTransactionQuery: valid, no income-allocation keys in output', () => {
  const result = txn({ month: '2026-03', transaction_range: '1' });
  assert.equal(result.month, '2026-03');
  assert.equal(result.transactionRange, '1');
  assert.ok(!('incomeAllocationRange' in result));
});

test('empty query is valid (all fields optional)', () => {
  const result = dash({});
  assert.deepEqual(result, {
    month: undefined,
    incomeAllocationRange: undefined,
    incomeAllocationStartDate: undefined,
    incomeAllocationEndDate: undefined,
    transactionRange: undefined,
    transactionStartDate: undefined,
    transactionEndDate: undefined,
  });
});
