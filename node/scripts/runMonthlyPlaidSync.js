'use strict';

require('dotenv').config();
const db = require('../src/db/connection');
const {
  runMonthlyPlaidSync,
} = require('../src/services/plaid/monthlyPlaidSyncService');

const force = process.argv.includes('--force');

runMonthlyPlaidSync({ force })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error.response?.data || error);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());
