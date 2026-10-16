'use strict';

const moment = require('moment');
const models = require('../../models');
const logger = require('../../lib/logger');
const { getPlaidClient, logPlaidResponse } = require('./client');
const { syncTransactionsForItem } = require('./transactionSyncService');
const { saveAccounts } = require('./persistenceService');
const { refreshPropertyValue } = require('../propertyService');

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

const syncPlaidItemTransactionsReportingFailure = async ({ plaidItem }) => {
  try {
    return await syncPlaidItemTransactions({ plaidItem });
  } catch (error) {
    logger.warn('Scheduled transaction sync item failed', {
      plaid_item_id: plaidItem.plaid_item_id,
      institution_name: plaidItem.institution_name,
      error: error.response?.data || error.message || error,
    });

    return {
      plaid_item_id: plaidItem.plaid_item_id,
      institution_name: plaidItem.institution_name,
      plaid_environment: plaidItem.plaid_environment,
      status: 'failed',
      error: error.response?.data?.error_message || error.message,
    };
  }
};

const summarizeTransactionResults = (transactionResults) => ({
  synced: transactionResults.filter((result) => result.status === 'synced').length,
  pending: transactionResults.filter((result) => result.status === 'pending').length,
  failed: transactionResults.filter((result) => result.status === 'failed').length,
  added: transactionResults.reduce((total, result) => total + Number(result.added || 0), 0),
  modified: transactionResults.reduce((total, result) => total + Number(result.modified || 0), 0),
  removed: transactionResults.reduce((total, result) => total + Number(result.removed || 0), 0),
  items: transactionResults,
});

// Property values live outside Plaid, but the monthly snapshot is the only
// scheduled job, so it also pulls each property's RentCast valuation for the
// month. refreshPropertyValue skips properties already valued this month.
const refreshPropertyValues = async ({ snapshotDate }) => {
  const properties = await models.properties.findActiveNonDemo();
  const results = [];

  for (const property of properties) {
    try {
      results.push(
        await refreshPropertyValue(property, { valuationMonth: snapshotDate }),
      );
    } catch (error) {
      logger.warn('Monthly property valuation failed', {
        property_id: property.id,
        error: error.data || error.message || error,
      });
      results.push({
        property_id: property.id,
        status: 'failed',
        error: error.message,
      });
    }
  }

  return results;
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

      transactionResults.push(
        await syncPlaidItemTransactionsReportingFailure({ plaidItem }),
      );
    }

    const propertyResults = await refreshPropertyValues({ snapshotDate });

    return {
      status: 'completed',
      balance_date: snapshotDate,
      balances: {
        refreshed: balanceResults.filter((result) => result.status === 'refreshed').length,
        skipped: balanceResults.filter((result) => result.status === 'skipped').length,
        failed: balanceResults.filter((result) => result.status === 'failed').length,
        items: balanceResults,
      },
      transactions: summarizeTransactionResults(transactionResults),
      properties: {
        refreshed: propertyResults.filter((result) => result.status === 'refreshed').length,
        skipped: propertyResults.filter((result) => result.status === 'skipped').length,
        failed: propertyResults.filter((result) => result.status === 'failed').length,
        items: propertyResults,
      },
    };
  } finally {
    isSnapshotRunInProgress = false;
  }
};

// Safety net for missed webhooks: Plaid only pushes SYNC_UPDATES_AVAILABLE to
// the URL stored on each Item, so if that URL is unreachable nothing imports
// until the next run. Scheduled daily, this caps the gap at a day. Items are
// synced sequentially to stay well under Plaid rate limits.
let isDailySyncInProgress = false;

const runDailyTransactionSync = async ({ date = new Date() } = {}) => {
  const checkedAt = moment(date).format();

  if (isDailySyncInProgress) {
    return {
      status: 'skipped',
      reason: 'Daily transaction sync is already running',
      checked_at: checkedAt,
    };
  }

  isDailySyncInProgress = true;

  try {
    const plaidItems = await models.plaidItems.findActiveNonDemoItems();
    const transactionResults = [];

    for (const plaidItem of plaidItems) {
      transactionResults.push(
        await syncPlaidItemTransactionsReportingFailure({ plaidItem }),
      );
    }

    return {
      status: 'completed',
      checked_at: checkedAt,
      transactions: summarizeTransactionResults(transactionResults),
    };
  } finally {
    isDailySyncInProgress = false;
  }
};

module.exports = {
  runDailyTransactionSync,
  runMonthlyPlaidSync,
};
