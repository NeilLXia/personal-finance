'use strict';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');

const servicePath = require.resolve(
  '../src/services/vectorMint/vectorMintCardCatalogService',
);
const authServicePath = require.resolve('../src/services/authService');
const modelsPath = require.resolve('../src/models');

const cachedModules = new Map(
  [servicePath, authServicePath, modelsPath].map((id) => [
    id,
    require.cache[id],
  ]),
);

const restore = () => {
  cachedModules.forEach((entry, id) => {
    if (entry) {
      require.cache[id] = entry;
    } else {
      delete require.cache[id];
    }
  });
};

afterEach(restore);

const loadService = ({ user, catalog }) => {
  restore();
  delete require.cache[servicePath];

  require.cache[authServicePath] = {
    id: authServicePath,
    filename: authServicePath,
    loaded: true,
    exports: {
      getCurrentUser: async () => user,
    },
  };
  require.cache[modelsPath] = {
    id: modelsPath,
    filename: modelsPath,
    loaded: true,
    exports: {
      creditCardRewards: {
        findRewardCatalog: async () => catalog,
      },
    },
  };

  return require(servicePath);
};

const catalog = {
  cardTypes: [
    { id: 1, name: 'American Express Gold', annual_fee: 325 },
    { id: 2, name: 'Chase Sapphire Preferred', annual_fee: 95 },
  ],
  earningRewards: [
    {
      credit_card_type_id: 1,
      category: 'Dining',
      reward_percent: 4,
      keywords: null,
    },
  ],
  perkAwards: [
    {
      credit_card_type_id: 1,
      name: 'Dining credit',
      dollar_value: 120,
      frequency_count: 12,
      frequency_period: 'per_year',
      auto_complete: false,
    },
  ],
};

test('previewVectorMintCardCatalog is restricted to admin users', async () => {
  const service = loadService({
    user: { id: 2, account_type: 'user' },
    catalog,
  });
  const client = {
    fetchConfiguredCardData: async () => {
      throw new Error('external fetch should not run');
    },
  };

  await assert.rejects(
    () => service.previewVectorMintCardCatalog({ client }),
    {
      status: 403,
      message: 'Only admin accounts can preview Vector Mint card data.',
    },
  );
});

test('previewVectorMintCardCatalog compares current catalog with normalized external cards', async () => {
  const service = loadService({
    user: { id: 1, account_type: 'admin' },
    catalog,
  });
  const client = {
    fetchConfiguredCardData: async () => ({
      cards: [
        {
          id: 'vm-amex-gold',
          name: 'Amex Gold',
          annual_fee: '$325',
          rewards: [
            { category: 'Restaurants', reward_percent: '4%' },
            { category: 'Streaming', reward_percent: '3%' },
          ],
          benefits: [
            { name: 'Uber credit', value: '$120', frequency: 'annual' },
          ],
        },
        {
          id: 'vm-other-card',
          name: 'Other Travel Card',
          annual_fee: 0,
          rewards: [{ category: 'Travel', reward_percent: 3 }],
        },
        {
          id: 'vm-citi-double-cash',
          name: 'Citi Double Cash Card',
          annual_fee: 0,
          rewards: [{ category: 'Base rate', reward_percent: 2 }],
        },
      ],
    }),
  };

  const result = await service.previewVectorMintCardCatalog({ client });

  assert.equal(result.current_card_count, 2);
  assert.equal(result.external_card_count, 3);
  assert.equal(result.matched_card_count, 1);
  assert.deepEqual(
    result.comparisons.map((comparison) => comparison.status),
    ['matched', 'missing_external_match'],
  );
  assert.deepEqual(result.comparisons[0].vectorMint.earningRewards[0], 
    {
      externalId: 'reward-0',
      category: 'Dining',
      rewardPercent: 4,
      keywords: null,
      status: 'included',
      source: 'vectormint',
      sourceDescription: 'Restaurants',
      statusReason: null,
      matchStrategy: 'manual_category',
      sourceFingerprint:
        result.comparisons[0].vectorMint.earningRewards[0].sourceFingerprint,
    });
  assert.equal(
    result.comparisons[0].vectorMint.earningRewards.filter(
      (reward) => reward.status === 'excluded',
    ).length,
    1,
  );
  assert.deepEqual(result.external_only_cards, [
    {
      sourceId: 'vm-other-card',
      name: 'Other Travel Card',
      annualFee: 0,
      earningRewardCount: 1,
      perkAwardCount: 0,
      excludedBenefitCount: 0,
    },
    {
      sourceId: 'vm-citi-double-cash',
      name: 'Citi Double Cash Card',
      annualFee: 0,
      earningRewardCount: 1,
      perkAwardCount: 0,
      excludedBenefitCount: 0,
    },
  ]);
});

test('previewVectorMintCardCatalog safely matches reordered issuer names', async () => {
  const service = loadService({
    user: { id: 1, account_type: 'admin' },
    catalog: {
      cardTypes: [
        {
          id: 1,
          name: 'American Express Blue Cash Preferred',
          annual_fee: 95,
        },
        { id: 2, name: 'Citi Custom Cash', annual_fee: 0 },
        { id: 3, name: 'U.S. Bank Altitude Go', annual_fee: 0 },
        { id: 4, name: 'Capital One Venture Rewards', annual_fee: 95 },
        { id: 5, name: 'American Express Gold', annual_fee: 325 },
      ],
      earningRewards: [],
      perkAwards: [],
    },
  });
  const client = {
    fetchConfiguredCardData: async () => ({
      cards: [
        {
          id: 'amex-blue-cash-preferred',
          name: 'Blue Cash Preferred Card from American Express',
          annual_fee: 95,
        },
        {
          id: 'citi-double-cash',
          name: 'Citi Double Cash Card',
          annual_fee: 0,
        },
        {
          id: 'usbank-altitude-go-secured',
          name: 'U.S. Bank Altitude Go Secured Visa Card',
          annual_fee: 0,
        },
        {
          id: 'capital-one-venture-x',
          name: 'Capital One Venture X Rewards Credit Card',
          annual_fee: 395,
        },
        {
          id: 'amex-business-gold',
          name: 'American Express Business Gold Card',
          annual_fee: 375,
        },
      ],
    }),
  };

  const result = await service.previewVectorMintCardCatalog({ client });

  assert.deepEqual(
    result.comparisons.map((comparison) => comparison.status),
    [
      'matched',
      'missing_external_match',
      'missing_external_match',
      'missing_external_match',
      'missing_external_match',
    ],
  );
});
