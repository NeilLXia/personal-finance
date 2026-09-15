'use strict';

const express = require('express');

const creditCardRewardsService = require('../services/creditCardRewardsService');
const { route } = require('../http/asyncRoute');
const { parseIdParam, rejectUnknownParams } = require('../http/requestParsers');
const { monthPattern } = require('../http/patterns');
const { mutationLimiter } = require('../middleware/rateLimiters');
const {
  createValidationError,
  validateBody,
  validateInteger,
  validateNumber,
  validateQuery,
  validateString,
} = require('../middleware/validation');

const router = express.Router();
const CREDIT_CARD_REWARDS_PARAMS = new Set(['month']);
const FREQUENCY_PERIODS = new Set(['per_year', 'per_quarter', 'per_month']);
const FREQUENCY_LIMITS = {
  per_year: 24,
  per_quarter: 6,
  per_month: 2,
};
const MONTH_BY_NAME = new Map(
  [
    ['january', '01'],
    ['jan', '01'],
    ['february', '02'],
    ['feb', '02'],
    ['march', '03'],
    ['mar', '03'],
    ['april', '04'],
    ['apr', '04'],
    ['may', '05'],
    ['june', '06'],
    ['jun', '06'],
    ['july', '07'],
    ['jul', '07'],
    ['august', '08'],
    ['aug', '08'],
    ['september', '09'],
    ['sept', '09'],
    ['sep', '09'],
    ['october', '10'],
    ['oct', '10'],
    ['november', '11'],
    ['nov', '11'],
    ['december', '12'],
    ['dec', '12'],
  ],
);
const toMonthDate = (month) => `2000-${month}-01`;

const normalizeMonthValue = (value, field, { required = false } = {}) => {
  const monthValue = validateString(value, field, {
    required,
    maxLength: 9,
  });

  if (monthValue === undefined || monthValue === null) {
    return monthValue;
  }

  const monthOnlyMatch = /^(0[1-9]|1[0-2])$/.exec(monthValue);
  if (monthOnlyMatch) {
    return monthOnlyMatch[1];
  }

  const yearMonthMatch = /^\d{4}-(0[1-9]|1[0-2])$/.exec(monthValue);
  if (yearMonthMatch) {
    return yearMonthMatch[1];
  }

  const monthName = MONTH_BY_NAME.get(monthValue.toLowerCase());
  if (monthName) {
    return monthName;
  }

  throw createValidationError(`${field} is invalid.`);
};

const validateArray = (value, field) => {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw createValidationError(`${field} must be an array.`);
  }

  return value;
};

const validateOptionalId = (value, field) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return validateInteger(value, field, { min: 1 });
};

const validateSelectedMonth = (value) =>
  validateString(value, 'selected_month', {
    required: false,
    pattern: monthPattern,
  });

const parseCreditCardRewardsQuery = (request) =>
  validateQuery(request, (query) => {
    rejectUnknownParams(query, CREDIT_CARD_REWARDS_PARAMS);

    return {
      selectedMonth: validateString(query.month, 'month', {
        required: false,
        pattern: monthPattern,
      }),
    };
  });

const validateFrequencyPeriod = (value, field) => {
  const period = validateString(value, field, {
    required: true,
    maxLength: 20,
  });

  if (!FREQUENCY_PERIODS.has(period)) {
    throw createValidationError(`${field} is invalid.`);
  }

  return period;
};

const validateEarningRewards = ({ rewards }) =>
  validateArray(rewards, 'earning_rewards').map((reward, index) => {
    const field = `earning_rewards[${index}]`;
    if (!reward || typeof reward !== 'object' || Array.isArray(reward)) {
      throw createValidationError(`${field} must be an object.`);
    }

    return {
      id: validateOptionalId(reward.id, `${field}.id`),
      category: validateString(reward.category, `${field}.category`, {
        required: true,
        maxLength: 120,
      }),
      rewardPercent: validateNumber(
        reward.reward_percent,
        `${field}.reward_percent`,
        { min: 0, max: 100 },
      ) || 0,
      keywords: validateString(reward.keywords, `${field}.keywords`, {
        required: false,
        maxLength: 500,
      }) || null,
    };
  });

const validatePerkAwards = ({ awards }) =>
  validateArray(awards, 'perk_awards').map((award, index) => {
    const field = `perk_awards[${index}]`;
    if (!award || typeof award !== 'object' || Array.isArray(award)) {
      throw createValidationError(`${field} must be an object.`);
    }

    const frequencyPeriod = validateFrequencyPeriod(
      award.frequency_period,
      `${field}.frequency_period`,
    );
    const frequencyCount = validateInteger(
      award.frequency_count,
      `${field}.frequency_count`,
      { min: 1, max: FREQUENCY_LIMITS[frequencyPeriod] },
    );

    return {
      id: validateOptionalId(award.id, `${field}.id`),
      name: validateString(award.name, `${field}.name`, {
        required: true,
        maxLength: 160,
      }),
      dollarValue: validateNumber(award.dollar_value, `${field}.dollar_value`, {
        required: true,
        min: 0,
        max: 1000000,
        nullable: false,
      }),
      completionAmount: 0,
      frequencyCount,
      frequencyPeriod,
      autoComplete: Boolean(award.auto_complete),
    };
  });

router.get(
  '/credit-card-rewards',
  route(async (request, response) => {
    const query = parseCreditCardRewardsQuery(request);

    response.json(
      await creditCardRewardsService.getCreditCardRewards({
        selectedMonth: query.selectedMonth,
      }),
    );
  }),
);

router.post(
  '/credit-card-rewards/card-types',
  mutationLimiter,
  route(async (request, response) => {
    const body = validateBody(request, (value) => ({
      name: validateString(value.name, 'name', {
        required: true,
        maxLength: 120,
      }),
      annualFee: validateNumber(value.annual_fee, 'annual_fee', {
        required: true,
        min: 0,
        max: 10000,
        nullable: false,
      }),
      earningRewards: validateEarningRewards({
        rewards: value.earning_rewards,
      }),
      perkAwards: validatePerkAwards({
        awards: value.perk_awards,
      }),
      selectedMonth: validateSelectedMonth(value.selected_month),
    }));

    response.json(await creditCardRewardsService.createCreditCardType(body));
  }),
);

router.put(
  '/credit-card-rewards/card-types/:id',
  mutationLimiter,
  route(async (request, response) => {
    const body = validateBody(request, (value) => ({
      name: validateString(value.name, 'name', {
        required: true,
        maxLength: 120,
      }),
      annualFee: validateNumber(value.annual_fee, 'annual_fee', {
        required: true,
        min: 0,
        max: 10000,
        nullable: false,
      }),
      earningRewards: validateEarningRewards({
        rewards: value.earning_rewards,
      }),
      perkAwards: validatePerkAwards({
        awards: value.perk_awards,
      }),
      selectedMonth: validateSelectedMonth(value.selected_month),
    }));

    response.json(
      await creditCardRewardsService.updateCreditCardType({
        cardTypeId: parseIdParam(request),
        ...body,
      }),
    );
  }),
);

router.delete(
  '/credit-card-rewards/card-types/:id',
  mutationLimiter,
  route(async (request, response) => {
    const query = parseCreditCardRewardsQuery(request);

    response.json(
      await creditCardRewardsService.deleteCreditCardType({
        cardTypeId: parseIdParam(request),
        selectedMonth: query.selectedMonth,
      }),
    );
  }),
);

router.put(
  '/credit-card-rewards/accounts/:id',
  mutationLimiter,
  route(async (request, response) => {
    const body = validateBody(request, (value) => {
      const creditCardTypeId = validateOptionalId(
        value.credit_card_type_id,
        'credit_card_type_id',
      );
      const effectiveMonth = creditCardTypeId
        ? normalizeMonthValue(value.effective_month, 'effective_month', {
            required: true,
          })
        : null;

      return {
        creditCardTypeId,
        effectiveMonth,
        selectedMonth: validateSelectedMonth(value.selected_month),
      };
    });

    response.json(
      await creditCardRewardsService.setAccountCreditCardType({
        accountId: parseIdParam(request),
        creditCardTypeId: body.creditCardTypeId,
        effectiveMonth: body.effectiveMonth
          ? toMonthDate(body.effectiveMonth)
          : null,
        selectedMonth: body.selectedMonth,
      }),
    );
  }),
);

router.put(
  '/credit-card-rewards/accounts/:id/perk-completions',
  mutationLimiter,
  route(async (request, response) => {
    const body = validateBody(request, (value) => {
      if (typeof value.completed !== 'boolean') {
        throw createValidationError('completed must be a boolean.');
      }

      return {
        perkAwardId: validateInteger(value.perk_award_id, 'perk_award_id', {
          min: 1,
        }),
        occurrenceIndex: validateInteger(
          value.occurrence_index,
          'occurrence_index',
          { min: 0 },
        ),
        completed: value.completed,
        selectedMonth: validateSelectedMonth(value.selected_month),
      };
    });

    response.json(
      await creditCardRewardsService.setPerkCompletion({
        accountId: parseIdParam(request),
        perkAwardId: body.perkAwardId,
        occurrenceIndex: body.occurrenceIndex,
        completed: body.completed,
        selectedMonth: body.selectedMonth,
      }),
    );
  }),
);

module.exports = router;
