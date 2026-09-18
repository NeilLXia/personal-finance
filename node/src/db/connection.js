'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const logger = require('../lib/logger');

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
      password: process.env.DB_PASSWORD || 'devpassword',
      ssl,
    };

const pool = new Pool(poolConfig);

// Without this handler an error on an idle client (DB restart, failover, network
// drop) is emitted as an unhandled 'error' event and crashes the process.
pool.on('error', (error) => {
  logger.error('Unexpected database pool error', { message: error.message });
});

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

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
