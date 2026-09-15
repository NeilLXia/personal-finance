'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildCreditCardRewardOptimization,
  buildNewCardRecommendations,
  getOwnedCardTypes,
} = require('../src/services/creditCardRewardOptimizer');

const cardType = ({ id, name, annualFee = 0, rewards }) => ({
  id,
  name,
  annual_fee: annualFee,
  earning_rewards: rewards,
});

const account = ({ id, cardTypeId }) => ({
  id,
  name: `Account ${id}`,
  mask: `${id}${id}${id}${id}`,
  institution_name: 'Test Bank',
  official_name: null,
  credit_card_type_id: cardTypeId,
});

const transaction = ({
  id,
  accountId,
  amount,
  merchantName,
  displayCategory,
  accountType = 'credit',
  accountSubtype = 'credit card',
}) => ({
  id,
  account_id: accountId,
  amount,
  date: '2026-08-10',
  manual_date: null,
  name: merchantName,
  merchant_name: merchantName,
  category: displayCategory,
  manual_category: null,
  display_category: displayCategory,
  account_name: `Account ${accountId}`,
  account_mask: `${accountId}${accountId}${accountId}${accountId}`,
  account_type: accountType,
  account_subtype: accountSubtype,
  institution_name: 'Test Bank',
  is_expense: true,
});

test('buildCreditCardRewardOptimization: ranks owned-card usage changes across the provided period', () => {
  const ownedFlatCard = cardType({
    id: 1,
    name: 'Flat Card',
    rewards: [{ id: 1, category: 'Base rate', reward_percent: 1, keywords: null }],
  });
  const ownedDiningCard = cardType({
    id: 2,
    name: 'Dining Card',
    rewards: [
      { id: 2, category: 'Dining', reward_percent: 4, keywords: null },
      { id: 3, category: 'Base rate', reward_percent: 1, keywords: null },
    ],
  });

  const result = buildCreditCardRewardOptimization({
    accounts: [
      account({ id: 10, cardTypeId: 1 }),
      account({ id: 11, cardTypeId: 2 }),
    ],
    cardTypes: [ownedFlatCard, ownedDiningCard],
    transactions: [
      transaction({
        id: 100,
        accountId: 10,
        amount: 100,
        merchantName: 'Cafe',
        displayCategory: 'Dining',
      }),
    ],
    periodStart: '2025-09-01',
    periodEnd: '2026-08-31',
  });

  assert.equal(result.period_start, '2025-09-01');
  assert.equal(result.period_end, '2026-08-31');
  assert.equal(result.actual_reward_value, 1);
  assert.equal(result.optimized_reward_value, 4);
  assert.equal(result.missed_reward_value, 3);
  assert.equal(result.recommendation_groups[0].group_label, 'Dining');
  assert.equal(result.recommendation_groups[0].recommended_card_name, 'Dining Card');
});

test('buildCreditCardRewardOptimization: orders recommendations by missed reward value', () => {
  const ownedFlatCard = cardType({
    id: 1,
    name: 'Flat Card',
    rewards: [{ id: 1, category: 'Base rate', reward_percent: 1, keywords: null }],
  });
  const ownedDiningCard = cardType({
    id: 2,
    name: 'Dining Card',
    rewards: [
      { id: 2, category: 'Dining', reward_percent: 4, keywords: null },
      { id: 3, category: 'Base rate', reward_percent: 1, keywords: null },
    ],
  });
  const ownedGroceryCard = cardType({
    id: 3,
    name: 'Grocery Card',
    rewards: [
      { id: 4, category: 'Groceries', reward_percent: 5, keywords: null },
      { id: 5, category: 'Base rate', reward_percent: 1, keywords: null },
    ],
  });

  const result = buildCreditCardRewardOptimization({
    accounts: [
      account({ id: 10, cardTypeId: 1 }),
      account({ id: 11, cardTypeId: 2 }),
      account({ id: 12, cardTypeId: 3 }),
    ],
    cardTypes: [ownedFlatCard, ownedDiningCard, ownedGroceryCard],
    transactions: [
      transaction({
        id: 100,
        accountId: 10,
        amount: 100,
        merchantName: 'Cafe',
        displayCategory: 'Dining',
      }),
      transaction({
        id: 101,
        accountId: 10,
        amount: 200,
        merchantName: 'Market',
        displayCategory: 'Groceries',
      }),
      transaction({
        id: 102,
        accountId: 10,
        amount: 20,
        merchantName: 'Bistro',
        displayCategory: 'Dining',
      }),
    ],
    periodStart: '2025-09-01',
    periodEnd: '2026-08-31',
  });

  const categoryGroups = result.recommendation_groups.filter(
    (group) => group.group_type === 'category',
  );

  assert.equal(categoryGroups[0].group_label, 'Groceries');
  assert.equal(categoryGroups[0].missed_reward_value, 8);
  assert.equal(categoryGroups[1].group_label, 'Dining');
  assert.equal(categoryGroups[1].missed_reward_value, 3.6);
});

test('buildNewCardRecommendations: returns annual net value and category current-vs-expected breakdown', () => {
  const ownedFlatCard = cardType({
    id: 1,
    name: 'Flat Card',
    rewards: [{ id: 1, category: 'Base rate', reward_percent: 1, keywords: null }],
  });
  const groceryCard = cardType({
    id: 2,
    name: 'Grocery Card',
    annualFee: 50,
    rewards: [
      { id: 2, category: 'Groceries', reward_percent: 6, keywords: null },
      { id: 3, category: 'Base rate', reward_percent: 1, keywords: null },
    ],
  });

  const result = buildNewCardRecommendations({
    ownedCardTypes: getOwnedCardTypes({
      accounts: [account({ id: 10, cardTypeId: 1 })],
      cardTypes: [ownedFlatCard, groceryCard],
    }),
    candidateCardTypes: [ownedFlatCard, groceryCard],
    transactions: [
      transaction({
        id: 100,
        accountId: 10,
        amount: 2000,
        merchantName: 'Market',
        displayCategory: 'Groceries',
      }),
      transaction({
        id: 101,
        accountId: 10,
        amount: 500,
        merchantName: 'Cafe',
        displayCategory: 'Dining',
      }),
    ],
    periodStart: '2025-09-01',
    periodEnd: '2026-08-31',
  });

  assert.equal(result.period_start, '2025-09-01');
  assert.equal(result.period_end, '2026-08-31');
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].total_spend, 2000);
  assert.equal(result.recommendations[0].additional_reward_value, 100);
  assert.equal(result.recommendations[0].net_annual_value, 50);
  assert.deepEqual(result.recommendations[0].category_breakdown, [
    {
      category: 'Groceries',
      candidate_reward_category: 'Groceries',
      candidate_reward_percent: 6,
      total_spend: 2000,
      current_reward_value: 20,
      expected_reward_value: 120,
      additional_reward_value: 100,
      transaction_count: 1,
    },
  ]);
});

test('buildNewCardRecommendations: excludes non-credit-card spend from card recommendation totals', () => {
  const ownedFlatCard = cardType({
    id: 1,
    name: 'Flat Card',
    rewards: [{ id: 1, category: 'Base rate', reward_percent: 1, keywords: null }],
  });
  const groceryCard = cardType({
    id: 2,
    name: 'Grocery Card',
    rewards: [
      { id: 2, category: 'Groceries', reward_percent: 6, keywords: null },
      { id: 3, category: 'Base rate', reward_percent: 1, keywords: null },
    ],
  });

  const result = buildNewCardRecommendations({
    ownedCardTypes: getOwnedCardTypes({
      accounts: [account({ id: 10, cardTypeId: 1 })],
      cardTypes: [ownedFlatCard, groceryCard],
    }),
    candidateCardTypes: [ownedFlatCard, groceryCard],
    transactions: [
      transaction({
        id: 100,
        accountId: 10,
        amount: 1000,
        merchantName: 'Market',
        displayCategory: 'Groceries',
      }),
      transaction({
        id: 101,
        accountId: 20,
        amount: 100000,
        merchantName: 'Checking Market',
        displayCategory: 'Groceries',
        accountType: 'depository',
        accountSubtype: 'checking',
      }),
    ],
    periodStart: '2025-09-01',
    periodEnd: '2026-08-31',
  });

  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].total_spend, 1000);
  assert.equal(result.recommendations[0].additional_reward_value, 50);
  assert.equal(result.recommendations[0].category_breakdown[0].total_spend, 1000);
});

test('buildNewCardRecommendations: returns the top three cards by net annual value', () => {
  const ownedFlatCard = cardType({
    id: 1,
    name: 'Flat Card',
    rewards: [{ id: 1, category: 'Base rate', reward_percent: 1, keywords: null }],
  });
  const candidateCards = [2, 3, 4, 5].map((id) =>
    cardType({
      id,
      name: `Candidate ${id}`,
      rewards: [
        {
          id: id + 10,
          category: 'Groceries',
          reward_percent: id,
          keywords: null,
        },
      ],
    }),
  );

  const result = buildNewCardRecommendations({
    ownedCardTypes: getOwnedCardTypes({
      accounts: [account({ id: 10, cardTypeId: 1 })],
      cardTypes: [ownedFlatCard, ...candidateCards],
    }),
    candidateCardTypes: [ownedFlatCard, ...candidateCards],
    transactions: [
      transaction({
        id: 100,
        accountId: 10,
        amount: 1000,
        merchantName: 'Market',
        displayCategory: 'Groceries',
      }),
    ],
    periodStart: '2025-09-01',
    periodEnd: '2026-08-31',
  });

  assert.deepEqual(
    result.recommendations.map((recommendation) => recommendation.card_type_name),
    ['Candidate 5', 'Candidate 4', 'Candidate 3'],
  );
});
