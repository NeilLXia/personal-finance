'use strict';

const moment = require('moment');

const models = require('../../models');
const { httpError } = require('../../lib/httpError');
const { monthPattern } = require('../../http/patterns');
const { getCurrentUser } = require('../authService');
const {
  getDashboardPlaidEnvironment,
} = require('../dashboard/dashboardContext');
const {
  applyTransactionCategoryRules,
} = require('../transactions/categoryRules');
const {
  canonicalizeExpenseCategory,
} = require('../transactions/transactionCategory');
const {
  MODEL_VERSION,
  scoreTransactionCategorization,
} = require('./categorizationScorer');

const SCOPES = new Set(['user_only', 'user_and_starter_patterns']);

const serializeDate = (value) =>
  value && value.toISOString ? value.toISOString().slice(0, 10) : value;

const serializeSuggestion = (suggestion) => ({
  id: Number(suggestion.id),
  batch_id: Number(suggestion.batch_id),
  transaction_id: Number(suggestion.transaction_id),
  assigned_category: suggestion.assigned_category,
  assigned_source: suggestion.assigned_source,
  suggested_category: suggestion.suggested_category,
  confidence: Number(suggestion.confidence),
  review_required: Boolean(suggestion.review_required),
  review_reasons: suggestion.review_reasons || [],
  evidence: suggestion.evidence || {},
  status: suggestion.status,
  approved_category: suggestion.approved_category,
  transaction: {
    id: Number(suggestion.transaction_id),
    amount: Number(suggestion.amount),
    date: serializeDate(suggestion.date),
    manual_date: serializeDate(suggestion.manual_date),
    name: suggestion.name,
    merchant_name: suggestion.merchant_name,
    category: suggestion.category,
    manual_category: suggestion.transaction_manual_category,
    account_name: suggestion.account_name,
    account_mask: suggestion.account_mask,
    institution_name: suggestion.institution_name,
  },
});

const groupSuggestions = (suggestions) => {
  const groups = new Map();

  suggestions.forEach((suggestion) => {
    const originalCategory =
      suggestion.evidence?.original_category ||
      suggestion.transaction.category ||
      'Uncategorized';
    const groupKey = [
      originalCategory,
      suggestion.suggested_category,
      suggestion.status,
      suggestion.review_required ? 'review' : 'ready',
    ].join('::');
    const group = groups.get(groupKey) || {
      id: groupKey,
      original_category: originalCategory,
      suggested_category: suggestion.suggested_category,
      status: suggestion.status,
      review_required: suggestion.review_required,
      count: 0,
      average_confidence: 0,
      total_amount: 0,
      review_reasons: [],
      suggestions: [],
    };

    group.count += 1;
    group.total_amount = Number(
      (
        group.total_amount +
        Math.abs(Number(suggestion.transaction.amount || 0))
      ).toFixed(2),
    );
    group.suggestions.push(suggestion);
    group.review_reasons = Array.from(
      new Set([...group.review_reasons, ...suggestion.review_reasons]),
    );
    groups.set(groupKey, group);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      average_confidence: Number(
        (
          group.suggestions.reduce(
            (total, suggestion) => total + suggestion.confidence,
            0,
          ) / group.suggestions.length
        ).toFixed(4),
      ),
    }))
    .sort(
      (left, right) =>
        Number(right.review_required) - Number(left.review_required) ||
        left.average_confidence - right.average_confidence ||
        right.total_amount - left.total_amount,
    );
};

const serializeBatch = ({ batch, suggestions }) => {
  const serializedSuggestions = suggestions.map(serializeSuggestion);

  return {
    batch: {
      id: Number(batch.id),
      user_id: Number(batch.user_id),
      month: batch.month,
      scope: batch.scope,
      status: batch.status,
      model_version: batch.model_version,
      created_at: batch.created_at,
      updated_at: batch.updated_at,
    },
    groups: groupSuggestions(serializedSuggestions),
    suggestions: serializedSuggestions,
  };
};

const validateMonth = (month) => {
  const cleanMonth = String(month || '').trim();

  if (
    !monthPattern.test(cleanMonth) ||
    !moment(cleanMonth, 'YYYY-MM', true).isValid()
  ) {
    throw httpError(400, 'month is invalid.');
  }

  return cleanMonth;
};

const validateScope = (scope = 'user_only') => {
  if (!SCOPES.has(scope)) {
    throw httpError(400, 'scope is invalid.');
  }

  return scope;
};

const getMonthRange = (month) => {
  const start = moment.utc(month, 'YYYY-MM', true).startOf('month');

  return {
    startDate: start.format('YYYY-MM-DD'),
    endDate: start.clone().endOf('month').format('YYYY-MM-DD'),
  };
};

const isEligibleForCategorization = (transaction) =>
  transaction.is_expense &&
  !transaction.pending &&
  !transaction.direct_manual_category &&
  Number(transaction.amount || 0) > 0;

const getSuggestionResponse = async ({ batchId }) => {
  const user = await getCurrentUser();
  const batch = await models.categorizationSuggestions.findBatchForUser({
    batchId,
    userId: user.id,
  });

  if (!batch) {
    throw httpError(404, 'Categorization batch was not found.');
  }

  const suggestions =
    await models.categorizationSuggestions.findSuggestionsByBatchForUser({
      batchId,
      userId: user.id,
    });

  return serializeBatch({ batch, suggestions });
};

const createCategorizationBatch = async ({ month, scope }) => {
  const user = await getCurrentUser();
  const cleanMonth = validateMonth(month);
  const cleanScope = validateScope(scope);
  const plaidEnvironment = await getDashboardPlaidEnvironment(user);
  const { startDate, endDate } = getMonthRange(cleanMonth);
  const [transactions, userRules, userPatterns, starterPatterns] =
    await Promise.all([
      models.transactions.findByUserIdEnvironmentAndDateRange({
        userId: user.id,
        plaidEnvironment,
        startDate,
        endDate,
      }),
      models.transactionCategoryRules.findByUserId(user.id),
      models.categorizationSuggestions.findCategorizationPatterns({
        userIds: [user.id],
      }),
      cleanScope === 'user_and_starter_patterns'
        ? models.categorizationSuggestions.findCategorizationPatterns({
            adminOnly: true,
          })
        : Promise.resolve([]),
    ]);
  const rawTransactionById = new Map(
    transactions.map((transaction) => [Number(transaction.id), transaction]),
  );
  const suggestions = applyTransactionCategoryRules(transactions, userRules)
    .map((transaction) => ({
      ...transaction,
      direct_manual_category:
        rawTransactionById.get(Number(transaction.id))?.manual_category || null,
    }))
    .filter(isEligibleForCategorization)
    .map((transaction) =>
      scoreTransactionCategorization({
        transaction: {
          ...rawTransactionById.get(Number(transaction.id)),
          ...transaction,
          // applyTransactionCategoryRules stamps manual_category with the
          // rule's category when a rule matches, which would make the scorer
          // think this was a direct user edit and skip its own rule lookup
          // (see getAssignedCategory). Pass through only the direct/raw
          // value so rule-matched transactions are actually scored as
          // assigned_source: 'rule' and can be flagged via rule_conflict.
          manual_category: transaction.direct_manual_category,
        },
        userRules,
        userPatterns,
        starterPatterns,
      }),
    )
    .filter((suggestion) => suggestion.suggested_category);
  const result =
    await models.categorizationSuggestions.createBatchWithSuggestions({
      userId: user.id,
      month: cleanMonth,
      scope: cleanScope,
      modelVersion: MODEL_VERSION,
      suggestions,
    });

  return getSuggestionResponse({ batchId: result.batch.id });
};

const approveCategorizationSuggestions = async ({
  batchId = null,
  suggestionIds,
  categoryOverrides = {},
}) => {
  const user = await getCurrentUser();
  const cleanSuggestionIds = Array.from(
    new Set((suggestionIds || []).map(Number).filter(Number.isInteger)),
  );

  if (cleanSuggestionIds.length === 0) {
    throw httpError(400, 'suggestion_ids is required.');
  }

  const existing =
    await models.categorizationSuggestions.findSuggestionsByIdsForUser({
      suggestionIds: cleanSuggestionIds,
      userId: user.id,
    });

  if (existing.length !== cleanSuggestionIds.length) {
    throw httpError(404, 'One or more categorization suggestions were not found.');
  }

  if (
    batchId !== null &&
    existing.some((suggestion) => Number(suggestion.batch_id) !== Number(batchId))
  ) {
    throw httpError(400, 'One or more suggestions do not belong to this batch.');
  }

  if (existing.some((suggestion) => suggestion.status !== 'pending')) {
    throw httpError(409, 'One or more categorization suggestions are no longer pending.');
  }

  const categoryBySuggestionId = new Map();
  cleanSuggestionIds.forEach((suggestionId) => {
    const override = categoryOverrides[String(suggestionId)];

    if (override) {
      categoryBySuggestionId.set(
        suggestionId,
        canonicalizeExpenseCategory(override),
      );
    }
  });

  await models.categorizationSuggestions.approveSuggestionsForUser({
    suggestionIds: cleanSuggestionIds,
    userId: user.id,
    categoryBySuggestionId,
  });

  return getSuggestionResponse({ batchId: existing[0].batch_id });
};

const dismissCategorizationSuggestion = async ({ suggestionId }) => {
  const user = await getCurrentUser();
  const suggestion =
    await models.categorizationSuggestions.dismissSuggestionForUser({
      suggestionId,
      userId: user.id,
    });

  if (!suggestion) {
    throw httpError(404, 'Categorization suggestion was not found.');
  }

  return getSuggestionResponse({ batchId: suggestion.batch_id });
};

module.exports = {
  approveCategorizationSuggestions,
  createCategorizationBatch,
  dismissCategorizationSuggestion,
  getSuggestionResponse,
};
