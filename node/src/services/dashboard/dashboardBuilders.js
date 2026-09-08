'use strict';

const moment = require('moment');
const {
  getManualCashFlowTransactionType,
  getSavingsCashFlowAmount,
} = require('../transactions/cashFlowClassification');
const {
  applyTransactionCategoryRules,
} = require('../transactions/categoryRules');
const {
  summarizeTransactionsByCategory,
} = require('../transactions/transactionCategory');
const {
  serializeBudgetTarget,
} = require('../budgetTargets/serializeBudgetTarget');
const {
  absMoney,
  addMoney,
  negateMoney,
  roundMoney,
} = require('../../utils/money');

const shapeTransactionRange = (transactionDateRange) => ({
  range: transactionDateRange.key,
  start_date: transactionDateRange.startDate.format('YYYY-MM-DD'),
  end_date: transactionDateRange.endDate.format('YYYY-MM-DD'),
  label: transactionDateRange.label,
});

/**
 * The transaction slice both dashboard endpoints return: category rules applied,
 * the range shaped, and expenses summarized by category. `getDashboard` folds
 * these four keys into its larger payload; `getDashboardTransactions` returns
 * them directly.
 */
const buildTransactionsView = ({
  transactionDateRange,
  transactions,
  transactionCategoryRules,
  payslips,
}) => {
  const latestTransactions = applyTransactionCategoryRules(
    transactions,
    transactionCategoryRules,
  );

  return {
    transaction_range: shapeTransactionRange(transactionDateRange),
    transaction_categories: summarizeTransactionsByCategory(
      latestTransactions.filter((transaction) => transaction.is_expense),
    ),
    latest_transactions: latestTransactions,
    payslips,
  };
};

const cashFlowCategories = [
  { key: 'expenses', label: 'Expenses' },
  { key: 'real_estate_equity', label: 'Real estate equity' },
  { key: 'savings', label: 'Savings' },
];

const buildBalanceSummary = (accounts) => ({
  current: addMoney(...accounts.map((account) => account.balance_current)),
  available: addMoney(...accounts.map((account) => account.balance_available)),
});

const buildMonthlyCashFlow = ({
  cashFlowStart,
  cashFlowEnd,
  transactions,
  realEstatePrincipalHistory,
}) => {
  const monthlyCashFlowByMonth = {};

  for (
    let month = cashFlowStart.clone();
    month.isSameOrBefore(cashFlowEnd);
    month.add(1, 'month')
  ) {
    const monthKey = month.format('YYYY-MM');
    monthlyCashFlowByMonth[monthKey] = {
      month: monthKey,
      label: month.format('MMM YYYY'),
      income: 0,
      expenses: 0,
      savings: 0,
      real_estate_equity: 0,
      total: 0,
    };
  }

  transactions.forEach((transaction) => {
    const monthKey = moment(transaction.manual_date || transaction.date).format(
      'YYYY-MM',
    );
    const month = monthlyCashFlowByMonth[monthKey];
    const transactionType = getManualCashFlowTransactionType(transaction);

    if (!month || !transactionType) {
      return;
    }

    const amount = roundMoney(transaction.amount);

    if (transactionType === 'expenses') {
      month.expenses = addMoney(
        month.expenses,
        amount > 0 ? negateMoney(amount) : absMoney(amount),
      );
    }

    if (transactionType === 'savings') {
      month.savings = addMoney(
        month.savings,
        getSavingsCashFlowAmount(transaction),
      );
    }

    if (transactionType === 'income') {
      month.income = addMoney(month.income, absMoney(amount));
    }
  });

  realEstatePrincipalHistory.forEach((snapshot) => {
    const monthKey = moment(snapshot.valuation_month).format('YYYY-MM');
    const month = monthlyCashFlowByMonth[monthKey];

    if (month) {
      month.real_estate_equity = addMoney(
        month.real_estate_equity,
        snapshot.principal_paid,
      );
    }
  });

  return Object.values(monthlyCashFlowByMonth).map((month) => {
    const roundedMonth = {
      ...month,
      income: roundMoney(month.income),
      expenses: roundMoney(month.expenses),
      savings: roundMoney(month.savings),
      real_estate_equity: roundMoney(month.real_estate_equity),
    };

    return {
      ...roundedMonth,
      total: addMoney(
        roundedMonth.expenses,
        roundedMonth.savings,
        roundedMonth.real_estate_equity,
      ),
    };
  });
};

const buildIncomeAllocationSummary = ({
  transactions,
  realEstatePrincipalHistory,
  incomeAllocationDateRange,
}) => {
  const summary = transactions.reduce(
    (incomeAllocationSummary, transaction) => {
      const transactionType = getManualCashFlowTransactionType(transaction);

      if (!transactionType) {
        return incomeAllocationSummary;
      }

      const amount = roundMoney(transaction.amount);

      if (transactionType === 'expenses') {
        incomeAllocationSummary.expenses = addMoney(
          incomeAllocationSummary.expenses,
          amount > 0 ? amount : negateMoney(absMoney(amount)),
        );
      }

      if (transactionType === 'savings') {
        incomeAllocationSummary.savings = addMoney(
          incomeAllocationSummary.savings,
          getSavingsCashFlowAmount(transaction),
        );
      }

      if (transactionType === 'income') {
        incomeAllocationSummary.income = addMoney(
          incomeAllocationSummary.income,
          absMoney(amount),
        );
      }

      return incomeAllocationSummary;
    },
    {
      income: 0,
      expenses: 0,
      savings: 0,
      real_estate_equity: 0,
    },
  );

  realEstatePrincipalHistory.forEach((snapshot) => {
    const valuationMonth = moment(snapshot.valuation_month);

    if (
      valuationMonth.isBefore(incomeAllocationDateRange.startDate, 'month') ||
      valuationMonth.isAfter(incomeAllocationDateRange.endDate, 'month')
    ) {
      return;
    }

    summary.real_estate_equity = addMoney(
      summary.real_estate_equity,
      snapshot.principal_paid,
    );
  });

  return {
    income: roundMoney(summary.income),
    expenses: roundMoney(summary.expenses),
    savings: roundMoney(summary.savings),
    real_estate_equity: roundMoney(summary.real_estate_equity),
  };
};

const formatBudgetTargets = (budgetTargets) =>
  budgetTargets.map(serializeBudgetTarget);

module.exports = {
  buildBalanceSummary,
  buildIncomeAllocationSummary,
  buildMonthlyCashFlow,
  buildTransactionsView,
  cashFlowCategories,
  formatBudgetTargets,
  shapeTransactionRange,
};
