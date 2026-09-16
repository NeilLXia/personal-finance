'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  extractExternalCards,
  normalizeCardName,
  normalizeVectorMintCards,
} = require('../src/services/vectorMint/vectorMintCardMapper');

test('extractExternalCards supports common payload wrappers', () => {
  assert.deepEqual(extractExternalCards([{ name: 'A' }]), [{ name: 'A' }]);
  assert.deepEqual(extractExternalCards({ data: { cards: [{ name: 'B' }] } }), [
    { name: 'B' },
  ]);
});

test('normalizeCardName removes network words for matching', () => {
  assert.equal(
    normalizeCardName('Chase Sapphire Preferred Visa Card'),
    'chase sapphire preferred',
  );
  assert.equal(normalizeCardName('American Express Gold'), 'amex gold');
  assert.equal(normalizeCardName('Amex Gold'), 'amex gold');
});

test('normalizeVectorMintCards maps clean categories and merchant keywords', () => {
  const [card] = normalizeVectorMintCards({
    cards: [
      {
        id: 'vm-card-1',
        name: 'Chase Sapphire Preferred',
        annual_fee: '$95',
        rewards: [
          { category: 'Restaurants', reward_percent: '3%' },
          { category: 'Amazon', multiplier: 5, merchants: ['Amazon'] },
        ],
        perks: [
          { name: 'Hotel credit', value: '$50', frequency: 'annual' },
        ],
      },
    ],
  });

  assert.equal(card.name, 'Chase Sapphire Preferred');
  assert.equal(card.annualFee, 95);
  assert.deepEqual(
    card.earningRewards.map(({ category, rewardPercent, keywords, status }) => ({
      category,
      rewardPercent,
      keywords,
      status,
    })),
    [
      { category: 'Dining', rewardPercent: 3, keywords: null, status: 'included' },
      {
        category: 'Amazon',
        rewardPercent: 5,
        keywords: 'Amazon',
        status: 'needs_review',
      },
    ],
  );
  assert.deepEqual(
    card.perkAwards.map(
      ({ name, dollarValue, frequencyCount, frequencyPeriod, status }) => ({
        name,
        dollarValue,
        frequencyCount,
        frequencyPeriod,
        status,
      }),
    ),
    [
      {
        name: 'Hotel credit',
        dollarValue: 50,
        frequencyCount: 1,
        frequencyPeriod: 'per_year',
        status: 'needs_review',
      },
    ],
  );
});

test('normalizeVectorMintCards maps VectorMint data envelopes and reward rule fields', () => {
  const [card] = normalizeVectorMintCards({
    object: 'list',
    data: [
      {
        id: 'vm-card-1',
        name: 'American Express Gold Card',
        annual_fee: 325,
        reward_rules: [
          { normalized_category: 'Restaurants', earn_rate: 4 },
          {
            merchant_category: 'Chase Travel',
            points_per_dollar: 5,
            merchant: 'Chase Travel',
          },
        ],
        credits: [
          {
            name: 'Dining credit',
            amount_usd: 120,
            reset_period: 'monthly',
            uses_per_period: 1,
          },
        ],
      },
    ],
  });

  assert.equal(card.nameKey, 'amex gold');
  assert.deepEqual(
    card.earningRewards.map(({ category, rewardPercent, keywords, status }) => ({
      category,
      rewardPercent,
      keywords,
      status,
    })),
    [
      { category: 'Dining', rewardPercent: 4, keywords: null, status: 'included' },
      {
        category: 'Chase Travel',
        rewardPercent: 5,
        keywords: 'Chase Travel',
        status: 'needs_review',
      },
    ],
  );
  assert.deepEqual(
    card.perkAwards.map(
      ({ name, dollarValue, frequencyCount, frequencyPeriod, status }) => ({
        name,
        dollarValue,
        frequencyCount,
        frequencyPeriod,
        status,
      }),
    ),
    [
      {
        name: 'Dining credit',
        dollarValue: 120,
        frequencyCount: 1,
        frequencyPeriod: 'per_month',
        status: 'needs_review',
      },
    ],
  );
});

test('normalizeVectorMintCards excludes vague rewards and untrackable perks', () => {
  const [card] = normalizeVectorMintCards({
    cards: [
      {
        name: 'Vague Card',
        rewards: [
          { category: 'Streaming', reward_percent: 3 },
          { category: 'Transit', reward_percent: 3 },
          { category: 'Travel', reward_percent: null },
        ],
        benefits: [
          { name: 'Global Entry credit', value: 100 },
          { name: 'Partner discounts', value: 50 },
          { name: 'Airport lounge access' },
        ],
      },
    ],
  });

  assert.equal(card.earningRewards.length, 3);
  assert.equal(card.perkAwards.length, 3);
  assert.equal(card.excludedBenefits.length, 0);
  assert.deepEqual(
    [...card.earningRewards, ...card.perkAwards].map(
      (benefit) => benefit.statusReason,
    ),
    [
      'Reward category is too vague to map safely.',
      'Reward category is too vague to map safely.',
      'Reward rate is missing or not numeric.',
      'Perk is not cleanly trackable from transactions.',
      'Perk is not cleanly trackable from transactions.',
      'Perk has no stable dollar value.',
    ],
  );
});

test('normalizeVectorMintCards auto-includes gas station and pharmacy rewards as keyword categories', () => {
  const [card] = normalizeVectorMintCards({
    cards: [
      {
        name: 'Fuel Rewards Card',
        rewards: [
          { category: 'U.S. Gas Stations', reward_percent: 4 },
          { category: 'Drug Stores', reward_percent: 3 },
          { name: '2x on Pharmacies and drugstores', reward_percent: 2 },
        ],
      },
    ],
  });

  assert.deepEqual(
    card.earningRewards.map(({ category, rewardPercent, keywords, status, matchStrategy }) => ({
      category,
      rewardPercent,
      keywords,
      status,
      matchStrategy,
    })),
    [
      {
        category: 'Gas Stations',
        rewardPercent: 4,
        keywords: 'Gas Stations',
        status: 'included',
        matchStrategy: 'plaid_category_keyword',
      },
      {
        category: 'Pharmacies',
        rewardPercent: 3,
        keywords: 'Pharmacies',
        status: 'included',
        matchStrategy: 'plaid_category_keyword',
      },
      {
        category: 'Pharmacies (2x on Pharmacies and drugstores)',
        rewardPercent: 2,
        keywords: 'Pharmacies',
        status: 'included',
        matchStrategy: 'plaid_category_keyword',
      },
    ],
  );
});

test('normalizeVectorMintCards creates specific labels and stable fingerprints for travel portal rewards', () => {
  const [card] = normalizeVectorMintCards({
    cards: [
      {
        name: 'American Express Gold',
        reward_rules: [
          {
            id: 'hotels',
            merchant: 'Amex Travel',
            points_per_dollar: 5,
            human_description: '5x hotels booked through Amex Travel',
          },
          {
            id: 'flights',
            merchant: 'Amex Travel',
            points_per_dollar: 3,
            human_description: '3x flights booked through Amex Travel',
          },
        ],
      },
    ],
  });

  assert.deepEqual(
    card.earningRewards.map((reward) => ({
      category: reward.category,
      status: reward.status,
      keywords: reward.keywords,
      hasFingerprint: Boolean(reward.sourceFingerprint),
    })),
    [
      {
        category: 'Amex Travel Hotels',
        status: 'needs_review',
        keywords: 'Amex Travel',
        hasFingerprint: true,
      },
      {
        category: 'Amex Travel Flights',
        status: 'needs_review',
        keywords: 'Amex Travel',
        hasFingerprint: true,
      },
    ],
  );
});
