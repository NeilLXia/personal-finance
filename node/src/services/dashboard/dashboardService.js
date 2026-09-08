'use strict';

const moment = require('moment');

const models = require('../../models');
const {
  refreshAccountBalanceSnapshots,
} = require('../plaid/accountBalanceSnapshotService');
const {
  applyTransactionCategoryRules,
} = require('../transactions/categoryRules');
const {
  getIncomeAllocationRange,
  getTransactionRange,
} = require('./dashboardRanges');
const {
  buildBalanceSummary,
  buildIncomeAllocationSummary,
  buildMonthlyCashFlow,
  buildTransactionsView,
  cashFlowCategories,
  formatBudgetTargets,
} = require('./dashboardBuilders');
const { buildNetWorthSummary } = require('./netWorthSummary');
const { resolveDashboardContext } = require('./dashboardContext');

/**
 * When the dashboard is showing the current month, make sure every linked item
 * has a balance snapshot for it; refresh and return fresh accounts if not.
 * No-op for past months, accountless users, and demo users.
 */
const ensureCurrentMonthBalances = async ({
  user,
  plaidItems,
  accounts,
  dashboardMonth,
  dashboardMonthStart,
}) => {
  const isCurrentMonth = dashboardMonth.isSame(moment(), 'month');

  if (!isCurrentMonth || accounts.length === 0 || user.is_demo) {
    return accounts;
  }

  const snapshotChecks = await Promise.all(
    plaidItems.map((plaidItem) =>
      models.accountBalanceHistory.hasMonthlySnapshotsForPlaidItemId({
        plaidItemId: plaidItem.plaid_item_id,
        balanceMonth: dashboardMonthStart,
      }),
    ),
  );

  if (snapshotChecks.every(Boolean)) {
    return accounts;
  }

  const { accounts: refreshedAccounts } = await refreshAccountBalanceSnapshots({
    balanceDate: moment().format('YYYY-MM-DD'),
  });

  return refreshedAccounts;
};

const buildIncomeAllocationView = async ({
  userId,
  plaidEnvironment,
  incomeAllocationDateRange,
}) => {
  const rangeStart = incomeAllocationDateRange.startDate.format('YYYY-MM-DD');
  const rangeEnd = incomeAllocationDateRange.endDate.format('YYYY-MM-DD');
  const [
    transactionCategoryRules,
    transactions,
    payslips,
    realEstatePrincipalHistory,
    availableYears,
  ] = await Promise.all([
    models.transactionCategoryRules.findByUserId(userId),
    models.dashboardReports.findCashFlowTransactionsByUserIdAndEnvironment({
      userId,
      plaidEnvironment,
      startDate: rangeStart,
      endDate: rangeEnd,
    }),
    models.payslips.findByUserIdAndDateRange({
      userId,
      startDate: rangeStart,
      endDate: rangeEnd,
    }),
    models.dashboardReports.findPropertyMonthlyPrincipalPaidByUserId(userId),
    models.dashboardReports.findTransactionYearsByUserIdAndEnvironment({
      userId,
      plaidEnvironment,
    }),
  ]);
  const categorizedTransactions = applyTransactionCategoryRules(
    transactions,
    transactionCategoryRules,
  );
  const incomeAllocationSummary = buildIncomeAllocationSummary({
    transactions: categorizedTransactions,
    realEstatePrincipalHistory,
    incomeAllocationDateRange,
  });

  return {
    range: incomeAllocationDateRange.key,
    years: incomeAllocationDateRange.years,
    available_years: availableYears,
    start_date: rangeStart,
    end_date: rangeEnd,
    label: incomeAllocationDateRange.label,
    income: incomeAllocationSummary.income,
    expenses: incomeAllocationSummary.expenses,
    savings: incomeAllocationSummary.savings,
    real_estate_equity: incomeAllocationSummary.real_estate_equity,
    transactions: categorizedTransactions,
    payslips,
  };
};

const getDashboard = async ({
  month,
  incomeAllocationRange,
  incomeAllocationStartDate,
  incomeAllocationEndDate,
  transactionRange,
  transactionStartDate,
  transactionEndDate,
} = {}) => {
  const { user, dashboardPlaidEnv, dashboardMonth } =
    await resolveDashboardContext({ month });

  const cashFlowStart = dashboardMonth
    .clone()
    .subtract(11, 'months')
    .startOf('month');
  const cashFlowEnd = dashboardMonth.clone().endOf('month');
  const dashboardMonthStart = dashboardMonth.format('YYYY-MM-DD');
  const dashboardMonthEnd = dashboardMonth
    .clone()
    .endOf('month')
    .format('YYYY-MM-DD');
  const incomeAllocationDateRange = getIncomeAllocationRange({
    selectedMonth: dashboardMonth,
    incomeAllocationRange,
    incomeAllocationStartDate,
    incomeAllocationEndDate,
  });
  const transactionDateRange = getTransactionRange({
    selectedMonth: dashboardMonth,
    transactionRange,
    transactionStartDate,
    transactionEndDate,
  });
  const plaidItems = await models.plaidItems.findByUserIdAndEnvironment(
    user.id,
    dashboardPlaidEnv,
  );
  let accounts =
    plaidItems.length === 0
      ? []
      : await models.accounts.findByUserIdAndEnvironment(
          user.id,
          dashboardPlaidEnv,
        );

  accounts = await ensureCurrentMonthBalances({
    user,
    plaidItems,
    accounts,
    dashboardMonth,
    dashboardMonthStart,
  });

  const transactionRangeStartDate =
    transactionDateRange.startDate.format('YYYY-MM-DD');
  const transactionRangeEndDate =
    transactionDateRange.endDate.format('YYYY-MM-DD');

  const [
    monthlyTransactions,
    transactionCategoryRules,
    budgetTargets,
    transactionPayslips,
    incomeAllocation,
    cashFlowTransactions,
    realEstatePrincipalHistory,
    institutions,
    propertyHistory,
    currentPropertyValue,
    netWorthAccountHistory,
    propertyValuationHistory,
  ] = await Promise.all([
    models.transactions.findByUserIdEnvironmentAndDateRange({
      userId: user.id,
      plaidEnvironment: dashboardPlaidEnv,
      startDate: transactionRangeStartDate,
      endDate: transactionRangeEndDate,
    }),
    models.transactionCategoryRules.findByUserId(user.id),
    models.budgetTargets.findByUserId(user.id),
    models.payslips.findByUserIdAndDateRange({
      userId: user.id,
      startDate: transactionRangeStartDate,
      endDate: transactionRangeEndDate,
    }),
    buildIncomeAllocationView({
      userId: user.id,
      plaidEnvironment: dashboardPlaidEnv,
      incomeAllocationDateRange,
    }),
    models.dashboardReports.findCashFlowTransactionsByUserIdAndEnvironment({
      userId: user.id,
      plaidEnvironment: dashboardPlaidEnv,
      startDate: cashFlowStart.format('YYYY-MM-DD'),
      endDate: cashFlowEnd.format('YYYY-MM-DD'),
    }),
    models.dashboardReports.findPropertyMonthlyPrincipalPaidByUserId(user.id),
    models.plaidItems.findInstitutionStatusesByUserIdAndEnvironment(
      user.id,
      dashboardPlaidEnv,
    ),
    models.dashboardReports.findPropertyMonthlyHistoryByUserId(user.id),
    models.dashboardReports.findPropertyLatestTotalByUserId(user.id),
    models.dashboardReports.findNetWorthAccountHistoryByUserIdAndEnvironment(
      user.id,
      dashboardPlaidEnv,
    ),
    models.dashboardReports.findPropertyValuationHistoryByUserId(user.id),
  ]);

  const transactionsView = buildTransactionsView({
    transactionDateRange,
    transactions: monthlyTransactions,
    transactionCategoryRules,
    payslips: transactionPayslips,
  );
  const categorizedCashFlowTransactions = applyTransactionCategoryRules(
    cashFlowTransactions,
    transactionCategoryRules,
  );
  const balanceSummary = buildBalanceSummary(accounts);
  const netWorth = buildNetWorthSummary({
    accounts,
    propertyHistory,
    currentPropertyValue,
    netWorthAccountHistory,
    propertyValuationHistory,
    dashboardMonth,
    dashboardMonthEnd,
  });
  const monthlyCashFlow = buildMonthlyCashFlow({
    cashFlowStart,
    cashFlowEnd,
    transactions: categorizedCashFlowTransactions,
    realEstatePrincipalHistory,
  });

  return {
    institutions,
    dashboard_month: {
      start_date: dashboardMonthStart,
      end_date: dashboardMonthEnd,
      label: moment(dashboardMonthStart).format('MMMM YYYY'),
    },
    transaction_range: transactionsView.transaction_range,
    accounts,
    balance_summary: balanceSummary,
    net_worth: netWorth,
    monthly_cash_flow: {
      categories: cashFlowCategories,
      months: monthlyCashFlow,
    },
    income_allocation: incomeAllocation,
    budget_targets: formatBudgetTargets(budgetTargets),
    transaction_categories: transactionsView.transaction_categories,
    latest_transactions: transactionsView.latest_transactions,
    payslips: transactionsView.payslips,
  };
};

const getDashboardIncomeAllocation = async ({
  month,
  incomeAllocationRange,
  incomeAllocationStartDate,
  incomeAllocationEndDate,
} = {}) => {
  const { user, dashboardPlaidEnv, dashboardMonth } =
    await resolveDashboardContext({ month });
  const incomeAllocationDateRange = getIncomeAllocationRange({
    selectedMonth: dashboardMonth,
    incomeAllocationRange,
    incomeAllocationStartDate,
    incomeAllocationEndDate,
  });

  return {
    income_allocation: await buildIncomeAllocationView({
      userId: user.id,
      plaidEnvironment: dashboardPlaidEnv,
      incomeAllocationDateRange,
    }),
  };
};

const getDashboardTransactions = async ({
  month,
  transactionRange,
  transactionStartDate,
  transactionEndDate,
} = {}) => {
  const { user, dashboardPlaidEnv, dashboardMonth } =
    await resolveDashboardContext({ month });

  const transactionDateRange = getTransactionRange({
    selectedMonth: dashboardMonth,
    transactionRange,
    transactionStartDate,
    transactionEndDate,
  });
  const rangeStart = transactionDateRange.startDate.format('YYYY-MM-DD');
  const rangeEnd = transactionDateRange.endDate.format('YYYY-MM-DD');

  const [transactions, transactionCategoryRules, payslips] = await Promise.all([
    models.transactions.findByUserIdEnvironmentAndDateRange({
      userId: user.id,
      plaidEnvironment: dashboardPlaidEnv,
      startDate: rangeStart,
      endDate: rangeEnd,
    }),
    models.transactionCategoryRules.findByUserId(user.id),
    models.payslips.findByUserIdAndDateRange({
      userId: user.id,
      startDate: rangeStart,
      endDate: rangeEnd,
    }),
  ]);

  return buildTransactionsView({
    transactionDateRange,
    transactions,
    transactionCategoryRules,
    payslips,
  });
};

module.exports = {
  getDashboard,
  getDashboardIncomeAllocation,
  getDashboardTransactions,
};
