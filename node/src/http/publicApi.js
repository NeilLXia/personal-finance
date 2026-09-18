'use strict';

// The one server-to-server endpoint: Plaid calls it directly, so it has no
// browser Origin and no session. Referenced by the body parser (raw body
// capture), the trusted-origin middleware (CSRF exemption) and the auth gate
// (auth exemption).
const WEBHOOK_PATH = '/api/webhook';

// Everything under /api requires a session except these routes. The service
// layer also calls requireCurrentUser() as defense in depth, but this Set is the
// single place to audit the unauthenticated surface.
const PUBLIC_API_ROUTES = new Set([
  'GET /api/session',
  'POST /api/login/google',
  'POST /api/login/demo',
  'POST /api/logout',
  `POST ${WEBHOOK_PATH}`,
]);

module.exports = { WEBHOOK_PATH, PUBLIC_API_ROUTES };
