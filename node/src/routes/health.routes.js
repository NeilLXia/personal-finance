'use strict';

const express = require('express');

const database = require('../db/connection');
const logger = require('../lib/logger');

const READINESS_DB_TIMEOUT_MS = 2000;

const router = express.Router();

/**
 * Liveness: the process is up and the event loop is servicing requests. No I/O,
 * so a load balancer can hammer it cheaply. Never returns non-200 while the
 * process can respond at all.
 */
router.get('/', (request, response) => {
  response.json({ status: 'ok' });
});

/**
 * Readiness: the process can actually serve traffic, which for this app means
 * the database is reachable. Returns 503 when it is not, so an orchestrator
 * pulls the instance out of rotation instead of sending it live requests.
 */
router.get('/ready', async (request, response) => {
  try {
    await Promise.race([
      database.checkConnection(),
      new Promise((_resolve, reject) =>
        setTimeout(
          () => reject(new Error('readiness database check timed out')),
          READINESS_DB_TIMEOUT_MS,
        ).unref(),
      ),
    ]);

    response.json({ status: 'ready' });
  } catch (error) {
    logger.warn('Readiness check failed', { message: error.message });
    response.status(503).json({ status: 'unavailable' });
  }
});

module.exports = router;
