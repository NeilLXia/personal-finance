'use strict';

const database = require('./db/connection');
const logger = require('./lib/logger');
const { assertConfigValid } = require('./config/validateConfig');

const APP_PORT = process.env.APP_PORT || 8001;
const SHUTDOWN_TIMEOUT_MS = 10000;
const CONNECTION_DRAIN_MS = 5000;

const waitForDatabase = async (attempts = 5, delayMs = 2000) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await database.checkConnection();
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }

      logger.warn('Database not ready, retrying', {
        attempt,
        attempts,
        message: error.message,
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

const registerShutdown = (server) => {
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info('Shutting down', { signal });

    const forceExit = setTimeout(() => {
      logger.error('Forced shutdown after timeout', {
        timeout_ms: SHUTDOWN_TIMEOUT_MS,
      });
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    // Stop accepting new requests, then drop any lingering keep-alive sockets so
    // in-flight requests finish but idle clients don't hold the server open.
    server.close((closeError) => {
      if (closeError) {
        logger.error('Error closing HTTP server', {
          message: closeError.message,
        });
      }

      database
        .closePool()
        .catch((poolError) =>
          logger.error('Error closing database pool', {
            message: poolError.message,
          }),
        )
        .finally(() => {
          clearTimeout(forceExit);
          process.exit(closeError ? 1 : 0);
        });
    });

    setTimeout(() => {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
    }, CONNECTION_DRAIN_MS).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

/**
 * Validate configuration, wait for the database, then bind the port. Refuses to
 * start (exit 1) on invalid config or an unreachable database.
 */
const startServer = async (app) => {
  assertConfigValid();

  try {
    await waitForDatabase();
    logger.info('Database connection ready');
  } catch (error) {
    logger.error('Database unavailable, refusing to start', {
      message: error.message,
    });
    process.exit(1);
  }

  const server = app.listen(APP_PORT, () => {
    logger.info('Personal finance server listening', { port: APP_PORT });
  });

  server.on('error', (error) => {
    logger.error('HTTP server error', { message: error.message });
    process.exit(1);
  });

  registerShutdown(server);

  return server;
};

module.exports = { startServer };
