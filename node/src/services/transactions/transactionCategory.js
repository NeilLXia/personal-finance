'use strict';

// Category derivation, normalization, and per-category aggregation.
// Cash-flow typing lives in ./cashFlowClassification; user rules in ./categoryRules.

const {
  absMoney,
  addMoney,
  negateMoney,
  roundMoney,
} = require('../../utils/money');

const getTransactionProfile = (transaction) => {
  const category = (transaction.category || '').toLowerCase();
  const name =
    `${transaction.name || ''} ${transaction.merchant_name || ''}`.toLowerCase();
  const transactionText = [
    category,
    name,
    transaction.account_name,
    transaction.institution_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const accountType = (transaction.account_type || '').toLowerCase();
  const accountSubtype = (transaction.account_subtype || '').toLowerCase();
  const isVenmo = transactionText.includes('venmo');
  const isVenmoAccount = [
    transaction.account_name,
    transaction.institution_name,
    accountSubtype,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes('venmo');
  const isVenmoStandardTransfer =
    isVenmoAccount &&
    (name.includes('standard transfer') ||
      transactionText.includes('standard transfer'));
  const isVenmoExternalTransfer = isVenmo && !isVenmoAccount;

  return {
    category,
    name,
    transactionText,
    accountType,
    accountSubtype,
    isVenmo,
    isVenmoAccount,
    isVenmoStandardTransfer,
    isVenmoExternalTransfer,
  };
};

const getAutomaticManualCategory = (transaction) => {
  const { isVenmoStandardTransfer, isVenmoExternalTransfer } =
    getTransactionProfile(transaction);

  if (isVenmoStandardTransfer || isVenmoExternalTransfer) {
    return 'Transfers';
  }

  return null;
};

const getTransactionCategory = (transaction) =>
  transaction.category && transaction.category.trim()
    ? transaction.category
    : 'Uncategorized';

const canonicalizeExpenseCategory = (category) => {
  const cleanCategory = (category || '').trim();
  const categoryParts = cleanCategory
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  return categoryParts.includes('restaurants') ||
    cleanCategory.toLowerCase() === 'restaurants'
    ? 'Dining'
    : cleanCategory;
};

const normalizeCategoryRuleText = (value) =>
  canonicalizeExpenseCategory(value).toLowerCase();

const normalizeBudgetCategoryKey = normalizeCategoryRuleText;

const getTransactionVendorName = (transaction) =>
  transaction.merchant_name || transaction.name || 'Unknown vendor';

const normalizeTransactionVendorRuleText = (value) => {
  const normalizedValue = normalizeCategoryRuleText(value)
    .replace(/\s+web id:\s*\d+\b/g, '')
    .replace(/\b[a-z]{0,3}\d{4,}[a-z0-9]*\b/g, '')
    .replace(/\b(?:bac|ca|jpm)[a-z0-9]{8,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalizedValue || normalizeCategoryRuleText(value);
};

const summarizeTransactionsByCategory = (transactions) => {
  const categoriesByName = transactions.reduce((categories, transaction) => {
    const category = canonicalizeExpenseCategory(
      transaction.display_category ||
        transaction.manual_category ||
        getTransactionCategory(transaction),
    );

    if (!categories[category]) {
      categories[category] = {
        category,
        amount: 0,
        count: 0,
      };
    }

    const amount = roundMoney(transaction.amount);
    categories[category].amount = addMoney(
      categories[category].amount,
      amount > 0 ? negateMoney(amount) : absMoney(amount),
    );
    categories[category].count += 1;

    return categories;
  }, {});

  return Object.values(categoriesByName)
    .map((category) => ({
      ...category,
      amount: roundMoney(category.amount),
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
};

module.exports = {
  getTransactionProfile,
  getAutomaticManualCategory,
  getTransactionCategory,
  canonicalizeExpenseCategory,
  normalizeCategoryRuleText,
  normalizeBudgetCategoryKey,
  getTransactionVendorName,
  normalizeTransactionVendorRuleText,
  summarizeTransactionsByCategory,
};
