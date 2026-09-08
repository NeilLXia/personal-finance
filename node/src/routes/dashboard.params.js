'use strict';

const { validateQuery, validateString } = require('../middleware/validation');
const {
  rejectUnknownParams,
  parseDateWindow,
} = require('../http/requestParsers');
const { monthPattern, rangePattern } = require('../http/patterns');

const DASHBOARD_PARAMS = new Set([
  'month',
  'income_allocation_range',
  'income_allocation_start_date',
  'income_allocation_end_date',
  'transaction_range',
  'transaction_start_date',
  'transaction_end_date',
]);
const TRANSACTION_PARAMS = new Set([
  'month',
  'transaction_range',
  'transaction_start_date',
  'transaction_end_date',
]);
const INCOME_ALLOCATION_PARAMS = new Set([
  'month',
  'income_allocation_range',
  'income_allocation_start_date',
  'income_allocation_end_date',
]);

const parseMonth = (query) =>
  validateString(query.month, 'month', {
    pattern: monthPattern,
    required: false,
  });

const parseTransactionFilters = (query) => {
  const range = validateString(query.transaction_range, 'transaction_range', {
    pattern: rangePattern,
    required: false,
  });
  const { startDate, endDate } = parseDateWindow(
    query,
    'transaction',
    'transaction_range',
    range,
  );

  return {
    transactionRange: range,
    transactionStartDate: startDate,
    transactionEndDate: endDate,
  };
};

const parseIncomeAllocationFilters = (query) => {
  const range = validateString(
    query.income_allocation_range,
    'income_allocation_range',
    { pattern: rangePattern, required: false },
  );
  const { startDate, endDate } = parseDateWindow(
    query,
    'income_allocation',
    'income_allocation_range',
    range,
  );

  return {
    incomeAllocationRange: range,
    incomeAllocationStartDate: startDate,
    incomeAllocationEndDate: endDate,
  };
};

const parseDashboardQuery = (request) =>
  validateQuery(request, (query) => {
    rejectUnknownParams(query, DASHBOARD_PARAMS);

    return {
      month: parseMonth(query),
      ...parseIncomeAllocationFilters(query),
      ...parseTransactionFilters(query),
    };
  });

const parseTransactionQuery = (request) =>
  validateQuery(request, (query) => {
    rejectUnknownParams(query, TRANSACTION_PARAMS);

    return {
      month: parseMonth(query),
      ...parseTransactionFilters(query),
    };
  });

const parseIncomeAllocationQuery = (request) =>
  validateQuery(request, (query) => {
    rejectUnknownParams(query, INCOME_ALLOCATION_PARAMS);

    return {
      month: parseMonth(query),
      ...parseIncomeAllocationFilters(query),
    };
  });

module.exports = {
  DASHBOARD_PARAMS,
  INCOME_ALLOCATION_PARAMS,
  TRANSACTION_PARAMS,
  parseDashboardQuery,
  parseIncomeAllocationQuery,
  parseTransactionQuery,
};
