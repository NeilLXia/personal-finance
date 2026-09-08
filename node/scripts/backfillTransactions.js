'use strict';

require('dotenv').config({ quiet: true });

const db = require('../src/db/connection');
const {
  backfillAllTransactions,
} = require('../src/services/plaid/transactionSyncService');

backfillAllTransactions()
  .then((result) => {
    console.log(JSON.stringify({
      status: result.status,
      from_beginning: result.from_beginning,
      added: result.added,
      modified: result.modified,
      removed: result.removed,
      items: result.items.map((item) => ({
        status: item.status,
        added: item.added,
        modified: item.modified,
        removed: item.removed,
        from_beginning: item.from_beginning,
      })),
    }, null, 2));
  })
  .catch((error) => {
    console.error(error.response?.data || error.stack || error);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());
