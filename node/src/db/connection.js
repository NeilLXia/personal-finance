'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const logger = require('../lib/logger');
const { createPasswordProvider } = require('../config/databaseSecret');

// node/ — a relative DB_SSL_CA_PATH resolves against this, not process.cwd(), so
// the CA bundle is found regardless of where the process was launched from.
const packageRoot = path.join(__dirname, '..', '..');

const buildSslConfig = () => {
  if (process.env.DB_SSL !== 'true') {
    return undefined;
  }

  const ssl = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  };

  if (process.env.DB_SSL_CA_PATH) {
    ssl.ca = fs.readFileSync(
      path.resolve(packageRoot, process.env.DB_SSL_CA_PATH),
      'utf8',
    );
  } else if (process.env.DB_SSL_CA) {
    ssl.ca = process.env.DB_SSL_CA.replace(/\\n/g, '\n');
  }

  return ssl;
};

const ssl = buildSslConfig();

// A function here (rather than a plain string) is called by pg per new
// physical connection, so an RDS-managed secret rotation is picked up
// without restarting the process — see createPasswordProvider's doc comment.
const passwordProvider = createPasswordProvider();

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'finance',
      user: process.env.DB_USER || 'finance',
      password: () => passwordProvider.getPassword(),
      ssl,
    };

const pool = new Pool(poolConfig);

const AUTH_FAILED_CODE = '28P01'; // Postgres: invalid_password

const isAuthError = (error) => Boolean(error) && error.code === AUTH_FAILED_CODE;

// Without this handler an error on an idle client (DB restart, failover, network
// drop) is emitted as an unhandled 'error' event and crashes the process.
pool.on('error', (error) => {
  logger.error('Unexpected database pool error', { message: error.message });

  if (isAuthError(error)) {
    passwordProvider.invalidate();
  }
});

// A stale cached password (e.g. the secret rotated since it was last fetched)
// surfaces here as a 28P01 on the next new connection. Force a fresh fetch
// and retry once instead of failing every request until the process restarts.
const withAuthRetry = async (attempt) => {
  try {
    return await attempt();
  } catch (error) {
    if (!isAuthError(error)) {
      throw error;
    }

    logger.warn(
      'Database auth failed; refreshing credentials from Secrets Manager and retrying once',
      { message: error.message },
    );
    passwordProvider.invalidate();

    return attempt();
  }
};

const query = (text, params) => withAuthRetry(() => pool.query(text, params));

const getClient = () => withAuthRetry(() => pool.connect());

const checkConnection = async () => {
  const { rows } = await query('SELECT NOW() AS now');
  return rows[0];
};

const closePool = () => pool.end();

module.exports = {
  pool,
  query,
  getClient,
  checkConnection,
  closePool,
};
