'use strict';

const moment = require('moment');

const models = require('../../models');
const { httpError } = require('../../lib/httpError');
const {
  applyTransactionCategoryRules,
} = require('../transactions/categoryRules');
const {
  buildIncomeAllocationSummary,
} = require('../dashboard/dashboardBuilders');
const {
  getManualCashFlowTransactionType,
  getSavingsCashFlowAmount,
} = require('../transactions/cashFlowClassification');
const {
  getDashboardPlaidEnvironment,
} = require('../dashboard/dashboardContext');
const {
  getCurrentNetWorth,
  getNetWorthAccounts,
} = require('../dashboard/netWorth');
const { getCurrentUser } = require('../authService');
const { buildRetirementProjection } = require('./projectionEngine');
const { roundMoney } = require('../../utils/money');

const parseNumber = (value) => {
  if (value == null || value === '') {
    return undefined;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw httpError(400, 'Retirement projection assumptions must be numeric.');
  }

  return number;
};

const parseSpendingStrategy = (query) => {
  if (query.retirement_spending_mode === 'fixed_amount') {
    return {
      mode: 'fixed_amount',
      annualAmount: parseNumber(query.annual_spending),
    };
  }

  if (query.retirement_spending_mode === 'percentage') {
    return {
      mode: 'percentage',
      percent: parseNumber(query.spending_percent),
    };
  }

  return { mode: 'projected_lifestyle' };
};

const parseSavingsStrategy = (query) => {
  if (query.savings_mode === 'fixed_amount') {
    return {
      mode: 'fixed_amount',
      annualAmount: parseNumber(query.annual_savings),
    };
  }

  if (query.savings_mode === 'percentage') {
    return {
      mode: 'percentage',
      percent: parseNumber(query.savings_percent),
    };
  }

  if (query.savings_mode === 'current_rate') {
    return { mode: 'current_rate' };
  }

  return { mode: 'projected_cashflow' };
};

const summarizeMortgage = (properties) => {
  const activeLoans = properties.filter(
    (property) =>
      Number(property.loan_balance || 0) > 0 ||
      Number(property.loan_monthly_payment || 0) > 0,
  );

  if (activeLoans.length === 0) {
    return {
      balance: 0,
      monthlyPayment: 0,
      annualInterestRate: 0,
      annualPayment: 0,
      source: 'unavailable',
    };
  }

  const balance = activeLoans.reduce(
    (total, property) => total + Number(property.loan_balance || 0),
    0,
  );
  const monthlyPayment = activeLoans.reduce(
    (total, property) => total + Number(property.loan_monthly_payment || 0),
    0,
  );
  const weightedInterest = activeLoans.reduce((total, property) => {
    const loanBalance = Number(property.loan_balance || 0);

    return (
      total +
      loanBalance * (Number(property.loan_annual_interest_rate || 0) / 100)
    );
  }, 0);
  const annualInterestRate = balance > 0 ? weightedInterest / balance : 0;

  return {
    balance,
    monthlyPayment,
    annualInterestRate,
    annualPayment: monthlyPayment * 12,
    source: 'calculated',
  };
};

const getPropertyEquityTotal = (properties) =>
  properties.reduce(
    (total, property) =>
      total +
      Number(property.estimated_value || 0) -
      Number(property.loan_balance || 0),
    0,
  );

const getPropertyValueTotal = (properties) =>
  properties.reduce(
    (total, property) => total + Number(property.estimated_value || 0),
    0,
  );

const getPropertyDebtTotal = (properties) =>
  properties.reduce(
    (total, property) => total + Number(property.loan_balance || 0),
    0,
  );

const getPayslipRetirementSavingsTotal = (payslips) =>
  roundMoney(
    payslips.reduce(
      (total, payslip) =>
        total +
        Number(payslip.pretax_401k || 0) +
        Number(payslip.pretax_401k_bonus_deferral || 0) +
        Number(payslip.posttax_401k_roth || 0) +
        Number(payslip.posttax_401k_bonus_deferral_roth || 0),
      0,
    ),
  );

const getPayslipGrossIncomeTotal = (payslips) =>
  roundMoney(
    payslips.reduce(
      (total, payslip) => total + Number(payslip.gross_pay || 0),
      0,
    ),
  );

const getPayslipNetIncomeTotal = (payslips) =>
  roundMoney(
    payslips.reduce(
      (total, payslip) => total + Number(payslip.net_pay || 0),
      0,
    ),
  );

const getPayslipTaxTotal = (payslips) =>
  roundMoney(
    payslips.reduce((total, payslip) => {
      const associateTaxes = Number(payslip.associate_taxes || 0);
      const lineItemTaxes =
        Number(payslip.social_security_tax || 0) +
        Number(payslip.medicare_tax || 0) +
        Number(payslip.federal_withholding_tax || 0) +
        Number(payslip.state_tax || 0) +
        Number(payslip.ca_disability_insurance_tax || 0);

      return total + (associateTaxes > 0 ? associateTaxes : lineItemTaxes);
    }, 0),
  );

const getAccountSavingsLabel = (transaction) => {
  const accountName = transaction.account_name || 'Account';
  const accountMask = transaction.account_mask
    ? ` ${transaction.account_mask}`
    : '';
  const institutionName = transaction.institution_name
    ? `${transaction.institution_name} - `
    : '';

  return `${institutionName}${accountName}${accountMask}`;
};

const buildCurrentSavingsBreakdown = ({
  transactions,
  currentRetirementSavings,
}) => {
  const savingsByAccount = transactions.reduce((summary, transaction) => {
    if (getManualCashFlowTransactionType(transaction) !== 'savings') {
      return summary;
    }

    const amount = getSavingsCashFlowAmount(transaction);

    if (amount === 0) {
      return summary;
    }

    const key = transaction.account_id || getAccountSavingsLabel(transaction);
    const existing = summary.get(key) || {
      key: String(key),
      label: getAccountSavingsLabel(transaction),
      annualAmount: 0,
    };

    existing.annualAmount = roundMoney(existing.annualAmount + amount);
    summary.set(key, existing);

    return summary;
  }, new Map());

  if (currentRetirementSavings > 0) {
    savingsByAccount.set('paystub_retirement_savings', {
      key: 'paystub_retirement_savings',
      label: 'Paystub retirement savings',
      annualAmount: roundMoney(currentRetirementSavings),
    });
  }

  return Array.from(savingsByAccount.values())
    .filter((item) => item.annualAmount !== 0)
    .sort((a, b) => Math.abs(b.annualAmount) - Math.abs(a.annualAmount));
};

const buildProjectionInputs = async (query = {}) => {
  const user = await getCurrentUser();

  if (user.account_type !== 'admin') {
    throw httpError(403, 'Admin access required.');
  }

  const plaidEnvironment = await getDashboardPlaidEnvironment(user);
  const endDate = moment().endOf('month');
  const startDate = endDate.clone().subtract(11, 'months').startOf('month');
  const [
    accounts,
    transactions,
    transactionCategoryRules,
    properties,
    payslips,
  ] = await Promise.all([
    models.accounts.findByUserIdAndEnvironment(user.id, plaidEnvironment),
    models.dashboardReports.findCashFlowTransactionsByUserIdAndEnvironment({
      userId: user.id,
      plaidEnvironment,
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
    }),
    models.transactionCategoryRules.findByUserId(user.id),
    models.properties.findWithLatestValuesByUserId(user.id),
    models.payslips.findByUserIdAndDateRange({
      userId: user.id,
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
    }),
  ]);
  const categorizedTransactions = applyTransactionCategoryRules(
    transactions,
    transactionCategoryRules,
  );
  const incomeAllocation = buildIncomeAllocationSummary({
    transactions: categorizedTransactions,
    realEstatePrincipalHistory: [],
    incomeAllocationDateRange: {
      startDate,
      endDate,
    },
  });
  const mortgage = summarizeMortgage(properties);
  const currentPortfolioAssets = getCurrentNetWorth(
    getNetWorthAccounts(accounts),
  );
  const currentRealEstateValue = getPropertyValueTotal(properties);
  const currentRealEstateDebt = getPropertyDebtTotal(properties);
  const currentRealEstateEquity = getPropertyEquityTotal(properties);
  const currentAssets = currentPortfolioAssets + currentRealEstateEquity;
  const currentRetirementSavings = getPayslipRetirementSavingsTotal(payslips);
  const currentSavingsBreakdown = buildCurrentSavingsBreakdown({
    transactions: categorizedTransactions,
    currentRetirementSavings,
  });
  const currentSavings = roundMoney(
    incomeAllocation.savings + currentRetirementSavings,
  );
  const currentSavingsIncome = roundMoney(
    incomeAllocation.income + currentRetirementSavings,
  );
  const currentGrossIncome = getPayslipGrossIncomeTotal(payslips);
  const currentNetPay = getPayslipNetIncomeTotal(payslips);
  const currentTaxes = getPayslipTaxTotal(payslips);
  const estimatedGrossIncome =
    currentGrossIncome > 0
      ? currentGrossIncome
      : roundMoney(currentSavingsIncome / 0.72);
  const estimatedTaxes =
    currentTaxes > 0 ? currentTaxes : roundMoney(estimatedGrossIncome * 0.28);
  const estimatedNetPay =
    currentNetPay > 0
      ? currentNetPay
      : roundMoney(estimatedGrossIncome - estimatedTaxes);
  const currentOtherIncome = roundMoney(
    Math.max(0, incomeAllocation.income - estimatedNetPay),
  );

  return {
    currentAge: parseNumber(query.current_age),
    retirementAge: parseNumber(query.retirement_age),
    projectionEndAge: parseNumber(query.projection_end_age),
    currentIncome: incomeAllocation.income,
    currentGrossIncome: estimatedGrossIncome,
    currentGrossPay: estimatedGrossIncome,
    currentTaxes: estimatedTaxes,
    currentOtherIncome,
    currentExpenses: incomeAllocation.expenses,
    currentAssets,
    currentPortfolioAssets,
    currentRealEstateValue,
    currentRealEstateDebt,
    currentRealEstateEquity,
    currentCashSavings: incomeAllocation.savings,
    currentRetirementSavings,
    currentSavings,
    currentSavingsBreakdown,
    currentSavingsIncome,
    annualContributions: currentSavings,
    inflationRate: parseNumber(query.inflation_rate),
    wageGrowthMode: query.wage_growth_mode === 'nominal' ? 'nominal' : 'real',
    realWageGrowthRate: parseNumber(query.real_wage_growth_rate),
    annualWageIncrease: parseNumber(query.annual_wage_increase),
    lifestyleGrowthRate: parseNumber(query.lifestyle_growth_rate),
    realEstateGrowthRate: parseNumber(query.real_estate_growth_rate),
    mortgage,
    socialSecurity: {
      startAge: parseNumber(query.social_security_age),
    },
    retirementSpending: parseSpendingStrategy(query),
    savingsStrategy: parseSavingsStrategy(query),
    investmentAssumptions: {
      accumulationReturn: parseNumber(query.accumulation_return),
      leadingBucketYears: parseNumber(query.leading_bucket_years),
      leadingBucketReturn: parseNumber(query.leading_bucket_return),
    },
    provenance: {
      currentIncome: 'calculated',
      currentExpenses: 'calculated',
      currentAssets: 'calculated',
      annualContributions: 'calculated',
      currentRetirementSavings: payslips.length > 0 ? 'paystub' : 'unavailable',
      mortgage: mortgage.source,
      socialSecurity: currentGrossIncome > 0 ? 'paystub' : 'estimated',
    },
  };
};

const getRetirementProjection = async (query = {}) =>
  buildRetirementProjection(await buildProjectionInputs(query));

module.exports = {
  buildProjectionInputs,
  getRetirementProjection,
};
