'use strict';

const express = require('express');
const cors = require('cors');

const securityHeaders = require('./middleware/securityHeaders');
const {
  urlencodedBodyParser,
  jsonBodyParser,
} = require('./middleware/bodyParsers');
const {
  getCorsOptions,
  requireTrustedRequestOrigin,
} = require('./middleware/trustedOrigin');
const { generalLimiter } = require('./middleware/rateLimiters');
const { attachSession, requireApiAuth } = require('./middleware/apiAuthGate');
const { errorHandler } = require('./middleware/errorHandler');
const apiRoutes = require('./routes');
const healthRoutes = require('./routes/health.routes');

/**
 * Build the Express app with the full middleware pipeline. Kept free of any
 * side effects (no port bind, no DB connect) so tests can exercise the real
 * pipeline without a running server. `index.js` wires this into `startServer`.
 */
const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

  // Global middleware — order matters.
  app.use(securityHeaders);
  app.use(urlencodedBodyParser);
  app.use(jsonBodyParser);
  app.use(cors(getCorsOptions));
  app.use(requireTrustedRequestOrigin);

  // Unauthenticated, unthrottled liveness/readiness probes for load balancers
  // and container orchestrators. Mounted before the /api pipeline so a probe
  // never consumes a rate-limit slot or needs a session.
  app.use('/health', healthRoutes);

  // API pipeline: rate limit -> attach session -> auth gate -> routes -> errors.
  app.use('/api', generalLimiter);
  app.use('/api', attachSession);
  app.use('/api', requireApiAuth);
  app.use('/api', apiRoutes);
  app.use('/api', errorHandler);

  return app;
};

module.exports = { createApp };
