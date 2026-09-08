'use strict';

const moment = require('moment');

const models = require('../../models');
const { httpError } = require('../../lib/httpError');
const { getCurrentUser } = require('../authService');
const { plaidEnv } = require('../plaid/client');

/**
 * Which Plaid environment the dashboard should read. Demo users are always
 * sandbox; otherwise honour an explicit PLAID_ENV, else prefer production if the
 * user has any active production item.
 */
const getDashboardPlaidEnvironment = async (user) => {
  if (user.is_demo) {
    return 'sandbox';
  }

  if (process.env.PLAID_ENV) {
    return plaidEnv;
  }

  const plaidItems = await models.plaidItems.findByUserId(user.id);
  const hasActiveProductionItems = plaidItems.some(
    (item) => item.is_active && item.plaid_environment === 'production',
  );

  return hasActiveProductionItems ? 'production' : plaidEnv;
};

const parseSelectedMonth = (month) => {
  const selectedMonth = month
    ? moment(month, 'YYYY-MM', true)
    : moment().subtract(1, 'month');

  if (!selectedMonth.isValid()) {
    throw httpError(400, 'Dashboard month must be formatted as YYYY-MM');
  }

  return selectedMonth.clone().startOf('month');
};

/**
 * The shared preamble both dashboard endpoints run: resolve the current user,
 * the Plaid environment to read, and the selected month (as a start-of-month
 * moment).
 */
const resolveDashboardContext = async ({ month } = {}) => {
  const user = await getCurrentUser();
  const dashboardPlaidEnv = await getDashboardPlaidEnvironment(user);
  const dashboardMonth = parseSelectedMonth(month);

  return { user, dashboardPlaidEnv, dashboardMonth };
};

module.exports = {
  getDashboardPlaidEnvironment,
  parseSelectedMonth,
  resolveDashboardContext,
};
