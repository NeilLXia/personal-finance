'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveDatabaseSecret,
  applySecretValue,
} = require('../src/config/databaseSecret');

test('resolveDatabaseSecret is a no-op when DB_SECRET_ID is unset', async () => {
  const env = { DB_PASSWORD: 'local' };
  let called = false;

  const applied = await resolveDatabaseSecret({
    env,
    send: async () => {
      called = true;
      return {};
    },
  });

  assert.equal(applied, false);
  assert.equal(called, false);
  assert.equal(env.DB_PASSWORD, 'local');
});

test('resolveDatabaseSecret loads credentials from a JSON RDS secret', async () => {
  const env = {
    DB_SECRET_ID: 'rds-secret',
    AWS_REGION: 'us-east-2',
    DB_HOST: 'proxy.internal',
    DB_PASSWORD: 'stale',
  };

  const seen = {};
  const applied = await resolveDatabaseSecret({
    env,
    send: async (command, options) => {
      seen.secretId = command.input.SecretId;
      seen.region = options.region;
      return {
        SecretString: JSON.stringify({
          username: 'finance_app',
          password: 'rotated-secret',
          host: 'db.rds.amazonaws.com',
          port: 5432,
          dbname: 'finance',
        }),
      };
    },
  });

  assert.equal(applied, true);
  assert.equal(seen.secretId, 'rds-secret');
  assert.equal(seen.region, 'us-east-2');
  assert.equal(env.DB_PASSWORD, 'rotated-secret');
  assert.equal(env.DB_USER, 'finance_app');
  // Explicit .env value wins over the secret's connection targeting.
  assert.equal(env.DB_HOST, 'proxy.internal');
  // Unset fields are filled from the secret.
  assert.equal(env.DB_PORT, '5432');
  assert.equal(env.DB_NAME, 'finance');
});

test('resolveDatabaseSecret drops DATABASE_URL so the secret takes effect', async () => {
  const env = {
    DB_SECRET_ID: 'rds-secret',
    DATABASE_URL: 'postgresql://finance:devpassword@localhost/finance',
  };

  await resolveDatabaseSecret({
    env,
    send: async () => ({ SecretString: JSON.stringify({ password: 'pw' }) }),
  });

  assert.equal('DATABASE_URL' in env, false);
  assert.equal(env.DB_PASSWORD, 'pw');
});

test('resolveDatabaseSecret accepts a raw (non-JSON) password string', async () => {
  const env = { DB_SECRET_ID: 'plain-secret' };

  await resolveDatabaseSecret({
    env,
    send: async () => ({ SecretString: 's3cr3t' }),
  });

  assert.equal(env.DB_PASSWORD, 's3cr3t');
});

test('resolveDatabaseSecret throws when the secret has no value', async () => {
  await assert.rejects(
    resolveDatabaseSecret({
      env: { DB_SECRET_ID: 'empty-secret' },
      send: async () => ({}),
    }),
    /has no value/,
  );
});

test('applySecretValue does not overwrite an explicit DB_USER-only setup', () => {
  const env = { DB_USER: 'readonly' };

  applySecretValue(JSON.stringify({ password: 'pw' }), env);

  assert.equal(env.DB_USER, 'readonly');
  assert.equal(env.DB_PASSWORD, 'pw');
});
