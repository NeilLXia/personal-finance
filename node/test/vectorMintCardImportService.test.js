'use strict';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');

const servicePath = require.resolve(
  '../src/services/vectorMint/vectorMintCardImportService',
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

const loadService = ({ user, catalog, mergeVectorMintCardCatalog }) => {
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
        mergeVectorMintCardCatalog,
      },
    },
  };

  return require(servicePath);
};

const catalog = {
  cardTypes: [
    {
      id: 10,
      name: 'American Express Gold',
      annual_fee: 325,
      status: 'active',
      external_source: null,
      external_card_id: null,
    },
  ],
  earningRewards: [],
  perkAwards: [],
};

test('importVectorMintCardCatalog is restricted to admin users', async () => {
  const service = loadService({
    user: { id: 2, account_type: 'user' },
    catalog,
    mergeVectorMintCardCatalog: async () => {
      throw new Error('merge should not run');
    },
  });

  await assert.rejects(
    () =>
      service.importVectorMintCardCatalog({
        client: { fetchConfiguredCardData: async () => ({ cards: [] }) },
      }),
    {
      status: 403,
      message: 'Only admin accounts can import VectorMint card data.',
    },
  );
});

test('importVectorMintCardCatalog normalizes cards and passes a conservative matcher to the model', async () => {
  let importedCards = null;
  let matchedId = null;
  const service = loadService({
    user: { id: 1, account_type: 'admin' },
    catalog,
    mergeVectorMintCardCatalog: async ({ cards, matchCardTypeId }) => {
      importedCards = cards;
      matchedId = matchCardTypeId(cards[0]);
      return {
        fetched_count: cards.length,
        matched_count: 1,
        created_review_count: 0,
        updated_count: 1,
        unchanged_count: 0,
        benefits_added_count: 1,
        benefits_updated_count: 0,
        benefits_preserved_count: 0,
        review_required_count: 1,
        warnings: [],
      };
    },
  });

  const summary = await service.importVectorMintCardCatalog({
    client: {
      fetchConfiguredCardData: async () => ({
        cards: [
          {
            id: 'amex-gold',
            name: 'American Express Gold Card',
            annual_fee: 325,
            reward_rules: [
              {
                id: 'gold-hotels',
                merchant_category: 'Amex Travel',
                points_per_dollar: 5,
                merchant: 'Amex Travel',
                human_description: '5x hotels booked through Amex Travel',
              },
            ],
          },
        ],
      }),
    },
  });

  assert.equal(summary.fetched_count, 1);
  assert.equal(matchedId, 10);
  assert.equal(importedCards[0].earningRewards[0].category, 'Amex Travel Hotels');
  assert.equal(importedCards[0].earningRewards[0].status, 'needs_review');
  assert.ok(importedCards[0].earningRewards[0].sourceFingerprint);
});
