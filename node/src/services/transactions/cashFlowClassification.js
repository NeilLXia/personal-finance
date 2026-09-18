'use strict';

// Classifies a transaction's cash-flow effect: 'income' | 'expenses' | 'savings'
// | null (transfers / credit-card payments / no effect).

const { absMoney, negateMoney, roundMoney } = require('../../utils/money');
const {
  getTransactionProfile,
  getAutomaticManualCategory,
  normalizeCategoryRuleText,
} = require('./transactionCategory');

const investmentDestinationPatterns = [
  'acorns',
  'betterment',
  'charles schwab',
  'coinbase',
  'crypto.com',
  'e-trade',
  'etrade',
  'fidelity',
  'gemini',
  'ibkr',
  'interactive brokers',
  'm1 finance',
  'principal',
  'public.com',
  'robinhood',
  'schwab',
  'sofi invest',
  'tastytrade',
  'td ameritrade',
  'tiaa',
  'vanguard',
  'wealthfront',
];

const equityAccountSubtypes = ['brokerage', 'crypto', '401k', 'ira', 'roth', 'hsa'];

const isEquityLikeAccount = (transaction) => {
  const accountType = (transaction.account_type || '').toLowerCase();
  const accountSubtype = (transaction.account_subtype || '').toLowerCase();

  return (
    accountType === 'investment' ||
    equityAccountSubtypes.includes(accountSubtype)
  );
};

const getCashFlowTransactionType = (transaction) => {
  const amount = roundMoney(transaction.amount);
  const {
    category,
    name,
    accountType,
    accountSubtype,
    isVenmo,
    isVenmoStandardTransfer,
    isVenmoExternalTransfer,
  } = getTransactionProfile(transaction);
  const isCreditCardPayment =
    category.includes('credit card') ||
    name.includes('credit card payment') ||
    name.includes('cc payment') ||
    name.includes('card payment');
  const isTransfer =
    category.includes('transfer') ||
    category.includes('loan payments') ||
    name.includes('transfer') ||
    name.includes('payment thank you');
  const isInvestmentDestination = investmentDestinationPatterns.some((pattern) =>
    name.includes(pattern),
  );
  const isInvestmentCategory = category.includes(
    'financial planning and investments',
  );
  const isEquityAccount =
    accountType === 'investment' ||
    equityAccountSubtypes.includes(accountSubtype);
  const isSpendingAccount =
    accountType === 'depository' ||
    accountType === 'credit' ||
    ['checking', 'venmo', 'paypal'].includes(accountSubtype);

  if (isCreditCardPayment) {
    return null;
  }

  if (isVenmoExternalTransfer) {
    return null;
  }

  if (isVenmoStandardTransfer) {
    return null;
  }

  if (isEquityAccount && Math.abs(amount) > 0) {
    return 'savings';
  }

  if (
    isSpendingAccount &&
    amount > 0 &&
    (isInvestmentDestination || isInvestmentCategory)
  ) {
    return 'savings';
  }

  if (isTransfer && !isVenmo) {
    return null;
  }

  if (isSpendingAccount && amount > 0) {
    return 'expenses';
  }

  if (isVenmo && amount < 0) {
    return 'expenses';
  }

  if (isSpendingAccount && amount < 0) {
    return 'income';
  }

  return null;
};

const getSavingsCashFlowAmount = (transaction) => {
  const amount = roundMoney(transaction.amount);

  if (isEquityLikeAccount(transaction)) {
    return amount > 0 ? negateMoney(amount) : absMoney(amount);
  }

  return amount > 0 ? amount : negateMoney(absMoney(amount));
};

const getManualCashFlowTransactionType = (transaction) => {
  const manualCategory = normalizeCategoryRuleText(
    transaction.manual_category || transaction.display_category,
  );

  if (
    manualCategory &&
    !['income', 'savings', 'transfers'].includes(manualCategory)
  ) {
    return 'expenses';
  }

  if (manualCategory === 'income') {
    return 'income';
  }

  if (manualCategory === 'savings') {
    return 'savings';
  }

  if (manualCategory === 'transfers') {
    return null;
  }

  if (getAutomaticManualCategory(transaction) === 'Transfers') {
    return null;
  }

  return getCashFlowTransactionType(transaction);
};

module.exports = {
  isEquityLikeAccount,
  getCashFlowTransactionType,
  getSavingsCashFlowAmount,
  getManualCashFlowTransactionType,
};
