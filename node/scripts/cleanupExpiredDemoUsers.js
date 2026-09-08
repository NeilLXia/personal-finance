'use strict';

require('dotenv').config({ quiet: true });
const db = require('../src/db/connection');
const { cleanupExpiredDemoUsers } = require('../src/services/demo');

cleanupExpiredDemoUsers()
  .then((result) => {
    console.log(`Deleted ${result.deleted_count} expired demo user(s).`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());
