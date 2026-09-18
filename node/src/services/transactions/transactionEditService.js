'use strict';

const moment = require('moment');

const models = require('../../models');
const { httpError } = require('../../lib/httpError');
const { getCurrentUser } = require('../authService');
const {
  canonicalizeExpenseCategory,
  getTransactionCategory,
  getTransactionVendorName,
  normalizeCategoryRuleText,
  normalizeTransactionVendorRuleText,
} = require('./transactionCategory');
const {
  isManualCategoryRuleExcluded,
} = require('./categoryRules');

const notFound = () =>
  httpError(404, 'Transaction was not found for the current user');

const saveManualTransactionCategory = async ({
  transactionId,
  manualCategory,
}) => {
  const user = await getCurrentUser();
  const transaction = await models.transactions.findByIdForUserId({
    id: transactionId,
    userId: user.id,
  });

  if (!transaction) {
    throw notFound();
  }

  // manual_category is required + length-checked by the router.
  const cleanManualCategory = canonicalizeExpenseCategory(manualCategory);

  await models.transactions.updateManualCategoryForUserId({
    id: transactionId,
    userId: user.id,
    manualCategory: cleanManualCategory,
  });

  let rule = null;

  if (!isManualCategoryRuleExcluded(transaction)) {
    rule = await models.transactionCategoryRules.upsert({
      userId: user.id,
      originalCategory: getTransactionCategory(transaction),
      originalCategoryKey: normalizeCategoryRuleText(
        getTransactionCategory(transaction),
      ),
      vendorName: getTransactionVendorName(transaction),
      vendorNameKey: normalizeTransactionVendorRuleText(
        getTransactionVendorName(transaction),
      ),
      manualCategory: cleanManualCategory,
    });
  }

  return {
    rule,
    transaction: {
      ...transaction,
      original_category: getTransactionCategory(transaction),
      manual_category: cleanManualCategory,
      display_category: cleanManualCategory,
    },
  };
};

const saveManualTransactionDate = async ({ transactionId, manualDate }) => {
  const user = await getCurrentUser();
  const transaction = await models.transactions.findByIdForUserId({
    id: transactionId,
    userId: user.id,
  });

  if (!transaction) {
    throw notFound();
  }

  // The router guarantees YYYY-MM-DD shape; this rejects impossible calendar
  // dates that still match the pattern (e.g. 2025-02-31).
  const cleanManualDate = (manualDate || '').trim();

  if (cleanManualDate && !moment(cleanManualDate, 'YYYY-MM-DD', true).isValid()) {
    throw httpError(400, 'Manual date must be a valid YYYY-MM-DD date');
  }

  const normalizedManualDate =
    cleanManualDate &&
    cleanManualDate !== moment(transaction.date).format('YYYY-MM-DD')
      ? cleanManualDate
      : null;

  const updatedTransaction = await models.transactions.updateManualDateForUserId({
    id: transactionId,
    userId: user.id,
    manualDate: normalizedManualDate,
  });

  return {
    transaction: {
      ...transaction,
      ...updatedTransaction,
    },
  };
};

module.exports = {
  saveManualTransactionCategory,
  saveManualTransactionDate,
};
