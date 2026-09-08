'use strict';

const {
  getCurrentNetWorth,
  getNetWorthAccounts,
  netWorthCategoryLabels,
  netWorthCategoryOrder,
} = require('./netWorth');
const {
  bucketAccountSnapshotsByDate,
  bucketPropertyHistoryByDate,
  buildNetWorthHistory,
  getLatestBreakdownDateByMonth,
  getNetWorthHistoryDates,
} = require('./netWorthHistory');
const { buildNetWorthBreakdown } = require('./netWorthBreakdown');
const { addMoney, roundMoney } = require('../../utils/money');

/**
 * Fold the working breakdown into the API response shape, rounding every balance
 * and restricting item balances to the displayed dates.
 */
const shapeNetWorthSummary = ({
  netWorthBreakdown,
  netWorthHistoryPoints,
  selectedBreakdownDate,
  displayedNetWorthBreakdownDates,
}) => ({
  current: roundMoney(
    selectedBreakdownDate
      ? netWorthCategoryOrder.reduce(
          (total, key) =>
            addMoney(
              total,
              roundMoney(netWorthBreakdown[key].balances[selectedBreakdownDate]),
            ),
          0,
        )
      : 0,
  ),
  categories: netWorthCategoryOrder.map((key) => ({
    key,
    label: netWorthCategoryLabels[key],
  })),
  history: netWorthHistoryPoints,
  breakdown_dates: displayedNetWorthBreakdownDates,
  breakdown: netWorthCategoryOrder.map((key) => ({
    ...netWorthBreakdown[key],
    total: roundMoney(
      selectedBreakdownDate
        ? netWorthBreakdown[key].balances[selectedBreakdownDate] || 0
        : 0,
    ),
    balances: Object.fromEntries(
      displayedNetWorthBreakdownDates.map((date) => [
        date,
        roundMoney(netWorthBreakdown[key].balances[date] || 0),
      ]),
    ),
    items: netWorthBreakdown[key].items.map((item) => ({
      ...item,
      balances: Object.fromEntries(
        displayedNetWorthBreakdownDates.map((date) => [
          date,
          item.balances[date] === undefined
            ? null
            : roundMoney(item.balances[date]),
        ]),
      ),
    })),
  })),
});

const buildNetWorthSummary = ({
  accounts,
  propertyHistory,
  currentPropertyValue,
  netWorthAccountHistory,
  propertyValuationHistory,
  dashboardMonth,
  dashboardMonthEnd,
}) => {
  const netWorthAccounts = getNetWorthAccounts(accounts);
  const currentNetWorth = getCurrentNetWorth(netWorthAccounts);

  const accountSnapshotsByDate = bucketAccountSnapshotsByDate(
    netWorthAccountHistory,
    dashboardMonthEnd,
  );
  const propertyHistoryByDate = bucketPropertyHistoryByDate(propertyHistory);

  const netWorthHistoryDates = getNetWorthHistoryDates({
    accountSnapshotsByDate,
    propertyHistoryByDate,
    dashboardMonthEnd,
  });
  const latestBreakdownDateByMonth =
    getLatestBreakdownDateByMonth(netWorthHistoryDates);
  const selectedBreakdownDate =
    latestBreakdownDateByMonth[dashboardMonth.format('YYYY-MM')] || null;
  const displayedNetWorthBreakdownDates = selectedBreakdownDate
    ? [selectedBreakdownDate]
    : [];

  const netWorthHistoryPoints = buildNetWorthHistory({
    netWorthHistoryDates,
    accountSnapshotsByDate,
    propertyHistoryByDate,
    netWorthAccounts,
    currentNetWorth,
    currentPropertyValue,
  });

  const netWorthBreakdown = buildNetWorthBreakdown({
    netWorthAccountHistory,
    propertyValuationHistory,
    selectedBreakdownDate,
    latestBreakdownDateByMonth,
  });

  return shapeNetWorthSummary({
    netWorthBreakdown,
    netWorthHistoryPoints,
    selectedBreakdownDate,
    displayedNetWorthBreakdownDates,
  });
};

module.exports = {
  buildNetWorthSummary,
};
