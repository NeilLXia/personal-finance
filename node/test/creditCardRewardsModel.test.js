'use strict';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');

const dbPath = require.resolve('../src/db/connection');
const creditCardRewardsModelPath = require.resolve(
  '../src/models/creditCardRewardsModel',
);
const transactionModelPath = require.resolve('../src/models/transactionModel');

const cachedModules = new Map(
  [dbPath, creditCardRewardsModelPath, transactionModelPath].map((id) => [
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

const stubDb = (exports) => {
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports,
  };
};

const loadCreditCardRewardsModel = ({ queryResults }) => {
  restore();
  delete require.cache[creditCardRewardsModelPath];

  const calls = [];
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      const result = queryResults.shift();

      if (result instanceof Error) {
        throw result;
      }

      return result || { rows: [], rowCount: 0 };
    },
    release: () => {
      calls.push({ sql: 'RELEASE' });
    },
  };

  stubDb({
    getClient: async () => client,
  });

  return {
    calls,
    model: require(creditCardRewardsModelPath),
  };
};

afterEach(restore);

test('updateCardTypeWithRewards rolls back when an earning reward id does not belong to the card type', async () => {
  const { model, calls } = loadCreditCardRewardsModel({
    queryResults: [
      { rows: [], rowCount: 0 },
      { rows: [{ id: 7 }], rowCount: 1 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
    ],
  });

  await assert.rejects(
    () =>
      model.updateCardTypeWithRewards({
        cardTypeId: 7,
        name: 'Updated Card',
        annualFee: 95,
        earningRewards: [
          {
            id: 123,
            category: 'Dining',
            rewardPercent: 3,
            keywords: null,
          },
        ],
        perkAwards: [],
      }),
    {
      code: 'STALE_CREDIT_CARD_TYPE_CHILD',
      status: 409,
      message: 'Credit card earning reward was not found for this card type.',
    },
  );

  assert.ok(calls.some((call) => call.sql === 'ROLLBACK'));
  assert.equal(
    calls.some((call) =>
      String(call.sql).includes('DELETE FROM credit_card_earning_rewards'),
    ),
    false,
  );
});

test('updateCardTypeWithRewards rolls back when a perk id does not belong to the card type', async () => {
  const { model, calls } = loadCreditCardRewardsModel({
    queryResults: [
      { rows: [], rowCount: 0 },
      { rows: [{ id: 7 }], rowCount: 1 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
    ],
  });

  await assert.rejects(
    () =>
      model.updateCardTypeWithRewards({
        cardTypeId: 7,
        name: 'Updated Card',
        annualFee: 95,
        earningRewards: [],
        perkAwards: [
          {
            id: 456,
            name: 'Travel credit',
            dollarValue: 300,
            completionAmount: 0,
            frequencyCount: 1,
            frequencyPeriod: 'per_year',
            autoComplete: false,
          },
        ],
      }),
    {
      code: 'STALE_CREDIT_CARD_TYPE_CHILD',
      status: 409,
      message: 'Credit card perk was not found for this card type.',
    },
  );

  assert.ok(calls.some((call) => call.sql === 'ROLLBACK'));
  assert.equal(
    calls.some((call) =>
      String(call.sql).includes('DELETE FROM credit_card_perk_awards'),
    ),
    false,
  );
});

test('findByUserIdEnvironmentAndDateRange excludes pending transactions', async () => {
  restore();
  delete require.cache[transactionModelPath];

  let capturedSql = '';
  stubDb({
    query: async (sql) => {
      capturedSql = sql;
      return { rows: [] };
    },
  });

  const transactionModel = require(transactionModelPath);

  await transactionModel.findByUserIdEnvironmentAndDateRange({
    userId: 1,
    plaidEnvironment: 'production',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  });

  assert.match(capturedSql, /transactions\.pending = FALSE/);
});
