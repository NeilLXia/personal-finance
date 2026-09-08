'use strict';

// The session cookie is signed with SESSION_SECRET and nothing else. These
// tests pin the resolver in authService: production refuses to boot without a
// real secret, development falls back to a labelled insecure default.

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');

const authServicePath = require.resolve('../src/services/authService');
const modelsPath = require.resolve('../src/models');
const loggerPath = require.resolve('../src/lib/logger');
const demoPath = require.resolve('../src/services/demo');

const originalEnv = { ...process.env };
const cachedModules = new Map(
  [authServicePath, modelsPath, loggerPath, demoPath].map((id) => [
    id,
    require.cache[id],
  ]),
);

const warnings = [];

const restore = () => {
  cachedModules.forEach((entry, id) => {
    if (entry) {
      require.cache[id] = entry;
    } else {
      delete require.cache[id];
    }
  });
  process.env = { ...originalEnv };
  warnings.length = 0;
};

const loadAuthService = (env) => {
  restore();
  delete require.cache[authServicePath];

  for (const key of ['NODE_ENV', 'SESSION_SECRET']) {
    delete process.env[key];
  }
  Object.assign(process.env, env);

  require.cache[modelsPath] = {
    id: modelsPath,
    filename: modelsPath,
    loaded: true,
    exports: { users: {} },
  };
  require.cache[demoPath] = {
    id: demoPath,
    filename: demoPath,
    loaded: true,
    exports: {
      clearDemoSessionData: async () => {},
      cleanupExpiredDemoUsers: async () => ({}),
      createDemoSessionData: async () => ({}),
    },
  };
  require.cache[loggerPath] = {
    id: loggerPath,
    filename: loggerPath,
    loaded: true,
    exports: {
      error: () => {},
      info: () => {},
      warn: (message) => warnings.push(message),
    },
  };

  return () => require(authServicePath);
};

afterEach(restore);

test('production refuses to load without SESSION_SECRET', () => {
  const load = loadAuthService({ NODE_ENV: 'production' });
  assert.throws(load, /SESSION_SECRET must be set/);
});

test('production refuses a placeholder SESSION_SECRET', () => {
  const load = loadAuthService({
    NODE_ENV: 'production',
    SESSION_SECRET: 'replace-with-a-long-random-string',
  });
  assert.throws(load, /SESSION_SECRET must be set/);
});

test('production refuses a too-short SESSION_SECRET', () => {
  const load = loadAuthService({
    NODE_ENV: 'production',
    SESSION_SECRET: 'too-short',
  });
  assert.throws(load, /at least 32 characters/);
});

test('production loads with a real 32+ character SESSION_SECRET', () => {
  const load = loadAuthService({
    NODE_ENV: 'production',
    SESSION_SECRET: 'a'.repeat(40),
  });
  assert.doesNotThrow(load);
});

test('development falls back to the insecure default and warns', () => {
  const load = loadAuthService({ NODE_ENV: 'development' });
  assert.doesNotThrow(load);
  assert.ok(
    warnings.some((message) => /SESSION_SECRET is not set/.test(message)),
    'expected a warning about the missing SESSION_SECRET',
  );
});
