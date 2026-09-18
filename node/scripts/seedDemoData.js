'use strict';

require('dotenv').config({ quiet: true });
const db = require('../src/db/connection');
const {
  resetDemoData,
  seedDemoData,
} = require('../src/services/demo');

const demoEmail = process.env.DEMO_USER_EMAIL || 'demo@example.com';
const shouldReset = process.argv.includes('--reset');

seedDemoData({ reset: shouldReset })
  .then(() => {
    console.log(
      `${shouldReset ? 'Reset and seeded' : 'Seeded'} demo data for ${demoEmail}`,
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());

module.exports = {
  resetDemoData,
  seedDemoData,
};
