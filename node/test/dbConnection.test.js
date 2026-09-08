'use strict';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');

const connectionPath = require.resolve('../src/db/connection');
const originalEnv = { ...process.env };

const sslEnvKeys = [
  'DATABASE_URL',
  'DB_SSL',
  'DB_SSL_CA',
  'DB_SSL_CA_PATH',
  'DB_SSL_REJECT_UNAUTHORIZED',
];

const restoreModuleState = () => {
  delete require.cache[connectionPath];
  sslEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  Object.assign(process.env, originalEnv);
};

const loadConnection = (env) => {
  restoreModuleState();
  sslEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  Object.assign(process.env, env);

  return require(connectionPath);
};

afterEach(restoreModuleState);

test('database SSL is disabled when DB_SSL is not true', async () => {
  const db = loadConnection({ DB_SSL: 'false' });

  try {
    assert.equal(db.pool.options.ssl, undefined);
  } finally {
    await db.closePool();
  }
});

test('database SSL verifies certificates by default', async () => {
  const db = loadConnection({ DB_SSL: 'true' });

  try {
    assert.deepEqual(db.pool.options.ssl, {
      rejectUnauthorized: true,
    });
  } finally {
    await db.closePool();
  }
});

test('database SSL supports explicit certificate verification override', async () => {
  const db = loadConnection({
    DB_SSL: 'true',
    DB_SSL_REJECT_UNAUTHORIZED: 'false',
  });

  try {
    assert.deepEqual(db.pool.options.ssl, {
      rejectUnauthorized: false,
    });
  } finally {
    await db.closePool();
  }
});

test('database SSL accepts escaped CA certificates from env', async () => {
  const db = loadConnection({
    DB_SSL: 'true',
    DB_SSL_CA: '-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----',
  });

  try {
    assert.deepEqual(db.pool.options.ssl, {
      rejectUnauthorized: true,
      ca: '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----',
    });
  } finally {
    await db.closePool();
  }
});

test('database SSL resolves a relative CA path against the package root', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const packageRoot = path.join(__dirname, '..');
  const relativePath = './package.json';

  const db = loadConnection({
    DB_SSL: 'true',
    DB_SSL_CA_PATH: relativePath,
  });

  try {
    assert.equal(
      db.pool.options.ssl.ca,
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    );
  } finally {
    await db.closePool();
  }
});
