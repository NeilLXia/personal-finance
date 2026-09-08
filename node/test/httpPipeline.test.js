'use strict';

// Integration tests for the real Express pipeline built by src/app.js:
// security headers, CORS, the CSRF/trusted-origin guard, rate limiting, the
// session auth gate, health probes, and error handling. The service and data
// layers are stubbed via require.cache so no Postgres, Plaid, or Google calls
// happen — the point is to exercise middleware ordering and the auth boundary,
// which the unit tests do not cover.

const crypto = require('crypto');
const http = require('http');
const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');

// --- Environment: set before anything under src/ is required ------------------
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'integration-test-session-secret-0123456789';
process.env.SESSION_COOKIE_NAME = 'finance_session';
process.env.SESSION_MAX_AGE_SECONDS = '3600';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.TRUST_PROXY = '1';
process.env.RATE_LIMIT_GENERAL_MAX = '100000';
process.env.RATE_LIMIT_AUTH_MAX = '2';
// plaid/client.js throws at import time without these.
process.env.PLAID_ENV = 'sandbox';
process.env.PLAID_CLIENT_ID = 'test-plaid-client-id';
process.env.PLAID_SANDBOX_SECRET = 'test-plaid-sandbox-secret';

// --- Stubs ------------------------------------------------------------------
const stubModule = (requirePath, exports) => {
  const filename = require.resolve(requirePath);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};

const dbConnectionStub = {
  _ready: true,
  checkConnection: async () => {
    if (!dbConnectionStub._ready) {
      throw new Error('stub database is down');
    }
    return { now: new Date().toISOString() };
  },
  query: async () => ({ rows: [], rowCount: 0 }),
  getClient: async () => {
    throw new Error('getClient is not stubbed');
  },
  closePool: async () => {},
  pool: { on: () => {} },
};

const testUser = { id: 1, email: 'owner@test.local', is_demo: false };

stubModule('../src/db/connection', dbConnectionStub);
stubModule('../src/lib/logger', {
  error: () => {},
  info: () => {},
  warn: () => {},
});
stubModule('../src/models', {
  users: {
    findById: async (id) => (Number(id) === testUser.id ? testUser : null),
    isExpiredDemoUser: () => false,
  },
});
stubModule('../src/services/demo', {
  clearDemoSessionData: async () => {},
  cleanupExpiredDemoUsers: async () => ({ deleted_count: 0 }),
  createDemoSessionData: async () => {
    throw new Error('createDemoSessionData is not stubbed');
  },
});
stubModule('../src/services/dashboard/dashboardService', {
  getDashboard: async () => ({ ok: true }),
  getDashboardIncomeAllocation: async () => ({ income_allocation: {} }),
  getDashboardTransactions: async () => ({ items: [] }),
});

const { createApp } = require('../src/app');

// --- Helpers --------------------------------------------------------------
const signSessionCookie = (payload, secret = process.env.SESSION_SECRET) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('base64url');
  return `${process.env.SESSION_COOKIE_NAME}=${encodeURIComponent(
    `${encoded}.${signature}`,
  )}`;
};

const validSessionCookie = () =>
  signSessionCookie({
    user_id: testUser.id,
    email: testUser.email,
    is_demo: false,
    created_at: Date.now(),
    expires_at: Date.now() + 60 * 60 * 1000,
  });

let server;
let baseUrl;

const call = (path, options = {}) => fetch(`${baseUrl}${path}`, options);

before(async () => {
  server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// --- Auth gate -----------------------------------------------------------
test('protected route without a session cookie is rejected with 401', async () => {
  const response = await call('/api/dashboard');
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error.error_message, 'Authentication required.');
});

test('protected route with a tampered signature is rejected with 401', async () => {
  const cookie = validSessionCookie().replace(/.$/, (last) =>
    last === 'A' ? 'B' : 'A',
  );
  const response = await call('/api/dashboard', { headers: { cookie } });
  assert.equal(response.status, 401);
});

test('protected route with an expired session is rejected with 401', async () => {
  const cookie = signSessionCookie({
    user_id: testUser.id,
    email: testUser.email,
    created_at: Date.now() - 7200 * 1000,
    expires_at: Date.now() - 1000,
  });
  const response = await call('/api/dashboard', { headers: { cookie } });
  assert.equal(response.status, 401);
});

test('protected route with a valid session cookie reaches the handler', async () => {
  const response = await call('/api/dashboard', {
    headers: { cookie: validSessionCookie() },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

// --- Public routes & path normalization --------------------------------
test('GET /api/session is public and reports an unauthenticated session', async () => {
  const response = await call('/api/session');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.authenticated, false);
});

test('the auth gate normalizes a trailing slash before matching public routes', async () => {
  const response = await call('/api/session/');
  assert.equal(response.status, 200);
});

test('the auth gate strips the query string before matching public routes', async () => {
  const response = await call('/api/session?redirect=%2Fdashboard');
  assert.equal(response.status, 200);
});

// --- CSRF / trusted-origin guard --------------------------------------
test('a state-changing request with no Origin or Referer is rejected with 403', async () => {
  const response = await call('/api/create_link_token', { method: 'POST' });
  assert.equal(response.status, 403);
});

test('a state-changing request from an untrusted Origin is rejected with 403', async () => {
  const response = await call('/api/create_link_token', {
    method: 'POST',
    headers: { origin: 'http://evil.example' },
  });
  assert.equal(response.status, 403);
});

test('a state-changing request from a trusted Origin clears the CSRF gate (then 401 for no session)', async () => {
  const response = await call('/api/create_link_token', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000' },
  });
  assert.equal(response.status, 401);
});

test('safe methods are exempt from the trusted-origin guard', async () => {
  const response = await call('/api/dashboard', { method: 'GET' });
  // 401 (no session), not 403 — the origin guard let it through.
  assert.equal(response.status, 401);
});

test('the Plaid webhook bypasses the CSRF gate and the auth gate and hits its own verifier', async () => {
  const response = await call('/api/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ webhook_type: 'TRANSACTIONS' }),
  });
  assert.equal(response.status, 401);
  const body = await response.json();
  // The webhook's own error, not the generic auth-gate rejection.
  assert.equal(body.error.error_message, 'Missing Plaid webhook signature.');
});

// --- Security headers --------------------------------------------------
test('responses carry helmet security headers and no x-powered-by', async () => {
  const response = await call('/api/session');
  assert.ok(response.headers.get('content-security-policy'));
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
});

// --- Rate limiting ---------------------------------------------------
test('per-route rate limiter returns 429 with Retry-After once the window max is exceeded', async () => {
  const send = () =>
    call('/api/login/google', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

  const first = await send();
  const second = await send();
  const third = await send();

  // RATE_LIMIT_AUTH_MAX=2: the first two are let through (and 400 on the empty
  // body), the third is throttled.
  assert.equal(first.status, 400);
  assert.equal(second.status, 400);
  assert.equal(third.status, 429);
  assert.ok(third.headers.get('retry-after'));
});

// --- Health probes --------------------------------------------------
test('GET /health is an unauthenticated liveness probe', async () => {
  const response = await call('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('GET /health/ready reports 200 when the database is reachable', async () => {
  dbConnectionStub._ready = true;
  const response = await call('/health/ready');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ready' });
});

test('GET /health/ready reports 503 when the database is unreachable', async () => {
  dbConnectionStub._ready = false;
  const response = await call('/health/ready');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'unavailable' });
  dbConnectionStub._ready = true;
});

// --- Error handling ------------------------------------------------
test('unknown /api routes return 404', async () => {
  const response = await call('/api/does-not-exist', {
    headers: { cookie: validSessionCookie() },
  });
  assert.equal(response.status, 404);
});

test('malformed JSON bodies are turned into a 400 by the error handler', async () => {
  const response = await call('/api/logout', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
    },
    body: '{ not valid json',
  });
  assert.equal(response.status, 400);
});
