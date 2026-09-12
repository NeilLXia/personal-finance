'use strict';

const moment = require('moment');

const { getNetWorthBalance, getNetWorthCategory } = require('./netWorth');
const { addMoney, roundMoney, subtractMoney } = require('../../utils/money');

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

const getPreviousMonthKey = (monthKey) =>
  moment(`${monthKey}-01`).subtract(1, 'month').format('YYYY-MM');

const hasSnapshotBalance = (balance) =>
  balance !== null && balance !== undefined && balance !== '';

const collectLatestMonthlyBalancesById = ({
  snapshotsByDate,
  getId,
  getBalance,
  getCategory,
}) =>
  Object.entries(snapshotsByDate).reduce(
    (balancesByMonth, [date, snapshots]) => {
      const monthKey = moment(date).format('YYYY-MM');

      if (!balancesByMonth[monthKey]) {
        balancesByMonth[monthKey] = {};
      }

      snapshots.forEach((snapshot) => {
        const id = getId(snapshot);
        const balance = getBalance(snapshot);
        const existingSnapshot = balancesByMonth[monthKey][id];

        if (!hasSnapshotBalance(balance)) {
          return;
        }

        if (existingSnapshot && existingSnapshot.date > date) {
          return;
        }

        balancesByMonth[monthKey][id] = {
          date,
          balance: roundMoney(balance),
          category: getCategory(snapshot),
        };
      });

      return balancesByMonth;
    },
    {},
  );

const emptyCategoryChanges = () => ({
  cash: 0,
  personal_equity: 0,
  tax_advantaged: 0,
  real_estate: 0,
  other_assets: 0,
});

const calculateMonthlyMatchedBalanceChanges = (balancesByMonth) =>
  Object.keys(balancesByMonth).reduce((changesByMonth, monthKey) => {
    const previousMonthBalances =
      balancesByMonth[getPreviousMonthKey(monthKey)];

    if (!previousMonthBalances) {
      changesByMonth[monthKey] = 0;
      return changesByMonth;
    }

    changesByMonth[monthKey] = Object.entries(balancesByMonth[monthKey]).reduce(
      (total, [id, currentSnapshot]) => {
        const previousSnapshot = previousMonthBalances[id];

        if (!previousSnapshot) {
          return total;
        }

        return addMoney(
          total,
          subtractMoney(currentSnapshot.balance, previousSnapshot.balance),
        );
      },
      0,
    );

    return changesByMonth;
  }, {});

const calculateMonthlyMatchedBalanceChangesByCategory = (balancesByMonth) =>
  Object.keys(balancesByMonth).reduce((changesByMonth, monthKey) => {
    const previousMonthBalances =
      balancesByMonth[getPreviousMonthKey(monthKey)];
    const categoryChanges = emptyCategoryChanges();

    if (!previousMonthBalances) {
      changesByMonth[monthKey] = categoryChanges;
      return changesByMonth;
    }

    Object.entries(balancesByMonth[monthKey]).forEach(
      ([id, currentSnapshot]) => {
        const previousSnapshot = previousMonthBalances[id];

        if (!previousSnapshot) {
          return;
        }

        categoryChanges[currentSnapshot.category] = addMoney(
          categoryChanges[currentSnapshot.category],
          subtractMoney(currentSnapshot.balance, previousSnapshot.balance),
        );
      },
    );

    changesByMonth[monthKey] = categoryChanges;
    return changesByMonth;
  }, {});

const getMonthlyAccountBalances = (accountSnapshotsByDate) =>
  collectLatestMonthlyBalancesById({
    snapshotsByDate: accountSnapshotsByDate,
    getId: (snapshot) => snapshot.id,
    getBalance: (snapshot) => snapshot.balance,
    getCategory: getNetWorthCategory,
  });

const getMonthlyRealEstateBalances = (propertyHistoryByDate) =>
  collectLatestMonthlyBalancesById({
    snapshotsByDate: Object.fromEntries(
      Object.entries(propertyHistoryByDate).map(([date, balance]) => [
        date,
        [{ balance }],
      ]),
    ),
    getId: () => 'real_estate',
    getBalance: (snapshot) => snapshot.balance,
    getCategory: () => 'real_estate',
  });

const getMonthlyMatchedBalanceChanges = ({
  accountSnapshotsByDate,
  propertyHistoryByDate,
}) => {
  const accountBalancesByMonth = getMonthlyAccountBalances(
    accountSnapshotsByDate,
  );
  const realEstateBalancesByMonth = getMonthlyRealEstateBalances(
    propertyHistoryByDate,
  );
  const accountChangesByMonth = calculateMonthlyMatchedBalanceChanges(
    accountBalancesByMonth,
  );
  const realEstateChangesByMonth = calculateMonthlyMatchedBalanceChanges(
    realEstateBalancesByMonth,
  );
  const accountCategoryChangesByMonth =
    calculateMonthlyMatchedBalanceChangesByCategory(accountBalancesByMonth);
  const realEstateCategoryChangesByMonth =
    calculateMonthlyMatchedBalanceChangesByCategory(realEstateBalancesByMonth);

  return Array.from(
    new Set([
      ...Object.keys(accountChangesByMonth),
      ...Object.keys(realEstateChangesByMonth),
    ]),
  ).reduce(
    (changesByMonth, monthKey) => {
      const categoryChanges = emptyCategoryChanges();

      Object.entries(accountCategoryChangesByMonth[monthKey] || {}).forEach(
        ([category, value]) => {
          categoryChanges[category] = addMoney(
            categoryChanges[category],
            value,
          );
        },
      );
      Object.entries(realEstateCategoryChangesByMonth[monthKey] || {}).forEach(
        ([category, value]) => {
          categoryChanges[category] = addMoney(
            categoryChanges[category],
            value,
          );
        },
      );

      changesByMonth.totals[monthKey] = addMoney(
        accountChangesByMonth[monthKey],
        realEstateChangesByMonth[monthKey],
      );
      changesByMonth.categories[monthKey] = categoryChanges;
      return changesByMonth;
    },
    { totals: {}, categories: {} },
  );
};

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
  const monthlyMatchedBalanceChanges = getMonthlyMatchedBalanceChanges({
    accountSnapshotsByDate,
    propertyHistoryByDate,
  });

  return netWorthHistoryDates.map((date) => {
    const monthKey = moment(date).format('YYYY-MM');

    (accountSnapshotsByDate[date] || []).forEach((snapshot) => {
      if (!hasSnapshotBalance(snapshot.balance)) {
        return;
      }

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
      balance_change: roundMoney(monthlyMatchedBalanceChanges.totals[monthKey]),
      balance_changes:
        monthlyMatchedBalanceChanges.categories[monthKey] ||
        emptyCategoryChanges(),
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
      totals[category] = addMoney(
        totals[category],
        getNetWorthBalance(account),
      );
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
  balance_change: 0,
  balance_changes: emptyCategoryChanges(),
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
