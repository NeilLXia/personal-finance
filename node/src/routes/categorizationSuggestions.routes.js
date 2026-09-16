'use strict';

const express = require('express');

const {
  approveCategorizationSuggestions,
  createCategorizationBatch,
  dismissCategorizationSuggestion,
  getSuggestionResponse,
} = require('../services/categorization/categorizationAssistantService');
const { route } = require('../http/asyncRoute');
const { parseIdParam } = require('../http/requestParsers');
const { monthPattern } = require('../http/patterns');
const { mutationLimiter } = require('../middleware/rateLimiters');
const {
  createValidationError,
  validateBody,
  validateInteger,
  validateString,
} = require('../middleware/validation');

const router = express.Router();
const scopePattern = /^(user_only|user_and_starter_patterns)$/;

const validateSuggestionIds = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw createValidationError('suggestion_ids is required.');
  }

  return value.map((id, index) =>
    validateInteger(id, `suggestion_ids[${index}]`, { min: 1 }),
  );
};

const validateCategoryOverrides = (value) => {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw createValidationError('category_overrides must be an object.');
  }

  return Object.fromEntries(
    Object.entries(value).map(([suggestionId, category]) => [
      String(validateInteger(Number(suggestionId), 'category_overrides key', {
        min: 1,
      })),
      validateString(category, `category_overrides.${suggestionId}`, {
        required: true,
        maxLength: 120,
      }),
    ]),
  );
};

router.post(
  '/categorization-suggestions/batches',
  mutationLimiter,
  route(async (request, response) => {
    const body = validateBody(request, (value) => ({
      month: validateString(value.month, 'month', {
        required: true,
        pattern: monthPattern,
      }),
      scope: validateString(value.scope, 'scope', {
        required: false,
        pattern: scopePattern,
      }) || 'user_only',
    }));

    response.json(await createCategorizationBatch(body));
  }),
);

router.get(
  '/categorization-suggestions/batches/:id',
  route(async (request, response) => {
    response.json(await getSuggestionResponse({ batchId: parseIdParam(request) }));
  }),
);

router.post(
  '/categorization-suggestions/batches/:id/approve',
  mutationLimiter,
  route(async (request, response) => {
    const batchId = parseIdParam(request);
    const body = validateBody(request, (value) => ({
      suggestionIds: validateSuggestionIds(value.suggestion_ids),
      categoryOverrides: validateCategoryOverrides(value.category_overrides),
    }));

    response.json(
      await approveCategorizationSuggestions({ batchId, ...body }),
    );
  }),
);

router.post(
  '/categorization-suggestions/:id/approve',
  mutationLimiter,
  route(async (request, response) => {
    const suggestionId = parseIdParam(request);
    const body = validateBody(request, (value) => ({
      categoryOverrides: value.manual_category
        ? { [suggestionId]: validateString(value.manual_category, 'manual_category', {
            required: true,
            maxLength: 120,
          }) }
        : {},
    }));

    response.json(
      await approveCategorizationSuggestions({
        suggestionIds: [suggestionId],
        categoryOverrides: body.categoryOverrides,
      }),
    );
  }),
);

router.post(
  '/categorization-suggestions/:id/dismiss',
  mutationLimiter,
  route(async (request, response) => {
    response.json(
      await dismissCategorizationSuggestion({
        suggestionId: parseIdParam(request),
      }),
    );
  }),
);

module.exports = router;
