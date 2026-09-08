'use strict';

const moment = require('moment');

const { getNetWorthBalance, getNetWorthCategory } = require('./netWorth');
const { addMoney, roundMoney } = require('../../utils/money');

/**
 * Bucket account balance snapshots by day, dropping anything after the dashboard
 * month so a past-month view never picks up more recent balances.
 */
const bucketAccountSnapshotsByDate = (
  netWorthAccountHistory,
  dashboardMonthEnd,
) =>
  netWorthAccountHistory.reduce((snapshotsByDate, snapshot) => {
    const date = moment(snapshot.balance_date).format('YYYY-MM-DD');

    if (date > dashboardMonthEnd) {
      return snapshotsByDate;
    }

    if (!snapshotsByDate[date]) {
      snapshotsByDate[date] = [];
    }

    snapshotsByDate[date].push(snapshot);
    return snapshotsByDate;
  }, {});

const bucketPropertyHistoryByDate = (propertyHistory) =>
  propertyHistory.reduce((historyByDate, snapshot) => {
    const date = moment(snapshot.valuation_month).format('YYYY-MM-DD');
    historyByDate[date] = roundMoney(snapshot.real_estate);
    return historyByDate;
  }, {});

const getNetWorthHistoryDates = ({
  accountSnapshotsByDate,
  propertyHistoryByDate,
  dashboardMonthEnd,
}) =>
  Array.from(
    new Set([
      ...Object.keys(accountSnapshotsByDate),
      ...Object.keys(propertyHistoryByDate),
    ]),
  )
    .filter((date) => date <= dashboardMonthEnd)
    .sort((a, b) => a.localeCompare(b));

const getLatestBreakdownDateByMonth = (netWorthHistoryDates) =>
  netWorthHistoryDates.reduce((datesByMonth, date) => {
    const monthKey = moment(date).format('YYYY-MM');

    if (!datesByMonth[monthKey] || date > datesByMonth[monthKey]) {
      datesByMonth[monthKey] = date;
    }

    return datesByMonth;
  }, {});

/**
 * Walk the history dates in order, carrying forward the latest known balance per
 * account and property so each point reflects everything seen up to that date.
 */
const buildHistoricalNetWorthPoints = ({
  netWorthHistoryDates,
  accountSnapshotsByDate,
  propertyHistoryByDate,
}) => {
  const latestAccountBalancesById = {};
  let latestRealEstateValue = 0;

  return netWorthHistoryDates.map((date) => {
    (accountSnapshotsByDate[date] || []).forEach((snapshot) => {
      latestAccountBalancesById[snapshot.id] = {
        category: getNetWorthCategory(snapshot),
        balance: roundMoney(snapshot.balance),
      };
    });

    if (propertyHistoryByDate[date] !== undefined) {
      latestRealEstateValue = propertyHistoryByDate[date];
    }

    const latestAccountBreakdown = Object.values(
      latestAccountBalancesById,
    ).reduce(
      (breakdown, account) => {
        breakdown[account.category] = addMoney(
          breakdown[account.category],
          account.balance,
        );
        return breakdown;
      },
      {
        cash: 0,
        personal_equity: 0,
        tax_advantaged: 0,
        other_assets: 0,
      },
    );

    return {
      date,
      ...latestAccountBreakdown,
      real_estate: latestRealEstateValue,
      total: addMoney(
        latestAccountBreakdown.cash,
        latestAccountBreakdown.personal_equity,
        latestAccountBreakdown.tax_advantaged,
        latestAccountBreakdown.other_assets,
        latestRealEstateValue,
      ),
    };
  });
};

/**
 * Fallback single point built from live account balances, used when there is no
 * snapshot history to chart yet.
 */
const buildCurrentNetWorthPoint = ({
  netWorthAccounts,
  currentNetWorth,
  currentPropertyValue,
}) => ({
  date: moment().format('YYYY-MM-DD'),
  ...netWorthAccounts.reduce(
    (totals, account) => {
      const category = getNetWorthCategory(account);
      totals[category] = addMoney(totals[category], getNetWorthBalance(account));
      return totals;
    },
    {
      cash: 0,
      personal_equity: 0,
      tax_advantaged: 0,
      real_estate: roundMoney(currentPropertyValue),
      other_assets: 0,
    },
  ),
  total: addMoney(currentNetWorth, currentPropertyValue),
});

const buildNetWorthHistory = (params) =>
  params.netWorthHistoryDates.length > 0
    ? buildHistoricalNetWorthPoints(params)
    : [buildCurrentNetWorthPoint(params)];

module.exports = {
  bucketAccountSnapshotsByDate,
  bucketPropertyHistoryByDate,
  buildNetWorthHistory,
  getLatestBreakdownDateByMonth,
  getNetWorthHistoryDates,
};
