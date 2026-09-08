'use strict';

const { WEBHOOK_PATH } = require('../http/publicApi');

const corsOrigins = (
  process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const safeNoOriginMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const serverToServerNoOriginPaths = new Set([WEBHOOK_PATH]);

const getRequestPath = (request) => request.originalUrl.split('?')[0];

const isNoOriginRequestAllowed = (request) =>
  safeNoOriginMethods.has(request.method) ||
  serverToServerNoOriginPaths.has(getRequestPath(request));

const getOriginFromReferer = (referer) => {
  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch (error) {
    return null;
  }
};

const isTrustedOrigin = (origin) =>
  Boolean(origin && corsOrigins.includes(origin));

const createOriginError = () => {
  const error = new Error(
    'A trusted Origin or Referer header is required for this request.',
  );
  error.status = 403;
  return error;
};

/**
 * CSRF guard: state-changing /api requests must carry a trusted Origin (or
 * Referer). Safe methods and the server-to-server webhook are exempt.
 */
const requireTrustedRequestOrigin = (request, response, next) => {
  const requestPath = getRequestPath(request);

  if (!requestPath.startsWith('/api')) {
    next();
    return;
  }

  if (serverToServerNoOriginPaths.has(requestPath)) {
    next();
    return;
  }

  if (safeNoOriginMethods.has(request.method)) {
    next();
    return;
  }

  const origin = request.get('origin');

  if (origin) {
    if (isTrustedOrigin(origin)) {
      next();
      return;
    }

    next(createOriginError());
    return;
  }

  const refererOrigin = getOriginFromReferer(request.get('referer'));

  if (isTrustedOrigin(refererOrigin)) {
    next();
    return;
  }

  next(createOriginError());
};

const getCorsOptions = (request, callback) => {
  const origin = request.get('origin');

  if (!origin) {
    callback(null, {
      credentials: true,
      origin: isNoOriginRequestAllowed(request),
    });
    return;
  }

  if (isTrustedOrigin(origin)) {
    callback(null, {
      credentials: true,
      origin: true,
    });
    return;
  }

  const error = new Error('Not allowed by CORS');
  error.status = 403;
  callback(error);
};

module.exports = {
  corsOrigins,
  requireTrustedRequestOrigin,
  getCorsOptions,
};
