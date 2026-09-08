'use strict';

require('dotenv').config({ quiet: true });

const models = require('../src/models');
const db = require('../src/db/connection');

const run = async () => {
  const result = await models.plaidItems.pruneStaleDuplicates();

  console.log('[Plaid cleanup] pruned stale duplicate Items', {
    deleted_items: result.deletedItems.length,
    deleted_accounts: result.deletedAccounts.length,
    deleted_transactions: result.deletedTransactions.length,
  });
};

run()
  .catch((error) => {
    console.error('[Plaid cleanup] failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());
