'use strict';

const express = require('express');

const {
  backfillAllTransactions,
  syncCurrentTransactions,
} = require('../services/plaid/transactionSyncService');
const {
  saveManualTransactionCategory,
  saveManualTransactionDate,
} = require('../services/transactions/transactionEditService');
const {
  createTransactionCategoryRule,
  deleteTransactionCategoryRule,
  getTransactionCategoryRules,
  updateTransactionCategoryRule,
} = require('../services/transactions/categoryRuleService');
const { route } = require('../http/asyncRoute');
const { syncLimiter, mutationLimiter } = require('../middleware/rateLimiters');
const { validateBody, validateString } = require('../middleware/validation');
const { parseIdParam } = require('../http/requestParsers');
const { datePattern, matchTypePattern } = require('../http/patterns');

const categoryRuleBody = (value) => ({
  originalCategory: validateString(value.original_category, 'original_category', {
    required: true,
    maxLength: 200,
  }),
  vendorName: validateString(value.vendor_name, 'vendor_name', {
    required: true,
    maxLength: 200,
  }),
  matchType: validateString(value.match_type, 'match_type', {
    required: false,
    pattern: matchTypePattern,
  }),
  manualCategory: validateString(value.manual_category, 'manual_category', {
    required: true,
    maxLength: 120,
  }),
});

const router = express.Router();

router.post(
  '/transactions/sync',
  syncLimiter,
  route(async (request, response) => {
    response.json(await syncCurrentTransactions());
  }),
);

router.post(
  '/transactions/backfill',
  syncLimiter,
  route(async (request, response) => {
    response.json(await backfillAllTransactions());
  }),
);

router.post(
  '/transactions/:id/category-rule',
  mutationLimiter,
  route(async (request, response) => {
    const transactionId = parseIdParam(request);
    const body = validateBody(request, (value) => ({
      manualCategory: validateString(value.manual_category, 'manual_category', {
        required: true,
        maxLength: 120,
      }),
    }));

    response.json(
      await saveManualTransactionCategory({
        transactionId,
        manualCategory: body.manualCategory,
      }),
    );
  }),
);

router.post(
  '/transactions/:id/manual-date',
  mutationLimiter,
  route(async (request, response) => {
    const transactionId = parseIdParam(request);
    const body = validateBody(request, (value) => ({
      manualDate: validateString(value.manual_date, 'manual_date', {
        required: true,
        pattern: datePattern,
      }),
    }));

    response.json(
      await saveManualTransactionDate({
        transactionId,
        manualDate: body.manualDate,
      }),
    );
  }),
);

router.get(
  '/transaction-category-rules',
  route(async (request, response) => {
    response.json(await getTransactionCategoryRules());
  }),
);

router.post(
  '/transaction-category-rules',
  mutationLimiter,
  route(async (request, response) => {
    const body = validateBody(request, categoryRuleBody);

    response.json(
      await createTransactionCategoryRule({
        originalCategory: body.originalCategory,
        vendorName: body.vendorName,
        matchType: body.matchType,
        manualCategory: body.manualCategory,
      }),
    );
  }),
);

router.put(
  '/transaction-category-rules/:id',
  mutationLimiter,
  route(async (request, response) => {
    const id = parseIdParam(request);
    const body = validateBody(request, categoryRuleBody);

    response.json(
      await updateTransactionCategoryRule({
        id,
        originalCategory: body.originalCategory,
        vendorName: body.vendorName,
        matchType: body.matchType,
        manualCategory: body.manualCategory,
      }),
    );
  }),
);

router.delete(
  '/transaction-category-rules/:id',
  mutationLimiter,
  route(async (request, response) => {
    response.json(
      await deleteTransactionCategoryRule({
        id: parseIdParam(request),
      }),
    );
  }),
);

module.exports = router;
