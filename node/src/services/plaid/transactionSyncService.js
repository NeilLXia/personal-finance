'use strict';

const models = require('../../models');
const { parsePositiveNumber } = require('../../lib/httpTimeout');
const { getPlaidClient, logPlaidResponse } = require('./client');
const {
  getCurrentPlaidItems,
  getCurrentUser,
} = require('./plaidContext');
const { saveTransactions } = require('./persistenceService');

const transactionSyncMaxPages = parsePositiveNumber(
  process.env.PLAID_TRANSACTION_SYNC_MAX_PAGES,
  20,
);

const syncTransactionsForItem = async (
  plaidItem,
  { fromBeginning = false, logResponses = true } = {},
) => {
  const plaidClient = getPlaidClient(plaidItem.plaid_environment);
  const accessToken = plaidItem.access_token;
  let cursor = fromBeginning ? null : plaidItem.transactions_cursor;
  let added = [];
  let modified = [];
  let removed = [];
  let hasMore = true;
  let pageCount = 0;

  while (hasMore) {
    pageCount += 1;

    if (pageCount > transactionSyncMaxPages) {
      const error = new Error(
        `Plaid transaction sync exceeded ${transactionSyncMaxPages} pages`,
      );
      error.status = 502;
      error.data = {
        plaid_item_id: plaidItem.plaid_item_id,
        plaid_environment: plaidItem.plaid_environment,
        max_pages: transactionSyncMaxPages,
      };
      throw error;
    }

    const request = {
      access_token: accessToken,
    };

    if (cursor) {
      request.cursor = cursor;
    }

    const response = await plaidClient.transactionsSync(request);
    const data = response.data;
    cursor = data.next_cursor;

    if (cursor === '') {
      return {
        added: 0,
        modified: 0,
        removed: 0,
        cursor: plaidItem.transactions_cursor,
        status: 'pending',
      };
    }

    added = added.concat(data.added);
    modified = modified.concat(data.modified);
    removed = removed.concat(data.removed);
    hasMore = data.has_more;
    if (logResponses) {
      logPlaidResponse(response);
    }
  }

  const compareTxnsByDateAscending = (a, b) =>
    (a.date > b.date) - (a.date < b.date);
  const recentlyAdded = [...added].sort(compareTxnsByDateAscending).slice(-8);
  await saveTransactions({ transactions: added.concat(modified) });
  await models.transactions.deleteByPlaidTransactionIdsForUserId({
    plaidTransactionIds: removed.map((transaction) => transaction.transaction_id),
    userId: plaidItem.user_id,
  });
  await models.plaidItems.updateTransactionsCursor({
    id: plaidItem.id,
    transactionsCursor: cursor,
  });

  return {
    added: added.length,
    modified: modified.length,
    removed: removed.length,
    cursor,
    latest_transactions: recentlyAdded,
    from_beginning: fromBeginning,
    page_count: pageCount,
    status: 'synced',
  };
};

const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const syncTransactionsForPlaidItemId = async (
  plaidItemId,
  { pendingRetries = 0, pendingRetryMs = 2000 } = {},
) => {
  const plaidItem = await models.plaidItems.findByPlaidItemId(plaidItemId);

  if (!plaidItem) {
    const error = new Error(`No Plaid Item found for item_id ${plaidItemId}`);
    error.status = 404;
    throw error;
  }

  if (!plaidItem.is_active) {
    return {
      added: 0,
      modified: 0,
      removed: 0,
      cursor: plaidItem.transactions_cursor,
      status: 'ignored',
      reason: 'Plaid Item is inactive',
    };
  }

  let result = await syncTransactionsForItem(plaidItem);
  let retriesLeft = pendingRetries;

  while (result.status === 'pending' && retriesLeft > 0) {
    await wait(pendingRetryMs);
    result = await syncTransactionsForItem(plaidItem);
    retriesLeft -= 1;
  }

  return {
    ...result,
    pending_retries_remaining: retriesLeft,
  };
};

// Demo users' seeded Plaid Item carries a placeholder access token, so a live
// sync would fail. Report a no-op so the manual refresh doesn't error.
const emptySyncResult = (status) => ({
  status,
  items: [],
  added: 0,
  modified: 0,
  removed: 0,
});

const syncCurrentTransactions = async () => {
  const user = await getCurrentUser();

  if (user.is_demo) {
    return emptySyncResult('skipped');
  }

  const plaidItems = await getCurrentPlaidItems();
  const results = await Promise.all(plaidItems.map(syncTransactionsForItem));

  return {
    status: 'synced',
    items: results,
    added: results.reduce((total, result) => total + result.added, 0),
    modified: results.reduce((total, result) => total + result.modified, 0),
    removed: results.reduce((total, result) => total + result.removed, 0),
  };
};

const backfillAllTransactions = async () => {
  const user = await getCurrentUser();

  if (user.is_demo) {
    return { ...emptySyncResult('skipped'), from_beginning: true };
  }

  const plaidItems = await getCurrentPlaidItems();
  const results = await Promise.all(
    plaidItems.map((plaidItem) =>
      syncTransactionsForItem(plaidItem, {
        fromBeginning: true,
        logResponses: false,
      }),
    ),
  );

  return {
    status: 'synced',
    from_beginning: true,
    items: results,
    added: results.reduce((total, result) => total + result.added, 0),
    modified: results.reduce((total, result) => total + result.modified, 0),
    removed: results.reduce((total, result) => total + result.removed, 0),
  };
};

module.exports = {
  backfillAllTransactions,
  syncCurrentTransactions,
  syncTransactionsForItem,
  syncTransactionsForPlaidItemId,
};
