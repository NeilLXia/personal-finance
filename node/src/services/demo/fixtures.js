'use strict';

// Pure, deterministic demo-data helpers and constants: no database access.

const crypto = require('crypto');

const demoEmail = process.env.DEMO_USER_EMAIL || 'demo@example.com';
const demoSessionTtlHours = Number(process.env.DEMO_SESSION_TTL_HOURS || 24);

const formatDate = (date) => date.toISOString().slice(0, 10);

const addMonths = (date, months) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()),
  );

const monthStart = (year, monthIndex) => new Date(Date.UTC(year, monthIndex, 1));

const monthEnd = (year, monthIndex) =>
  new Date(Date.UTC(year, monthIndex + 1, 0));

const createDemoEmail = () => {
  const randomId = crypto.randomUUID();
  const [localPart, domain = 'example.com'] = demoEmail.split('@');

  return `${localPart}+${randomId}@${domain}`;
};

const getDemoExpirationDate = () =>
  new Date(Date.now() + demoSessionTtlHours * 60 * 60 * 1000);

const createDemoSeedIds = (userId) => {
  const prefix = `demo-${userId}-2025-2026`;

  return {
    plaidItemId: `${prefix}-sandbox-item`,
    accounts: {
      checking: `${prefix}-checking`,
      credit: `${prefix}-credit`,
      brokerage: `${prefix}-brokerage`,
      retirement: `${prefix}-401k`,
    },
    transactions: {
      prefix,
    },
  };
};

// [key, monthlyAmount, plaidCategory, merchantName, name, manualCategory]
const monthlyExpenses = [
  ['rent', 2100, 'Rent', 'Willow Creek Apartments', 'Rent payment', 'Housing'],
  ['groceries', 420, 'Food and Drink', 'Local Market', 'Groceries', 'Dining'],
  ['dining', 220, 'Food and Drink', 'Neighborhood Cafe', 'Dining', 'Dining'],
  ['utilities', 160, 'Service', 'City Utilities', 'Utilities', 'Bills'],
  ['internet', 80, 'Service', 'FiberNet', 'Internet', 'Bills'],
  ['insurance', 130, 'Insurance', 'Civic Auto Insurance', 'Auto insurance', 'Insurance'],
  ['gas', 40, 'Travel', 'Shell', 'Gas station', 'Transportation'],
  ['fitness', 125, 'Recreation', 'Pulse Fitness', 'Gym membership', 'Fitness'],
  ['shopping', 250, 'Shops', 'Target', 'Household supplies', 'Shopping'],
  ['travel', 150, 'Travel', 'Amtrak', 'Weekend trip', 'Travel'],
  ['entertainment', 175, 'Entertainment', 'Alamo Drafthouse', 'Movie night', 'Entertainment'],
];

// [category, targetPercent, netTargetPercent, grossTargetPercent]
const budgetTargets = [
  ['Housing', 28, 28, 22],
  ['Food and Drink', 12, 12, 9],
  ['Transportation', 7, 7, 5],
  ['Savings', 25, 25, 20],
  ['Taxes', 0, 0, 22],
];

module.exports = {
  demoEmail,
  formatDate,
  addMonths,
  monthStart,
  monthEnd,
  createDemoEmail,
  getDemoExpirationDate,
  createDemoSeedIds,
  monthlyExpenses,
  budgetTargets,
};
