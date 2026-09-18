'use strict';

const moment = require('moment');
const models = require('../../models');
const logger = require('../../lib/logger');
const { getPlaidClient, logPlaidResponse } = require('./client');
const { syncTransactionsForItem } = require('./transactionSyncService');
const { saveAccounts } = require('./persistenceService');

let isSnapshotRunInProgress = false;

const shouldRunMonthlySnapshot = (date, force) =>
  force || moment(date).date() === 1;

const refreshPlaidItemBalanceSnapshot = async ({ plaidItem, snapshotDate }) => {
  const hasSnapshot =
    await models.accountBalanceHistory.hasMonthlySnapshotsForPlaidItemId({
      plaidItemId: plaidItem.plaid_item_id,
      balanceMonth: snapshotDate,
    });

  if (hasSnapshot) {
    return {
      plaid_item_id: plaidItem.plaid_item_id,
      institution_name: plaidItem.institution_name,
      plaid_environment: plaidItem.plaid_environment,
      status: 'skipped',
      reason: 'Balance snapshots already exist for this month',
    };
  }

  const plaidClient = getPlaidClient(plaidItem.plaid_environment);
  const response = await plaidClient.accountsBalanceGet({
    access_token: plaidItem.access_token,
  });

  await saveAccounts({
    userId: plaidItem.user_id,
    plaidItemId: plaidItem.plaid_item_id,
    accounts: response.data.accounts,
    balanceDate: snapshotDate,
  });
  logPlaidResponse(response);

  return {
    plaid_item_id: plaidItem.plaid_item_id,
    institution_name: plaidItem.institution_name,
    plaid_environment: plaidItem.plaid_environment,
    status: 'refreshed',
    balance_date: snapshotDate,
    account_count: response.data.accounts.length,
  };
};

const syncPlaidItemTransactions = async ({ plaidItem }) => {
  const result = await syncTransactionsForItem(plaidItem, {
    logResponses: false,
  });

  return {
    plaid_item_id: plaidItem.plaid_item_id,
    institution_name: plaidItem.institution_name,
    plaid_environment: plaidItem.plaid_environment,
    ...result,
  };
};

const runMonthlyPlaidSync = async ({
  date = new Date(),
  force = false,
} = {}) => {
  const runDate = moment(date);

  if (!shouldRunMonthlySnapshot(runDate, force)) {
    return {
      status: 'skipped',
      reason: 'Monthly Plaid sync only runs on the first day of the month',
      checked_at: runDate.format(),
    };
  }

  if (isSnapshotRunInProgress) {
    return {
      status: 'skipped',
      reason: 'Monthly Plaid sync is already running',
      checked_at: runDate.format(),
    };
  }

  isSnapshotRunInProgress = true;
  const snapshotDate = runDate.clone().startOf('month').format('YYYY-MM-DD');

  try {
    const plaidItems = await models.plaidItems.findActiveNonDemoItems();
    const balanceResults = [];
    const transactionResults = [];

    for (const plaidItem of plaidItems) {
      try {
        balanceResults.push(
          await refreshPlaidItemBalanceSnapshot({
            plaidItem,
            snapshotDate,
          }),
        );
      } catch (error) {
        logger.warn('Monthly balance snapshot item failed', {
          plaid_item_id: plaidItem.plaid_item_id,
          institution_name: plaidItem.institution_name,
          error: error.response?.data || error.message || error,
        });
        balanceResults.push({
          plaid_item_id: plaidItem.plaid_item_id,
          institution_name: plaidItem.institution_name,
          plaid_environment: plaidItem.plaid_environment,
          status: 'failed',
          error: error.response?.data?.error_message || error.message,
        });
      }

      try {
        transactionResults.push(
          await syncPlaidItemTransactions({
            plaidItem,
          }),
        );
      } catch (error) {
        logger.warn('Monthly transaction sync item failed', {
          plaid_item_id: plaidItem.plaid_item_id,
          institution_name: plaidItem.institution_name,
          error: error.response?.data || error.message || error,
        });
        transactionResults.push({
          plaid_item_id: plaidItem.plaid_item_id,
          institution_name: plaidItem.institution_name,
          plaid_environment: plaidItem.plaid_environment,
          status: 'failed',
          error: error.response?.data?.error_message || error.message,
        });
      }
    }

    return {
      status: 'completed',
      balance_date: snapshotDate,
      balances: {
        refreshed: balanceResults.filter((result) => result.status === 'refreshed').length,
        skipped: balanceResults.filter((result) => result.status === 'skipped').length,
        failed: balanceResults.filter((result) => result.status === 'failed').length,
        items: balanceResults,
      },
      transactions: {
        synced: transactionResults.filter((result) => result.status === 'synced').length,
        pending: transactionResults.filter((result) => result.status === 'pending').length,
        failed: transactionResults.filter((result) => result.status === 'failed').length,
        added: transactionResults.reduce((total, result) => total + Number(result.added || 0), 0),
        modified: transactionResults.reduce((total, result) => total + Number(result.modified || 0), 0),
        removed: transactionResults.reduce((total, result) => total + Number(result.removed || 0), 0),
        items: transactionResults,
      },
    };
  } finally {
    isSnapshotRunInProgress = false;
  }
};

module.exports = {
  runMonthlyPlaidSync,
};
