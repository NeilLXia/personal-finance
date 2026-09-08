'use strict';

const { addMoney, negateMoney, roundMoney } = require('../../utils/money');

const netWorthCategoryLabels = {
  cash: 'Cash',
  personal_equity: 'Personal equity',
  tax_advantaged: 'Tax-advantaged equity',
  real_estate: 'Real estate',
  other_assets: 'Other assets',
};

const netWorthCategoryOrder = [
  'cash',
  'personal_equity',
  'tax_advantaged',
  'real_estate',
  'other_assets',
];

const taxAdvantagedInvestmentSubtypes = new Set([
  '401a',
  '401k',
  '403b',
  '457b',
  '529',
  'hsa',
  'ira',
  'keogh',
  'pension',
  'profit sharing plan',
  'retirement',
  'roth',
  'roth 401k',
  'sep ira',
  'simple ira',
  'sipp',
  'thrift savings plan',
]);

const getNetWorthCategory = (account) => {
  const accountType = (account.type || '').toLowerCase();
  const accountSubtype = (account.subtype || '').toLowerCase();

  if (accountType === 'depository' || accountType === 'credit') {
    return 'cash';
  }

  if (accountType !== 'investment') {
    return 'other_assets';
  }

  if (taxAdvantagedInvestmentSubtypes.has(accountSubtype)) {
    return 'tax_advantaged';
  }

  if (accountSubtype === 'brokerage') {
    return 'personal_equity';
  }

  return 'other_assets';
};

const getNetWorthBalance = (account) => {
  const accountType = (account.type || '').toLowerCase();
  const balance = roundMoney(account.balance_current);

  return accountType === 'credit' ? negateMoney(balance) : balance;
};

// Account types that roll up into net worth (property equity is added separately).
const NET_WORTH_ACCOUNT_TYPES = ['depository', 'investment', 'credit'];

const getNetWorthAccounts = (accounts) =>
  accounts.filter((account) => NET_WORTH_ACCOUNT_TYPES.includes(account.type));

const getCurrentNetWorth = (netWorthAccounts) =>
  netWorthAccounts.reduce(
    (total, account) => addMoney(total, getNetWorthBalance(account)),
    0,
  );

const createEmptyNetWorthBreakdown = () =>
  netWorthCategoryOrder.reduce((breakdown, key) => {
    breakdown[key] = {
      key,
      label: netWorthCategoryLabels[key],
      total: 0,
      balances: {},
      items: [],
    };
    return breakdown;
  }, {});

const addNetWorthBreakdownBalance = ({
  breakdown,
  category,
  item,
  date,
  balance,
}) => {
  if (!date) {
    return;
  }

  if (!breakdown[category]) {
    return;
  }

  breakdown[category].balances[date] = addMoney(
    breakdown[category].balances[date],
    balance,
  );

  if (!item.balances) {
    item.balances = {};
  }

  item.balances[date] = addMoney(item.balances[date], balance);
};

module.exports = {
  addNetWorthBreakdownBalance,
  createEmptyNetWorthBreakdown,
  getCurrentNetWorth,
  getNetWorthAccounts,
  getNetWorthBalance,
  getNetWorthCategory,
  netWorthCategoryLabels,
  netWorthCategoryOrder,
};
