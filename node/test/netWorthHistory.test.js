'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildNetWorthHistory,
} = require('../src/services/dashboard/netWorthHistory');

const accountSnapshot = ({ id, date, balance, type = 'depository' }) => ({
  id,
  name: `Account ${id}`,
  balance_date: date,
  balance,
  type,
  subtype: null,
});

test('buildNetWorthHistory: balance_change excludes accounts added in the current month', () => {
  const history = buildNetWorthHistory({
    netWorthHistoryDates: ['2026-01-31', '2026-02-28'],
    accountSnapshotsByDate: {
      '2026-01-31': [
        accountSnapshot({ id: 1, date: '2026-01-31', balance: 1000 }),
      ],
      '2026-02-28': [
        accountSnapshot({ id: 1, date: '2026-02-28', balance: 1100 }),
        accountSnapshot({ id: 2, date: '2026-02-28', balance: 5000 }),
      ],
    },
    propertyHistoryByDate: {},
  });

  assert.equal(history[1].total, 6100);
  assert.equal(history[1].balance_change, 100);
  assert.deepEqual(history[1].balance_changes, {
    cash: 100,
    personal_equity: 0,
    tax_advantaged: 0,
    real_estate: 0,
    other_assets: 0,
  });
});

test('buildNetWorthHistory: balance_change ignores accounts missing in the current month', () => {
  const history = buildNetWorthHistory({
    netWorthHistoryDates: ['2026-01-31', '2026-02-28'],
    accountSnapshotsByDate: {
      '2026-01-31': [
        accountSnapshot({ id: 1, date: '2026-01-31', balance: 1000 }),
        accountSnapshot({ id: 2, date: '2026-01-31', balance: 5000 }),
      ],
      '2026-02-28': [
        accountSnapshot({ id: 1, date: '2026-02-28', balance: 1100 }),
      ],
    },
    propertyHistoryByDate: {},
  });

  assert.equal(history[1].total, 6100);
  assert.equal(history[1].balance_change, 100);
  assert.deepEqual(history[1].balance_changes, {
    cash: 100,
    personal_equity: 0,
    tax_advantaged: 0,
    real_estate: 0,
    other_assets: 0,
  });
});

test('buildNetWorthHistory: balance_change ignores accounts with a missing previous balance', () => {
  const history = buildNetWorthHistory({
    netWorthHistoryDates: ['2026-08-31', '2026-09-30'],
    accountSnapshotsByDate: {
      '2026-08-31': [
        accountSnapshot({ id: 1, date: '2026-08-31', balance: 1000 }),
        accountSnapshot({ id: 2, date: '2026-08-31', balance: null }),
      ],
      '2026-09-30': [
        accountSnapshot({ id: 1, date: '2026-09-30', balance: 1100 }),
        accountSnapshot({ id: 2, date: '2026-09-30', balance: 5000 }),
      ],
    },
    propertyHistoryByDate: {},
  });

  assert.equal(history[0].total, 1000);
  assert.equal(history[1].total, 6100);
  assert.equal(history[1].balance_change, 100);
  assert.deepEqual(history[1].balance_changes, {
    cash: 100,
    personal_equity: 0,
    tax_advantaged: 0,
    real_estate: 0,
    other_assets: 0,
  });
});
