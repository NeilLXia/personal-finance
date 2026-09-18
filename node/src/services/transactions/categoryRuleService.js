'use strict';

const models = require('../../models');
const { httpError } = require('../../lib/httpError');
const { getCurrentUser } = require('../authService');
const {
  canonicalizeExpenseCategory,
  normalizeCategoryRuleText,
  normalizeTransactionVendorRuleText,
} = require('./transactionCategory');
const {
  normalizeTransactionRuleMatchType,
} = require('./categoryRules');

// The router (transactions.routes.js#categoryRuleBody) has already checked that
// originalCategory / vendorName / manualCategory are present, trimmed, and within
// length; this only derives the normalized lookup keys the model needs.
const buildTransactionCategoryRuleInput = ({
  originalCategory,
  vendorName,
  matchType,
  manualCategory,
}) => {
  const cleanManualCategory = canonicalizeExpenseCategory(manualCategory);

  return {
    originalCategory,
    originalCategoryKey: normalizeCategoryRuleText(originalCategory),
    vendorName,
    vendorNameKey: normalizeTransactionVendorRuleText(vendorName),
    matchType: normalizeTransactionRuleMatchType(matchType),
    manualCategory: cleanManualCategory,
  };
};

const getTransactionCategoryRules = async () => {
  const user = await getCurrentUser();

  return {
    rules: await models.transactionCategoryRules.findByUserId(user.id),
  };
};

const createTransactionCategoryRule = async ({
  originalCategory,
  vendorName,
  matchType,
  manualCategory,
}) => {
  const user = await getCurrentUser();
  const ruleInput = buildTransactionCategoryRuleInput({
    originalCategory,
    vendorName,
    matchType,
    manualCategory,
  });

  return {
    rule: await models.transactionCategoryRules.upsert({
      userId: user.id,
      ...ruleInput,
    }),
  };
};

const updateTransactionCategoryRule = async ({
  id,
  originalCategory,
  vendorName,
  matchType,
  manualCategory,
}) => {
  const user = await getCurrentUser();
  const ruleInput = buildTransactionCategoryRuleInput({
    originalCategory,
    vendorName,
    matchType,
    manualCategory,
  });
  let rule = null;

  try {
    rule = await models.transactionCategoryRules.updateByIdForUserId({
      id,
      userId: user.id,
      ...ruleInput,
    });
  } catch (error) {
    if (error.code !== '23505') {
      throw error;
    }

    rule = await models.transactionCategoryRules.upsert({
      userId: user.id,
      ...ruleInput,
    });

    if (Number(rule.id) !== Number(id)) {
      await models.transactionCategoryRules.deleteByIdForUserId({
        id,
        userId: user.id,
      });
    }
  }

  if (!rule) {
    throw httpError(404, 'Transaction category rule was not found');
  }

  return { rule };
};

const deleteTransactionCategoryRule = async ({ id }) => {
  const user = await getCurrentUser();

  await models.transactionCategoryRules.deleteByIdForUserId({
    id,
    userId: user.id,
  });

  return { removed: true };
};

module.exports = {
  getTransactionCategoryRules,
  createTransactionCategoryRule,
  updateTransactionCategoryRule,
  deleteTransactionCategoryRule,
};
