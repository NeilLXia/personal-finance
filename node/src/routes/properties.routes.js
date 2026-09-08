'use strict';

const express = require('express');

const addressSearchService = require('../services/addressSearchService');
const propertyService = require('../services/propertyService');
const { route } = require('../http/asyncRoute');
const {
  addressSearchLimiter,
  syncLimiter,
  mutationLimiter,
} = require('../middleware/rateLimiters');
const {
  validateBody,
  validateNumber,
  validateQuery,
  validateString,
} = require('../middleware/validation');
const { parseIdParam } = require('../http/requestParsers');
const { datePattern } = require('../http/patterns');

const router = express.Router();

router.get(
  '/properties',
  route(async (request, response) => {
    response.json(await propertyService.listProperties());
  }),
);

router.get(
  '/address-suggestions',
  addressSearchLimiter,
  route(async (request, response) => {
    const query = validateQuery(request, (value) => ({
      query: validateString(value.query, 'query', {
        required: true,
        maxLength: 256,
      }),
      sessionToken: validateString(value.session_token, 'session_token', {
        required: true,
        maxLength: 100,
        pattern: /^[A-Za-z0-9_-]+$/,
      }),
    }));

    response.json(
      await addressSearchService.searchAddressSuggestions({
        query: query.query,
        sessionToken: query.sessionToken,
      }),
    );
  }),
);

router.post(
  '/properties',
  mutationLimiter,
  route(async (request, response) => {
    const body = validateBody(request, (value) => ({
      address: validateString(value.address, 'address', {
        required: true,
        maxLength: 500,
      }),
      loanOriginalAmount: validateNumber(
        value.loan_original_amount,
        'loan_original_amount',
        { min: 0, max: 100000000 },
      ),
      loanAnnualInterestRate: validateNumber(
        value.loan_annual_interest_rate,
        'loan_annual_interest_rate',
        { min: 0, max: 50 },
      ),
      loanMonthlyPayment: validateNumber(
        value.loan_monthly_payment,
        'loan_monthly_payment',
        { min: 0, max: 1000000 },
      ),
      loanBalanceStartMonth: validateString(
        value.loan_balance_start_month,
        'loan_balance_start_month',
        { required: false, pattern: datePattern },
      ),
    }));

    response.json(
      await propertyService.addProperty({
        address: body.address,
        loanOriginalAmount: body.loanOriginalAmount,
        loanAnnualInterestRate: body.loanAnnualInterestRate,
        loanMonthlyPayment: body.loanMonthlyPayment,
        loanBalanceStartMonth: body.loanBalanceStartMonth,
      }),
    );
  }),
);

router.put(
  '/properties/:id',
  mutationLimiter,
  route(async (request, response) => {
    const body = validateBody(request, (value) => ({
      address: validateString(value.address, 'address', {
        required: true,
        maxLength: 500,
      }),
      loanOriginalAmount: validateNumber(
        value.loan_original_amount,
        'loan_original_amount',
        { min: 0, max: 100000000 },
      ),
      loanAnnualInterestRate: validateNumber(
        value.loan_annual_interest_rate,
        'loan_annual_interest_rate',
        { min: 0, max: 50 },
      ),
      loanMonthlyPayment: validateNumber(
        value.loan_monthly_payment,
        'loan_monthly_payment',
        { min: 0, max: 1000000 },
      ),
      loanBalanceStartMonth: validateString(
        value.loan_balance_start_month,
        'loan_balance_start_month',
        { required: false, pattern: datePattern },
      ),
    }));

    response.json(
      await propertyService.updateProperty({
        propertyId: parseIdParam(request),
        address: body.address,
        loanOriginalAmount: body.loanOriginalAmount,
        loanAnnualInterestRate: body.loanAnnualInterestRate,
        loanMonthlyPayment: body.loanMonthlyPayment,
        loanBalanceStartMonth: body.loanBalanceStartMonth,
      }),
    );
  }),
);

router.delete(
  '/properties/:id',
  mutationLimiter,
  route(async (request, response) => {
    response.json(await propertyService.deleteProperty(parseIdParam(request)));
  }),
);

router.post(
  '/properties/refresh',
  syncLimiter,
  route(async (request, response) => {
    response.json(await propertyService.refreshProperties());
  }),
);

router.post(
  '/properties/:id/refresh',
  syncLimiter,
  route(async (request, response) => {
    response.json(
      await propertyService.refreshPropertyById(parseIdParam(request)),
    );
  }),
);

module.exports = router;
