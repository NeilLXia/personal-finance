'use strict';

// User-defined "when the original category is X and the vendor matches Y, set
// category Z" rules: matching, precedence, and application to a transaction list.

const {
  canonicalizeExpenseCategory,
  getAutomaticManualCategory,
  getTransactionCategory,
  getTransactionProfile,
  getTransactionVendorName,
  normalizeCategoryRuleText,
  normalizeTransactionVendorRuleText,
} = require('./transactionCategory');
const {
  getManualCashFlowTransactionType,
} = require('./cashFlowClassification');

const transactionRuleMatchTypes = new Set(['exact', 'contains']);

const normalizeTransactionRuleMatchType = (matchType) =>
  transactionRuleMatchTypes.has(matchType) ? matchType : 'contains';

const isManualCategoryRuleExcluded = (transaction) => {
  const vendorName = normalizeCategoryRuleText(
    getTransactionVendorName(transaction),
  );
  const { isVenmo, isVenmoAccount, isVenmoStandardTransfer } =
    getTransactionProfile(transaction);

  return (
    vendorName === 'amazon' ||
    (isVenmo && isVenmoAccount && !isVenmoStandardTransfer)
  );
};

const transactionCategoryRuleMatches = (transaction, rule) => {
  const transactionCategoryKey = normalizeCategoryRuleText(
    getTransactionCategory(transaction),
  );
  const transactionVendorNameKey = normalizeTransactionVendorRuleText(
    getTransactionVendorName(transaction),
  );
  const ruleCategoryKey =
    rule.original_category_key ||
    normalizeCategoryRuleText(rule.original_category);
  const ruleVendorNameKey =
    rule.vendor_name_key || normalizeTransactionVendorRuleText(rule.vendor_name);

  if (transactionCategoryKey !== ruleCategoryKey) {
    return false;
  }

  const matchType = normalizeTransactionRuleMatchType(rule.match_type);

  if (matchType === 'contains') {
    return transactionVendorNameKey.includes(ruleVendorNameKey);
  }

  return transactionVendorNameKey === ruleVendorNameKey;
};

const findTransactionCategoryRule = (transaction, rules) => {
  const matchPrecedence = ['exact', 'contains'];

  return matchPrecedence.reduce((matchedRule, matchType) => {
    if (matchedRule) {
      return matchedRule;
    }

    return (
      rules.find(
        (rule) =>
          normalizeTransactionRuleMatchType(rule.match_type) === matchType &&
          transactionCategoryRuleMatches(transaction, rule),
      ) || null
    );
  }, null);
};

const applyTransactionCategoryRules = (transactions, rules) => {
  return transactions.map((transaction) => {
    const automaticManualCategory = getAutomaticManualCategory(transaction);
    const directManualCategory = transaction.manual_category || null;
    const categoryRule = automaticManualCategory
      ? null
      : findTransactionCategoryRule(transaction, rules);
    const ruleManualCategory = categoryRule?.manual_category || null;
    const manualCategory =
      canonicalizeExpenseCategory(
        directManualCategory || automaticManualCategory || ruleManualCategory,
      ) || null;
    const displayCategory = canonicalizeExpenseCategory(
      manualCategory || getTransactionCategory(transaction),
    );
    const cashFlowType = getManualCashFlowTransactionType({
      ...transaction,
      manual_category: manualCategory,
      display_category: displayCategory,
    });

    return {
      ...transaction,
      original_category: getTransactionCategory(transaction),
      manual_category: manualCategory,
      display_category: displayCategory,
      cash_flow_type: cashFlowType,
      is_expense: cashFlowType === 'expenses',
    };
  });
};

module.exports = {
  normalizeTransactionRuleMatchType,
  isManualCategoryRuleExcluded,
  transactionCategoryRuleMatches,
  findTransactionCategoryRule,
  applyTransactionCategoryRules,
};
