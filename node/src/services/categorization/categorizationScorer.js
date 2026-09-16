'use strict';

const {
  canonicalizeExpenseCategory,
  getTransactionCategory,
  getTransactionVendorName,
  normalizeCategoryRuleText,
  normalizeTransactionVendorRuleText,
} = require('../transactions/transactionCategory');
const {
  findTransactionCategoryRule,
} = require('../transactions/categoryRules');

const MODEL_VERSION = 'categorization-scorer-v1';
const LOW_CONFIDENCE_THRESHOLD = 0.65;
const RULE_CONFLICT_THRESHOLD = 0.65;
const AMBIGUOUS_VENDOR_KEYS = new Set([
  'amazon',
  'amazon marketplace',
  'amzn mktp',
  'walmart',
  'target',
]);

const roundConfidence = (value) =>
  Math.max(0, Math.min(1, Number(value.toFixed(4))));

const normalizeCategory = (category) =>
  canonicalizeExpenseCategory(category || '') || null;

const getVendorKey = (transaction) =>
  normalizeTransactionVendorRuleText(getTransactionVendorName(transaction));

const getOriginalCategory = (transaction) => getTransactionCategory(transaction);

const getOriginalCategoryKey = (transaction) =>
  normalizeCategoryRuleText(getOriginalCategory(transaction));

const getAmount = (transaction) => Math.abs(Number(transaction.amount || 0));

const createPatternKey = ({ vendorKey, originalCategoryKey }) =>
  `${originalCategoryKey}::${vendorKey}`;

const createCategoryKey = ({ originalCategoryKey, category }) =>
  `${originalCategoryKey}::${normalizeCategoryRuleText(category)}`;

const indexPatterns = (patterns) => {
  const byVendorAndCategory = new Map();
  const byCategory = new Map();

  patterns.forEach((pattern) => {
    // Re-derive the vendor key from the same normalizer the scorer uses on
    // live transactions: the SQL grouping only lightly cleans merchant text,
    // so rows that differ before this step (e.g. "amazon.com*1a2b3c" vs
    // "amazon.com*4d5e6f") can collapse onto the same key here.
    const vendorKey = pattern.vendor_name_key
      ? normalizeTransactionVendorRuleText(pattern.vendor_name_key)
      : '';
    const originalCategoryKey = pattern.original_category_key || '';
    const category = normalizeCategory(pattern.manual_category);

    if (!category) {
      return;
    }

    if (vendorKey && originalCategoryKey) {
      const key = createPatternKey({ vendorKey, originalCategoryKey });
      const current = byVendorAndCategory.get(key);
      const matchCount = Number(pattern.match_count || 0);
      const averageAmount = Number(pattern.average_amount || 0);

      if (current && current.manual_category === category) {
        const mergedMatchCount = Number(current.match_count || 0) + matchCount;
        const mergedAverageAmount = mergedMatchCount
          ? (Number(current.average_amount || 0) * Number(current.match_count || 0) +
              averageAmount * matchCount) /
            mergedMatchCount
          : 0;

        byVendorAndCategory.set(key, {
          ...current,
          vendor_name_key: vendorKey,
          match_count: mergedMatchCount,
          average_amount: mergedAverageAmount,
        });
      } else if (!current || matchCount > Number(current.match_count || 0)) {
        byVendorAndCategory.set(key, {
          ...pattern,
          vendor_name_key: vendorKey,
          manual_category: category,
        });
      }
    }

    if (originalCategoryKey) {
      const categoryKey = createCategoryKey({ originalCategoryKey, category });
      const current = byCategory.get(categoryKey) || {
        original_category_key: originalCategoryKey,
        manual_category: category,
        match_count: 0,
      };

      current.match_count += Number(pattern.match_count || 0);
      byCategory.set(categoryKey, current);
    }
  });

  return { byVendorAndCategory, byCategory };
};

const bestCategoryPattern = ({ indexedPatterns, originalCategoryKey }) => {
  let best = null;

  indexedPatterns.byCategory.forEach((pattern) => {
    if (pattern.original_category_key !== originalCategoryKey) {
      return;
    }

    if (!best || Number(pattern.match_count || 0) > Number(best.match_count || 0)) {
      best = pattern;
    }
  });

  return best;
};

const buildPatternCandidate = ({
  pattern,
  source,
  confidence,
  evidenceKey,
}) => {
  if (!pattern) {
    return null;
  }

  return {
    category: normalizeCategory(pattern.manual_category),
    source,
    confidence: roundConfidence(confidence),
    averageAmount: Number(pattern.average_amount || 0),
    evidence: {
      [evidenceKey]: Number(pattern.match_count || 0),
    },
  };
};

const getHistoryCandidate = ({ transaction, userPatterns, starterPatterns }) => {
  const vendorKey = getVendorKey(transaction);
  const originalCategoryKey = getOriginalCategoryKey(transaction);
  const userIndexed = indexPatterns(userPatterns);
  const starterIndexed = indexPatterns(starterPatterns);
  const key = createPatternKey({ vendorKey, originalCategoryKey });

  return (
    buildPatternCandidate({
      pattern: userIndexed.byVendorAndCategory.get(key),
      source: 'user_history',
      confidence: 0.9,
      evidenceKey: 'user_vendor_matches',
    }) ||
    buildPatternCandidate({
      pattern: bestCategoryPattern({
        indexedPatterns: userIndexed,
        originalCategoryKey,
      }),
      source: 'user_history',
      confidence: 0.72,
      evidenceKey: 'user_category_matches',
    }) ||
    buildPatternCandidate({
      pattern: starterIndexed.byVendorAndCategory.get(key),
      source: 'starter_pattern',
      confidence: 0.78,
      evidenceKey: 'starter_vendor_matches',
    }) ||
    buildPatternCandidate({
      pattern: bestCategoryPattern({
        indexedPatterns: starterIndexed,
        originalCategoryKey,
      }),
      source: 'starter_pattern',
      confidence: 0.62,
      evidenceKey: 'starter_category_matches',
    })
  );
};

const getAssignedCategory = ({ transaction, rules }) => {
  const manualCategory = normalizeCategory(transaction.manual_category);

  if (manualCategory) {
    return {
      assignedCategory: manualCategory,
      assignedSource: 'manual_category',
      rule: null,
    };
  }

  const rule = findTransactionCategoryRule(transaction, rules);
  const ruleCategory = normalizeCategory(rule?.manual_category);

  if (ruleCategory) {
    return {
      assignedCategory: ruleCategory,
      assignedSource: 'rule',
      rule,
    };
  }

  return {
    assignedCategory: normalizeCategory(
      transaction.display_category || getOriginalCategory(transaction),
    ),
    assignedSource: 'plaid_default',
    rule: null,
  };
};

const hasAmountOutlier = ({ transaction, pattern }) => {
  const averageAmount = Number(pattern?.averageAmount || 0);

  if (!averageAmount) {
    return false;
  }

  const amount = getAmount(transaction);
  return amount > averageAmount * 2.5 || amount < averageAmount * 0.25;
};

const scoreTransactionCategorization = ({
  transaction,
  userRules = [],
  userPatterns = [],
  starterPatterns = [],
}) => {
  const assignment = getAssignedCategory({ transaction, rules: userRules });
  const historyCandidate = getHistoryCandidate({
    transaction,
    userPatterns,
    starterPatterns,
  });
  const fallbackCategory = assignment.assignedCategory || 'Other';
  const candidate = historyCandidate || {
    category: fallbackCategory,
    source: assignment.assignedSource || 'plaid_default',
    confidence: assignment.assignedSource === 'rule' ? 0.68 : 0.48,
    evidence: {},
  };
  const suggestedCategory = normalizeCategory(candidate.category) || fallbackCategory;
  const reviewReasons = new Set();
  const vendorKey = getVendorKey(transaction);
  const confidence = roundConfidence(candidate.confidence);

  if (!transaction.manual_category && assignment.assignedSource === 'plaid_default') {
    reviewReasons.add('uncategorized');
  }

  if (confidence < LOW_CONFIDENCE_THRESHOLD) {
    reviewReasons.add('low_confidence');
  }

  if (
    assignment.assignedSource === 'rule' &&
    assignment.assignedCategory &&
    suggestedCategory !== assignment.assignedCategory &&
    confidence >= RULE_CONFLICT_THRESHOLD
  ) {
    reviewReasons.add('rule_conflict');
  }

  if (AMBIGUOUS_VENDOR_KEYS.has(vendorKey)) {
    reviewReasons.add('ambiguous_vendor');
  }

  if (
    assignment.assignedSource === 'rule' &&
    assignment.rule &&
    hasAmountOutlier({ transaction, pattern: historyCandidate })
  ) {
    reviewReasons.add('amount_outlier');
  }

  const reviewRequired =
    reviewReasons.size > 0 ||
    assignment.assignedSource === 'plaid_default' ||
    assignment.assignedCategory !== suggestedCategory;

  return {
    transaction_id: Number(transaction.id),
    assigned_category: assignment.assignedCategory,
    assigned_source: assignment.assignedSource,
    suggested_category: suggestedCategory,
    confidence,
    review_required: reviewRequired,
    review_reasons: Array.from(reviewReasons),
    evidence: {
      original_category: getOriginalCategory(transaction),
      vendor_name: getTransactionVendorName(transaction),
      vendor_key: vendorKey,
      suggested_source: candidate.source,
      ...candidate.evidence,
    },
  };
};

module.exports = {
  MODEL_VERSION,
  scoreTransactionCategorization,
};
