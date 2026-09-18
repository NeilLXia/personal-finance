'use strict';

const crypto = require('crypto');
const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');

const authServicePath = require.resolve('../src/services/authService');
const modelsPath = require.resolve('../src/models');
const demoDataServicePath = require.resolve('../src/services/demo');

const originalEnv = { ...process.env };
const originalModelsCache = require.cache[modelsPath];
const originalDemoDataServiceCache = require.cache[demoDataServicePath];

const encodeBase64Url = (value) => Buffer.from(value).toString('base64url');

const createSignedSessionCookie = ({ payload, secret }) => {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return `finance_session=${encodeURIComponent(`${encodedPayload}.${signature}`)}`;
};

const restoreModuleState = () => {
  delete require.cache[authServicePath];

  if (originalModelsCache) {
    require.cache[modelsPath] = originalModelsCache;
  } else {
    delete require.cache[modelsPath];
  }

  if (originalDemoDataServiceCache) {
    require.cache[demoDataServicePath] = originalDemoDataServiceCache;
  } else {
    delete require.cache[demoDataServicePath];
  }

  process.env = { ...originalEnv };
};

const loadAuthService = ({ findById }) => {
  restoreModuleState();

  process.env.SESSION_SECRET = 'test-session-secret-with-enough-length';
  process.env.SESSION_MAX_AGE_SECONDS = '1800';
  process.env.SESSION_COOKIE_NAME = 'finance_session';

  require.cache[modelsPath] = {
    id: modelsPath,
    filename: modelsPath,
    loaded: true,
    exports: {
      users: {
        findById,
        isExpiredDemoUser: () => false,
      },
    },
  };
  require.cache[demoDataServicePath] = {
    id: demoDataServicePath,
    filename: demoDataServicePath,
    loaded: true,
    exports: {
      clearDemoSessionData: async () => {},
      cleanupExpiredDemoUsers: async () => ({ deleted_count: 0 }),
      createDemoSessionData: async () => {
        throw new Error('not expected');
      },
    },
  };

  return require(authServicePath);
};

const attachSession = (authService, cookie) => {
  const request = {
    headers: { cookie },
  };
  const response = {
    setHeader: () => {},
  };

  return new Promise((resolve, reject) => {
    authService.attachSessionContext(request, response, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(request);
    });
  });
};

afterEach(restoreModuleState);

test('attachSessionContext rejects a signed but expired session token', async () => {
  let findByIdCalls = 0;
  const authService = loadAuthService({
    findById: async () => {
      findByIdCalls += 1;
      return { id: 123, email: 'expired@test.local' };
    },
  });
  const cookie = createSignedSessionCookie({
    secret: process.env.SESSION_SECRET,
    payload: {
      user_id: 123,
      email: 'expired@test.local',
      created_at: Date.now() - 60 * 60 * 1000,
      expires_at: Date.now() - 1000,
    },
  });

  const request = await attachSession(authService, cookie);

  assert.equal(request.user, null);
  assert.equal(findByIdCalls, 0);
});

test('attachSessionContext accepts a signed session token with future expires_at', async () => {
  const user = { id: 123, email: 'valid@test.local', is_demo: false };
  const authService = loadAuthService({
    findById: async (id) => (id === user.id ? user : null),
  });
  const cookie = createSignedSessionCookie({
    secret: process.env.SESSION_SECRET,
    payload: {
      user_id: user.id,
      email: user.email,
      created_at: Date.now(),
      expires_at: Date.now() + 60 * 1000,
    },
  });

  const request = await attachSession(authService, cookie);

  assert.deepEqual(request.user, user);
});

test('attachSessionContext rejects legacy signed session tokens without expires_at', async () => {
  let findByIdCalls = 0;
  const authService = loadAuthService({
    findById: async () => {
      findByIdCalls += 1;
      return { id: 123, email: 'legacy@test.local' };
    },
  });
  const cookie = createSignedSessionCookie({
    secret: process.env.SESSION_SECRET,
    payload: {
      user_id: 123,
      email: 'legacy@test.local',
      created_at: Date.now(),
    },
  });

  const request = await attachSession(authService, cookie);

  assert.equal(request.user, null);
  assert.equal(findByIdCalls, 0);
});
