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
  // Also reset connection-targeting/credential keys — otherwise a value one
  // test sets (e.g. DB_PASSWORD) leaks into a later test via originalEnv,
  // since Object.assign only overwrites keys present in originalEnv rather
  // than clearing ones added afterward.
  'DB_PASSWORD',
  'DB_USER',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_SECRET_ID',
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

test('password is a static function returning DB_PASSWORD when DB_SECRET_ID is unset', async () => {
  const db = loadConnection({ DB_PASSWORD: 'from-env' });

  try {
    assert.equal(typeof db.pool.options.password, 'function');
    assert.equal(await db.pool.options.password(), 'from-env');
  } finally {
    await db.closePool();
  }
});

test('password falls back to the local dev default when unset', async () => {
  const db = loadConnection({});

  try {
    assert.equal(await db.pool.options.password(), 'devpassword');
  } finally {
    await db.closePool();
  }
});

test('query() refetches credentials and retries once after an auth failure', async () => {
  const db = loadConnection({ DB_PASSWORD: 'stale' });

  try {
    let calls = 0;
    db.pool.query = async () => {
      calls += 1;
      if (calls === 1) {
        const error = new Error('password authentication failed');
        error.code = '28P01';
        throw error;
      }
      return { rows: [{ ok: true }] };
    };

    const result = await db.query('SELECT 1');

    assert.equal(calls, 2);
    assert.deepEqual(result, { rows: [{ ok: true }] });
  } finally {
    await db.closePool();
  }
});

test('query() does not retry non-auth errors', async () => {
  const db = loadConnection({ DB_PASSWORD: 'stale' });

  try {
    let calls = 0;
    db.pool.query = async () => {
      calls += 1;
      throw new Error('connection terminated');
    };

    await assert.rejects(db.query('SELECT 1'), /connection terminated/);
    assert.equal(calls, 1);
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
