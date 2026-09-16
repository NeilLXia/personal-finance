'use strict';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');

const servicePath = require.resolve(
  '../src/services/categorization/categorizationAssistantService',
);
const authServicePath = require.resolve('../src/services/authService');
const modelsPath = require.resolve('../src/models');
const dashboardContextPath = require.resolve(
  '../src/services/dashboard/dashboardContext',
);

const cachedModules = new Map(
  [servicePath, authServicePath, modelsPath, dashboardContextPath].map((id) => [
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

const loadService = ({
  userRules = [],
  suggestionsByIds = [
    {
      id: 1,
      batch_id: 99,
      transaction_id: 10,
      suggested_category: 'Shopping',
      status: 'approved',
    },
  ],
} = {}) => {
  restore();
  delete require.cache[servicePath];

  const captured = {
    patternCalls: [],
    persistedSuggestions: [],
  };
  const transactions = [
    {
      id: 10,
      amount: 25,
      category: 'Shops',
      date: '2026-08-10',
      name: 'Amazon Marketplace',
      merchant_name: 'Amazon',
      manual_category: null,
      pending: false,
      account_type: 'credit',
      account_subtype: 'credit card',
      account_name: 'Card',
    },
    {
      id: 11,
      amount: 15,
      category: 'Food and Drink',
      date: '2026-08-12',
      name: 'Cafe',
      merchant_name: 'Cafe',
      manual_category: 'Dining',
      pending: false,
      account_type: 'credit',
      account_subtype: 'credit card',
      account_name: 'Card',
    },
  ];

  require.cache[authServicePath] = {
    id: authServicePath,
    filename: authServicePath,
    loaded: true,
    exports: {
      getCurrentUser: async () => ({
        id: 2,
        email: 'user@example.com',
        account_type: 'user',
      }),
    },
  };
  require.cache[dashboardContextPath] = {
    id: dashboardContextPath,
    filename: dashboardContextPath,
    loaded: true,
    exports: {
      getDashboardPlaidEnvironment: () => 'production',
    },
  };
  require.cache[modelsPath] = {
    id: modelsPath,
    filename: modelsPath,
    loaded: true,
    exports: {
      categorizationSuggestions: {
        createBatchWithSuggestions: async ({ suggestions }) => {
          captured.persistedSuggestions = suggestions;
          return {
            batch: {
              id: 99,
              user_id: 2,
              month: '2026-08',
              scope: 'user_and_starter_patterns',
              status: 'pending',
              model_version: 'categorization-scorer-v1',
            },
            suggestions,
          };
        },
        findBatchForUser: async () => ({
          id: 99,
          user_id: 2,
          month: '2026-08',
          scope: 'user_and_starter_patterns',
          status: 'pending',
          model_version: 'categorization-scorer-v1',
        }),
        findCategorizationPatterns: async (params) => {
          captured.patternCalls.push(params);
          return params.adminOnly
            ? [
                {
                  original_category_key: 'shops',
                  vendor_name_key: 'amazon',
                  manual_category: 'Shopping',
                  match_count: 12,
                },
              ]
            : [];
        },
        findSuggestionsByBatchForUser: async () =>
          captured.persistedSuggestions.map((suggestion, index) => {
            const transaction = transactions.find(
              (row) => Number(row.id) === Number(suggestion.transaction_id),
            );

            return {
              id: index + 1,
              batch_id: 99,
              ...suggestion,
              amount: transaction.amount,
              date: transaction.date,
              manual_date: null,
              name: transaction.name,
              merchant_name: transaction.merchant_name,
              category: transaction.category,
              transaction_manual_category: transaction.manual_category,
              account_name: transaction.account_name,
              account_mask: '1234',
              institution_name: 'Bank',
              status: 'pending',
              approved_category: null,
            };
          }),
        findSuggestionsByIdsForUser: async () => suggestionsByIds,
        approveSuggestionsForUser: async () => {
          captured.approved = true;
        },
      },
      transactionCategoryRules: {
        findByUserId: async () => userRules,
      },
      transactions: {
        findByUserIdEnvironmentAndDateRange: async () => transactions,
      },
    },
  };

  return {
    captured,
    service: require(servicePath),
  };
};

test('createCategorizationBatch uses starter patterns and skips direct manual categories', async () => {
  const { captured, service } = loadService();

  const result = await service.createCategorizationBatch({
    month: '2026-08',
    scope: 'user_and_starter_patterns',
  });

  assert.equal(captured.patternCalls.some((call) => call.adminOnly), true);
  assert.equal(captured.persistedSuggestions.length, 1);
  assert.equal(captured.persistedSuggestions[0].transaction_id, 10);
  assert.equal(captured.persistedSuggestions[0].suggested_category, 'Shopping');
  assert.equal(result.groups.length, 1);
});

test('createCategorizationBatch attributes a matched rule as assigned_source "rule" and flags a conflict when history disagrees', async () => {
  const { captured, service } = loadService({
    userRules: [
      {
        id: 1,
        original_category: 'Shops',
        vendor_name: 'Amazon',
        match_type: 'contains',
        manual_category: 'Retail',
      },
    ],
  });

  await service.createCategorizationBatch({
    month: '2026-08',
    scope: 'user_and_starter_patterns',
  });

  const suggestion = captured.persistedSuggestions.find(
    (row) => row.transaction_id === 10,
  );

  // Transaction 10 has no direct manual_category, but applyTransactionCategoryRules
  // stamps one on it once the rule matches. The scorer must still see this as a
  // rule assignment (not a pre-existing manual one) so it can audit it against
  // the starter pattern below, which disagrees ('Shopping' vs the rule's 'Retail').
  assert.equal(suggestion.assigned_category, 'Retail');
  assert.equal(suggestion.assigned_source, 'rule');
  assert.equal(suggestion.suggested_category, 'Shopping');
  assert.ok(suggestion.review_reasons.includes('rule_conflict'));
});

test('approveCategorizationSuggestions rejects stale suggestions', async () => {
  const { captured, service } = loadService();

  await assert.rejects(
    () =>
      service.approveCategorizationSuggestions({
        suggestionIds: [1],
      }),
    { status: 409 },
  );
  assert.equal(captured.approved, undefined);
});

test('approveCategorizationSuggestions rejects a suggestion that does not belong to the requested batch', async () => {
  const { captured, service } = loadService({
    suggestionsByIds: [
      {
        id: 1,
        batch_id: 99,
        transaction_id: 10,
        suggested_category: 'Shopping',
        status: 'pending',
      },
    ],
  });

  await assert.rejects(
    () =>
      service.approveCategorizationSuggestions({
        batchId: 123,
        suggestionIds: [1],
      }),
    { status: 400 },
  );
  assert.equal(captured.approved, undefined);
});

test('approveCategorizationSuggestions succeeds when the suggestion belongs to the requested batch', async () => {
  const { captured, service } = loadService({
    suggestionsByIds: [
      {
        id: 1,
        batch_id: 99,
        transaction_id: 10,
        suggested_category: 'Shopping',
        status: 'pending',
      },
    ],
  });

  await service.approveCategorizationSuggestions({
    batchId: 99,
    suggestionIds: [1],
  });

  assert.equal(captured.approved, true);
});
