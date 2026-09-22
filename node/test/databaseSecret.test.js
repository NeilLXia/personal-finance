'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveDatabaseSecret,
  applySecretValue,
  createPasswordProvider,
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

test('createPasswordProvider returns the static DB_PASSWORD when DB_SECRET_ID is unset', async () => {
  const provider = createPasswordProvider({ env: { DB_PASSWORD: 'local' } });

  assert.equal(await provider.getPassword(), 'local');
});

test('createPasswordProvider falls back to the dev default when nothing is set', async () => {
  const provider = createPasswordProvider({ env: {} });

  assert.equal(await provider.getPassword(), 'devpassword');
});

test('createPasswordProvider caches the fetched password within the TTL', async () => {
  let calls = 0;
  const provider = createPasswordProvider({
    env: { DB_SECRET_ID: 'rds-secret' },
    ttlMs: 60_000,
    send: async () => {
      calls += 1;
      return { SecretString: JSON.stringify({ password: `pw-${calls}` }) };
    },
  });

  assert.equal(await provider.getPassword(), 'pw-1');
  assert.equal(await provider.getPassword(), 'pw-1');
  assert.equal(calls, 1);
});

test('createPasswordProvider refetches immediately after invalidate()', async () => {
  let calls = 0;
  const provider = createPasswordProvider({
    env: { DB_SECRET_ID: 'rds-secret' },
    ttlMs: 60_000,
    send: async () => {
      calls += 1;
      return { SecretString: JSON.stringify({ password: `pw-${calls}` }) };
    },
  });

  assert.equal(await provider.getPassword(), 'pw-1');
  provider.invalidate();
  assert.equal(await provider.getPassword(), 'pw-2');
  assert.equal(calls, 2);
});

test('createPasswordProvider refetches once the TTL has elapsed', async () => {
  let calls = 0;
  const provider = createPasswordProvider({
    env: { DB_SECRET_ID: 'rds-secret' },
    ttlMs: 10,
    send: async () => {
      calls += 1;
      return { SecretString: JSON.stringify({ password: `pw-${calls}` }) };
    },
  });

  assert.equal(await provider.getPassword(), 'pw-1');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(await provider.getPassword(), 'pw-2');
});

test('createPasswordProvider accepts a raw (non-JSON) password string', async () => {
  const provider = createPasswordProvider({
    env: { DB_SECRET_ID: 'plain-secret' },
    send: async () => ({ SecretString: 'raw-password' }),
  });

  assert.equal(await provider.getPassword(), 'raw-password');
});
