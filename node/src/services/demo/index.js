'use strict';

// Demo data lives in three files: `fixtures` (pure definitions), `seeder`
// (writes them), and `cleanup` (removes them). This barrel is the public surface
// used by authService (demo login) and the db:*-demo scripts.

const {
  clearDemoSessionData,
  cleanupExpiredDemoUsers,
} = require('./cleanup');
const {
  seedDemoData,
  resetDemoData,
  createDemoSessionData,
} = require('./seeder');

module.exports = {
  cleanupExpiredDemoUsers,
  clearDemoSessionData,
  createDemoSessionData,
  resetDemoData,
  seedDemoData,
};
