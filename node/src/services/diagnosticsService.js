'use strict';

const database = require('../db/connection');
const { getCurrentUser } = require('./authService');

const DATABASE_CHECK_TIMEOUT_MS = 2000;

/**
 * Lets app admins ping backend + database connectivity from the UI instead of
 * guessing from a blank screen.
 */
const getHealthCheck = async () => {
  const user = await getCurrentUser();

  if (user.account_type !== 'admin') {
    const error = new Error('Not available for this account.');
    error.status = 403;
    throw error;
  }

  const startedAt = Date.now();
  let databaseStatus = 'ok';

  try {
    await Promise.race([
      database.checkConnection(),
      new Promise((_resolve, reject) =>
        setTimeout(
          () => reject(new Error('Database check timed out.')),
          DATABASE_CHECK_TIMEOUT_MS,
        ).unref(),
      ),
    ]);
  } catch {
    databaseStatus = 'unavailable';
  }

  return {
    backend: { status: 'ok' },
    database: {
      status: databaseStatus,
      latency_ms: Date.now() - startedAt,
    },
  };
};

module.exports = {
  getHealthCheck,
};
