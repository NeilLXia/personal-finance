'use strict';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');

const servicePath = require.resolve('../src/services/creditCardRewardsService');
const authServicePath = require.resolve('../src/services/authService');
const modelsPath = require.resolve('../src/models');
const dashboardContextPath = require.resolve('../src/services/dashboard/dashboardContext');
const categoryRulesPath = require.resolve('../src/services/transactions/categoryRules');
const rewardEarningsPath = require.resolve('../src/services/creditCardRewardEarnings');

const cachedModules = new Map(
  [
    servicePath,
    authServicePath,
    modelsPath,
    dashboardContextPath,
    categoryRulesPath,
    rewardEarningsPath,
  ].map((id) => [id, require.cache[id]]),
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

const loadServiceForUser = (user) => {
  restore();
  delete require.cache[servicePath];

  const writeCalls = [];

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
        createCardTypeWithRewards: async () => {
          writeCalls.push('create');
        },
        updateCardTypeWithRewards: async () => {
          writeCalls.push('update');
        },
        deleteCardType: async () => {
          writeCalls.push('delete');
        },
        findCreditCardTypeById: async () => ({ id: 1 }),
        findRewardCatalog: async () => ({
          cardTypes: [],
          earningRewards: [],
          perkAwards: [],
        }),
        findCreditAccountsByUserId: async () => [],
        findPerkCompletionsForAccountCycles: async () => [],
      },
      transactions: {
        findByUserIdEnvironmentAndDateRange: async () => [],
        findByAccountIdsAndDateRanges: async () => [],
      },
      transactionCategoryRules: {
        findByUserId: async () => [],
      },
    },
  };
  require.cache[dashboardContextPath] = {
    id: dashboardContextPath,
    filename: dashboardContextPath,
    loaded: true,
    exports: {
      getDashboardPlaidEnvironment: () => 'sandbox',
    },
  };
  require.cache[categoryRulesPath] = {
    id: categoryRulesPath,
    filename: categoryRulesPath,
    loaded: true,
    exports: {
      applyTransactionCategoryRules: (transactions) => transactions,
    },
  };
  require.cache[rewardEarningsPath] = {
    id: rewardEarningsPath,
    filename: rewardEarningsPath,
    loaded: true,
    exports: {
      computeEarningRewardBreakdown: () => [],
    },
  };

  return {
    service: require(servicePath),
    writeCalls,
  };
};

afterEach(restore);

test('card type management is restricted to admin accounts', async () => {
  const { service, writeCalls } = loadServiceForUser({
    id: 2,
    email: 'demo@example.com',
    is_demo: true,
    account_type: 'user',
  });

  await assert.rejects(
    () =>
      service.createCreditCardType({
        name: 'Blocked Card',
        annualFee: 0,
        earningRewards: [],
        perkAwards: [],
      }),
    {
      status: 403,
      message: 'Only the account owner can manage credit card types.',
    },
  );
  await assert.rejects(
    () =>
      service.updateCreditCardType({
        cardTypeId: 1,
        name: 'Blocked Card',
        annualFee: 0,
        earningRewards: [],
        perkAwards: [],
      }),
    { status: 403 },
  );
  await assert.rejects(
    () => service.deleteCreditCardType({ cardTypeId: 1 }),
    { status: 403 },
  );

  assert.deepEqual(writeCalls, []);
});

test('admin accounts can manage card types', async () => {
  const { service, writeCalls } = loadServiceForUser({
    id: 9,
    email: 'admin@example.com',
    is_demo: false,
    account_type: 'admin',
  });

  await service.createCreditCardType({
    name: 'Allowed Card',
    annualFee: 0,
    earningRewards: [],
    perkAwards: [],
  });

  assert.deepEqual(writeCalls, ['create']);
});
