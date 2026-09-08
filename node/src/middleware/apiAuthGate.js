'use strict';

const authService = require('../services/authService');
const { PUBLIC_API_ROUTES } = require('../http/publicApi');

/**
 * Populate request.user from the session cookie (never rejects on its own).
 */
const attachSession = (request, response, next) => {
  authService.attachSessionContext(request, response, next).catch(next);
};

/**
 * The single authentication gate for the API. Everything under /api requires a
 * session except PUBLIC_API_ROUTES.
 */
const requireApiAuth = (request, response, next) => {
  const path = request.originalUrl.split('?')[0].replace(/\/+$/, '') || '/';

  if (PUBLIC_API_ROUTES.has(`${request.method} ${path}`)) {
    next();
    return;
  }

  if (!request.user) {
    response.status(401).json({
      error: { error_message: 'Authentication required.' },
    });
    return;
  }

  next();
};

module.exports = { attachSession, requireApiAuth };
