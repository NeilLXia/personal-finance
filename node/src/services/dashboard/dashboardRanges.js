'use strict';

const moment = require('moment');

const { httpError } = require('../../lib/httpError');

const trailingRangeMonths = new Set(['1', '3', '6', '12']);

const parseCustomDateRange = ({
  startDate,
  endDate,
  defaultStartDate,
  defaultEndDate,
}) => {
  const parsedStartDate = startDate
    ? moment(startDate, 'YYYY-MM-DD', true)
    : defaultStartDate.clone();
  const parsedEndDate = endDate
    ? moment(endDate, 'YYYY-MM-DD', true)
    : defaultEndDate.clone();

  if (!parsedStartDate.isValid() || !parsedEndDate.isValid()) {
    throw httpError(400, 'Custom date ranges must use YYYY-MM-DD dates');
  }

  if (parsedStartDate.isAfter(parsedEndDate)) {
    throw httpError(400, 'Custom date range start date must be before end date');
  }

  return {
    startDate: parsedStartDate.startOf('day'),
    endDate: parsedEndDate.endOf('day'),
  };
};

/**
 * Shared trailing-window math for the dashboard's two selectable ranges. Given a
 * range selector (`1|3|6|12|custom`) it returns the resolved start/end moments,
 * the trailing-month count, and a display label. The income-allocation and
 * transaction wrappers below only differ in their response envelope.
 */
const resolveDateRange = ({ selectedMonth, range, startDate, endDate }) => {
  const trailingMonths = trailingRangeMonths.has(String(range))
    ? Number(range)
    : 1;
  const defaultEndDate = selectedMonth.clone().endOf('month');
  const defaultStartDate = selectedMonth
    .clone()
    .subtract(trailingMonths - 1, 'months')
    .startOf('month');

  if (range === 'custom') {
    const custom = parseCustomDateRange({
      startDate,
      endDate,
      defaultStartDate,
      defaultEndDate,
    });

    return {
      isCustom: true,
      trailingMonths,
      startDate: custom.startDate,
      endDate: custom.endDate,
      label: `${custom.startDate.format('MMM D, YYYY')} - ${custom.endDate.format('MMM D, YYYY')}`,
    };
  }

  return {
    isCustom: false,
    trailingMonths,
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    label:
      trailingMonths === 1
        ? selectedMonth.format('MMMM YYYY')
        : `${trailingMonths} months ending ${selectedMonth.format('MMMM YYYY')}`,
  };
};

const getIncomeAllocationRange = ({
  selectedMonth,
  incomeAllocationRange,
  incomeAllocationStartDate,
  incomeAllocationEndDate,
}) => {
  const resolved = resolveDateRange({
    selectedMonth,
    range: incomeAllocationRange || '1',
    startDate: incomeAllocationStartDate,
    endDate: incomeAllocationEndDate,
  });

  return {
    key: resolved.isCustom ? 'custom' : String(resolved.trailingMonths),
    years: [],
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    label: resolved.label,
  };
};

const getTransactionRange = ({
  selectedMonth,
  transactionRange,
  transactionStartDate,
  transactionEndDate,
}) => {
  const resolved = resolveDateRange({
    selectedMonth,
    range: transactionRange,
    startDate: transactionStartDate,
    endDate: transactionEndDate,
  });

  return {
    key: resolved.isCustom ? 'custom' : resolved.trailingMonths,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    label: resolved.label,
  };
};

module.exports = {
  getIncomeAllocationRange,
  getTransactionRange,
};
