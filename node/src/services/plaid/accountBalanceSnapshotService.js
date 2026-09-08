'use strict';

const moment = require('moment');
const models = require('../../models');
const { getPlaidClient, logPlaidResponse } = require('./client');
const {
  getCurrentPlaidEnvironment,
  getCurrentPlaidItems,
  getCurrentUser,
} = require('./plaidContext');
const { saveAccounts } = require('./persistenceService');

const refreshAccountBalanceSnapshots = async ({ balanceDate = null } = {}) => {
  const user = await getCurrentUser();
  const currentPlaidEnv = await getCurrentPlaidEnvironment();

  // Demo users have a seeded Plaid Item with a placeholder access token, so a
  // live balance refresh would fail. Return the seeded accounts unchanged.
  if (user.is_demo) {
    return {
      accounts: await models.accounts.findByUserIdAndEnvironment(
        user.id,
        currentPlaidEnv,
      ),
      balance_refresh: { refreshed: 0, skipped: 0, items: [] },
    };
  }

  const plaidItems = await getCurrentPlaidItems();
  const snapshotDate = balanceDate || moment().format('YYYY-MM-DD');
  const balanceResults = await Promise.all(
    plaidItems.map(async (plaidItem) => {
      const hasTodaysSnapshots =
        await models.accountBalanceHistory.hasDailySnapshotsForPlaidItemId({
          plaidItemId: plaidItem.plaid_item_id,
          balanceDate: snapshotDate,
        });

      if (hasTodaysSnapshots) {
        return {
          plaid_item_id: plaidItem.plaid_item_id,
          status: 'skipped',
          balance_date: snapshotDate,
          reason: 'Balance snapshots already exist for this date',
        };
      }

      const plaidClient = getPlaidClient(plaidItem.plaid_environment);
      const response = await plaidClient.accountsBalanceGet({
        access_token: plaidItem.access_token,
      });

      await saveAccounts({
        userId: user.id,
        plaidItemId: plaidItem.plaid_item_id,
        accounts: response.data.accounts,
        balanceDate: snapshotDate,
      });
      logPlaidResponse(response);

      return {
        plaid_item_id: plaidItem.plaid_item_id,
        status: 'refreshed',
        balance_date: snapshotDate,
        account_count: response.data.accounts.length,
      };
    }),
  );

  return {
    accounts: await models.accounts.findByUserIdAndEnvironment(
      user.id,
      currentPlaidEnv,
    ),
    balance_refresh: {
      refreshed: balanceResults.filter(
        (result) => result.status === 'refreshed',
      ).length,
      skipped: balanceResults.filter((result) => result.status === 'skipped')
        .length,
      items: balanceResults,
    },
  };
};

module.exports = {
  refreshAccountBalanceSnapshots,
};
