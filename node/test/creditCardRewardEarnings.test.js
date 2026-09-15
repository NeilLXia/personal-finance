'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  computeEarningRewardBreakdown,
  computeEarningRewardTotals,
} = require('../src/services/creditCardRewardEarnings');

const transaction = ({
  id,
  amount,
  name = '',
  merchantName = '',
  category = null,
  displayCategory = 'Uncategorized',
}) => ({
  id,
  amount,
  name,
  merchant_name: merchantName,
  category,
  display_category: displayCategory,
});

test('computeEarningRewardTotals: a custom keyword category claims matching transactions before manual categories or the base rate', () => {
  const earningRewards = [
    { id: 1, category: 'Base rate', reward_percent: 1, keywords: null },
    { id: 2, category: 'Dining', reward_percent: 3, keywords: null },
    {
      id: 3,
      category: 'Coffee shops',
      reward_percent: 5,
      keywords: 'starbucks, blue bottle',
    },
  ];
  const transactions = [
    transaction({ id: 10, amount: 100, name: 'Starbucks #123', displayCategory: 'Dining' }),
    transaction({ id: 11, amount: 50, displayCategory: 'Dining' }),
    transaction({ id: 12, amount: 25, displayCategory: 'Groceries' }),
  ];

  const totals = computeEarningRewardTotals({ earningRewards, transactions });

  assert.deepEqual(
    totals.sort((a, b) => a.earning_reward_id - b.earning_reward_id),
    [
      { earning_reward_id: 1, amount: 0.25 }, // groceries -> base rate: 25 * 1%
      { earning_reward_id: 2, amount: 1.5 }, // remaining dining: 50 * 3%
      { earning_reward_id: 3, amount: 5 }, // starbucks: 100 * 5%
    ],
  );
});

test('computeEarningRewardTotals: ignores non-positive amounts (payments/refunds) and ties reward money to the reward id', () => {
  const earningRewards = [
    { id: 1, category: 'Base rate', reward_percent: 2, keywords: null },
  ];
  const transactions = [
    transaction({ id: 20, amount: 100 }),
    transaction({ id: 21, amount: -100 }),
  ];

  const totals = computeEarningRewardTotals({ earningRewards, transactions });

  assert.deepEqual(totals, [{ earning_reward_id: 1, amount: 2 }]);
});

test('computeEarningRewardTotals: excludes Plaid bank fees from rewards', () => {
  const earningRewards = [
    { id: 1, category: 'Base rate', reward_percent: 2, keywords: null },
  ];
  const transactions = [
    transaction({ id: 20, amount: 100 }),
    transaction({ id: 21, amount: 35, category: 'Bank Fees' }),
  ];

  const totals = computeEarningRewardTotals({ earningRewards, transactions });

  assert.deepEqual(totals, [{ earning_reward_id: 1, amount: 2 }]);
});

test('computeEarningRewardTotals: a transaction matched by an earlier custom category is not double-counted by a later one', () => {
  const earningRewards = [
    { id: 1, category: 'Streaming', reward_percent: 4, keywords: 'netflix' },
    { id: 2, category: 'Entertainment', reward_percent: 6, keywords: 'netflix, hulu' },
  ];
  const transactions = [
    transaction({ id: 30, amount: 20, name: 'NETFLIX.COM' }),
  ];

  const totals = computeEarningRewardTotals({ earningRewards, transactions });

  assert.deepEqual(
    totals.sort((a, b) => a.earning_reward_id - b.earning_reward_id),
    [
      { earning_reward_id: 1, amount: 0.8 },
      { earning_reward_id: 2, amount: 0 },
    ],
  );
});

test('computeEarningRewardBreakdown: returns transactions claimed by each earning reward', () => {
  const earningRewards = [
    { id: 1, category: 'Base rate', reward_percent: 1, keywords: null },
    { id: 2, category: 'Dining', reward_percent: 3, keywords: null },
    {
      id: 3,
      category: 'Coffee shops',
      reward_percent: 5,
      keywords: 'starbucks',
    },
  ];
  const transactions = [
    transaction({ id: 10, amount: 100, name: 'Starbucks #123', displayCategory: 'Dining' }),
    transaction({ id: 11, amount: 50, displayCategory: 'Dining' }),
    transaction({ id: 12, amount: 25, displayCategory: 'Groceries' }),
  ];

  const breakdown = computeEarningRewardBreakdown({
    earningRewards,
    transactions,
  });

  assert.deepEqual(
    breakdown
      .map((rewardBreakdown) => ({
        earning_reward_id: rewardBreakdown.earning_reward_id,
        amount: rewardBreakdown.amount,
        transactionIds: rewardBreakdown.transactions.map(({ id }) => id),
      }))
      .sort((a, b) => a.earning_reward_id - b.earning_reward_id),
    [
      { earning_reward_id: 1, amount: 0.25, transactionIds: [12] },
      { earning_reward_id: 2, amount: 1.5, transactionIds: [11] },
      { earning_reward_id: 3, amount: 5, transactionIds: [10] },
    ],
  );
});
