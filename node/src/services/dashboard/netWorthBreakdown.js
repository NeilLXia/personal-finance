'use strict';

const moment = require('moment');

const {
  addNetWorthBreakdownBalance,
  createEmptyNetWorthBreakdown,
  getNetWorthCategory,
} = require('./netWorth');
const { negateMoney, roundMoney, subtractMoney } = require('../../utils/money');

/**
 * For the selected breakdown date, keep the most recent snapshot per account on
 * or before that date.
 */
const collectLatestAccountSnapshots = (
  netWorthAccountHistory,
  selectedBreakdownDate,
) => {
  const latestSelectedAccountSnapshotById = {};

  if (!selectedBreakdownDate) {
    return latestSelectedAccountSnapshotById;
  }

  netWorthAccountHistory.forEach((account) => {
    const date = account.balance_date
      ? moment(account.balance_date).format('YYYY-MM-DD')
      : null;

    if (!date || date > selectedBreakdownDate) {
      return;
    }

    latestSelectedAccountSnapshotById[account.id] = {
      ...account,
      balance_date: date,
    };
  });

  return latestSelectedAccountSnapshotById;
};

const addAccountBreakdownItems = ({
  netWorthBreakdown,
  netWorthBreakdownItemsById,
  latestSelectedAccountSnapshotById,
  selectedBreakdownDate,
}) => {
  Object.values(latestSelectedAccountSnapshotById).forEach((account) => {
    const category = getNetWorthCategory(account);
    const balance = roundMoney(account.balance);
    const itemId = `account-${account.id}`;

    netWorthBreakdownItemsById[itemId] = {
      id: itemId,
      name: account.name,
      detail: [
        account.institution_name,
        account.subtype,
        account.mask ? `**${account.mask}` : null,
      ]
        .filter(Boolean)
        .join(' '),
      balances: {},
    };
    netWorthBreakdown[category].items.push(netWorthBreakdownItemsById[itemId]);

    addNetWorthBreakdownBalance({
      breakdown: netWorthBreakdown,
      category,
      item: netWorthBreakdownItemsById[itemId],
      date: selectedBreakdownDate,
      balance,
    });
  });
};

const addPropertyBreakdownItem = ({
  netWorthBreakdown,
  netWorthBreakdownItemsById,
  itemId,
  name,
  detail,
  date,
  balance,
}) => {
  if (!netWorthBreakdownItemsById[itemId]) {
    netWorthBreakdownItemsById[itemId] = {
      id: itemId,
      name,
      detail,
      balances: {},
    };
    netWorthBreakdown.real_estate.items.push(netWorthBreakdownItemsById[itemId]);
  }

  addNetWorthBreakdownBalance({
    breakdown: netWorthBreakdown,
    category: 'real_estate',
    item: netWorthBreakdownItemsById[itemId],
    date,
    balance,
  });
};

const addPropertyBreakdownItems = ({
  netWorthBreakdown,
  netWorthBreakdownItemsById,
  propertyValuationHistory,
  latestBreakdownDateByMonth,
}) => {
  propertyValuationHistory.forEach((property) => {
    const estimatedValue = roundMoney(property.estimated_value);
    const loanBalance = roundMoney(property.loan_balance);
    const netValue = subtractMoney(estimatedValue, loanBalance);
    const monthKey = property.valuation_month
      ? moment(property.valuation_month).format('YYYY-MM')
      : null;
    const date = monthKey ? latestBreakdownDateByMonth[monthKey] : null;

    if (!date) {
      return;
    }

    if (estimatedValue !== 0) {
      addPropertyBreakdownItem({
        netWorthBreakdown,
        netWorthBreakdownItemsById,
        itemId: `property-${property.id}-value`,
        name: property.address,
        detail: 'Property value',
        date,
        balance: estimatedValue,
      });
    }

    if (loanBalance !== 0) {
      addPropertyBreakdownItem({
        netWorthBreakdown,
        netWorthBreakdownItemsById,
        itemId: `property-${property.id}-loan`,
        name: property.address,
        detail: 'Loan balance',
        date,
        balance: negateMoney(loanBalance),
      });
    }

    if (estimatedValue === 0 && loanBalance === 0) {
      addPropertyBreakdownItem({
        netWorthBreakdown,
        netWorthBreakdownItemsById,
        itemId: `property-${property.id}`,
        name: property.address,
        detail: 'No valuation yet',
        date,
        balance: netValue,
      });
    }
  });
};

const buildNetWorthBreakdown = ({
  netWorthAccountHistory,
  propertyValuationHistory,
  selectedBreakdownDate,
  latestBreakdownDateByMonth,
}) => {
  const netWorthBreakdown = createEmptyNetWorthBreakdown();
  const netWorthBreakdownItemsById = {};
  const latestSelectedAccountSnapshotById = collectLatestAccountSnapshots(
    netWorthAccountHistory,
    selectedBreakdownDate,
  );

  addAccountBreakdownItems({
    netWorthBreakdown,
    netWorthBreakdownItemsById,
    latestSelectedAccountSnapshotById,
    selectedBreakdownDate,
  });

  addPropertyBreakdownItems({
    netWorthBreakdown,
    netWorthBreakdownItemsById,
    propertyValuationHistory,
    latestBreakdownDateByMonth,
  });

  return netWorthBreakdown;
};

module.exports = {
  buildNetWorthBreakdown,
};
