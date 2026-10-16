'use strict';

require('dotenv').config();
const db = require('../src/db/connection');
const {
  runDailyTransactionSync,
} = require('../src/services/plaid/monthlyPlaidSyncService');

runDailyTransactionSync()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));

    if (result.transactions?.failed > 0) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    console.error(error.response?.data || error);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());
