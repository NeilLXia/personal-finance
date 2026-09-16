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

const loadServiceForUser = (user, overrides = {}) => {
  restore();
  delete require.cache[servicePath];

  const writeCalls = [];
  const accountRanges = [];
  const userTransactionRanges = [];
  const catalog = overrides.catalog || {
    cardTypes: [],
    earningRewards: [],
    perkAwards: [],
  };
  const accounts = overrides.accounts || [];

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
        findCreditCardTypeById: async (cardTypeId) =>
          overrides.cardType ||
          catalog.cardTypes.find(
            (cardType) => Number(cardType.id) === Number(cardTypeId),
          ) ||
          { id: 1 },
        findCreditAccountByIdForUser: async () =>
          overrides.creditAccount || null,
        findRewardCatalog: async () => catalog,
        findCreditAccountsByUserId: async () => accounts,
        findPerkCompletionsForAccountCycles: async () => [],
        upsertAccountType: async () => {
          writeCalls.push('assign');
        },
      },
      transactions: {
        findByUserIdEnvironmentAndDateRange: async (params) => {
          userTransactionRanges.push(params);
          return [];
        },
        findByAccountIdsAndDateRanges: async (ranges) => {
          accountRanges.push(...ranges);
          return [];
        },
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
    accountRanges,
    service: require(servicePath),
    userTransactionRanges,
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

test('reward earning calculations request transactions by each card benefit cycle', async () => {
  const { accountRanges, service, userTransactionRanges } = loadServiceForUser(
    {
      id: 2,
      email: 'user@example.com',
      is_demo: false,
      account_type: 'user',
    },
    {
      catalog: {
        cardTypes: [{ id: 11, name: 'Rewards Card', annual_fee: 95 }],
        earningRewards: [
          {
            id: 21,
            credit_card_type_id: 11,
            category: 'Base rate',
            reward_percent: 1,
            keywords: null,
          },
        ],
        perkAwards: [],
      },
      accounts: [
        {
          id: 7,
          credit_card_type_id: 11,
          effective_month: '2000-11-01',
        },
        {
          id: 8,
          credit_card_type_id: 11,
          effective_month: '2000-07-01',
        },
      ],
    },
  );

  await service.getCreditCardRewards({ selectedMonth: '2026-08' });

  assert.deepEqual(userTransactionRanges, []);
  assert.deepEqual(
    accountRanges.sort((left, right) => left.accountId - right.accountId),
    [
      {
        accountId: 7,
        startDate: '2025-11-01',
        endDate: '2026-08-31',
      },
      {
        accountId: 8,
        startDate: '2026-07-01',
        endDate: '2026-08-31',
      },
    ],
  );
});

test('credit card assignment rejects card types that are still in review', async () => {
  const { service, writeCalls } = loadServiceForUser(
    {
      id: 2,
      email: 'user@example.com',
      is_demo: false,
      account_type: 'user',
    },
    {
      creditAccount: { id: 7, user_id: 2, type: 'credit' },
      catalog: {
        cardTypes: [
          {
            id: 11,
            name: 'Imported Card',
            annual_fee: 95,
            status: 'in_review',
          },
        ],
        earningRewards: [],
        perkAwards: [],
      },
    },
  );

  await assert.rejects(
    () =>
      service.setAccountCreditCardType({
        accountId: 7,
        creditCardTypeId: 11,
        effectiveMonth: '2000-01-01',
      }),
    {
      status: 400,
      message: 'Credit card type is still in review.',
    },
  );

  assert.deepEqual(writeCalls, []);
});

test('reward optimization runs only through the optimization service method', async () => {
  const { service, userTransactionRanges } = loadServiceForUser({
    id: 2,
    email: 'user@example.com',
    is_demo: false,
    account_type: 'user',
  });

  await service.getCreditCardRewardOptimization({ selectedMonth: '2026-08' });

  assert.deepEqual(userTransactionRanges, [
    {
      userId: 2,
      plaidEnvironment: 'sandbox',
      startDate: '2025-09-01',
      endDate: '2026-08-31',
    },
  ]);
});
