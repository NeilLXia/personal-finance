'use strict';

const logger = require('../lib/logger');

// Values that mean "not really configured" — the .env.example placeholders and
// the development defaults baked into the code.
const PLACEHOLDER_VALUES = new Set([
  '',
  'dev-session-secret',
  'devpassword',
  'replace-with-a-long-random-string',
]);

const isPlaceholder = (value) => {
  if (value == null) {
    return true;
  }

  const trimmed = String(value).trim();

  return PLACEHOLDER_VALUES.has(trimmed) || /^replace-with-/i.test(trimmed);
};

const looksLikeLocalhost = (value) =>
  /localhost|127\.0\.0\.1/.test(String(value || ''));

/**
 * Inspect the environment and return { errors, warnings }. Errors are only
 * populated when NODE_ENV === 'production' — in development the app is expected
 * to run on the defaults.
 */
const validateConfig = ({ env = process.env } = {}) => {
  const errors = [];
  const warnings = [];
  const isProduction = env.NODE_ENV === 'production';

  if (!isProduction) {
    return { errors, warnings, isProduction };
  }

  const require = (name, { minLength = 1 } = {}) => {
    const value = env[name];

    if (isPlaceholder(value)) {
      errors.push(`${name} is required in production (unset or a placeholder).`);
      return;
    }

    if (String(value).length < minLength) {
      errors.push(`${name} must be at least ${minLength} characters long.`);
    }
  };

  // Sessions / auth
  require('SESSION_SECRET', { minLength: 32 });
  const sessionMaxAgeSeconds = Number(env.SESSION_MAX_AGE_SECONDS);
  if (
    !Number.isFinite(sessionMaxAgeSeconds) ||
    sessionMaxAgeSeconds <= 0
  ) {
    errors.push('SESSION_MAX_AGE_SECONDS must be a positive number in production.');
  }
  require('GOOGLE_CLIENT_ID');
  if (isPlaceholder(env.ALLOWED_AUTH_EMAILS)) {
    // authService throws on sign-in when this is empty in production.
    errors.push(
      'ALLOWED_AUTH_EMAILS is required in production; Google sign-in is disabled while it is empty.',
    );
  }

  // Database
  if (isPlaceholder(env.DATABASE_URL)) {
    ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].forEach((name) =>
      require(name),
    );

    if (env.DB_PASSWORD === 'devpassword') {
      errors.push('DB_PASSWORD is still the development default.');
    }

    if (env.DB_SSL !== 'true') {
      warnings.push('DB_SSL is not "true" — database traffic may be unencrypted.');
    } else if (env.DB_SSL_REJECT_UNAUTHORIZED === 'false') {
      warnings.push(
        'DB_SSL_REJECT_UNAUTHORIZED is "false" — database TLS certificates will not be verified.',
      );
    }
  }

  // Plaid
  require('PLAID_CLIENT_ID');
  const plaidEnv = env.PLAID_ENV || 'sandbox';
  const plaidSecret =
    plaidEnv === 'production'
      ? env.PLAID_PRODUCTION_SECRET
      : env.PLAID_SANDBOX_SECRET;

  if (isPlaceholder(plaidSecret) && isPlaceholder(env.PLAID_SECRET)) {
    errors.push(
      `Plaid secret for PLAID_ENV="${plaidEnv}" is missing (set PLAID_${plaidEnv.toUpperCase()}_SECRET).`,
    );
  }

  if (plaidEnv !== 'production') {
    warnings.push(`PLAID_ENV is "${plaidEnv}" while NODE_ENV is production.`);
  }

  // Token encryption (KMS)
  require('AWS_KMS_KEY_ID');
  if (isPlaceholder(env.AWS_REGION) && isPlaceholder(env.AWS_DEFAULT_REGION)) {
    errors.push('AWS_REGION (or AWS_DEFAULT_REGION) is required for KMS token encryption.');
  }

  // Networking / proxy
  if (isPlaceholder(env.CORS_ORIGINS) || looksLikeLocalhost(env.CORS_ORIGINS)) {
    warnings.push('CORS_ORIGINS is unset or still points at localhost.');
  }

  if (isPlaceholder(env.TRUST_PROXY)) {
    warnings.push(
      'TRUST_PROXY is unset — client IPs and Secure cookies will be wrong behind a load balancer.',
    );
  }

  return { errors, warnings, isProduction };
};

/**
 * Log warnings, and in production abort the process if any errors were found.
 * Call this before binding the HTTP port.
 */
const assertConfigValid = ({ env = process.env, exit = process.exit } = {}) => {
  const { errors, warnings } = validateConfig({ env });

  warnings.forEach((message) =>
    logger.warn('Configuration warning', { message }),
  );

  if (errors.length === 0) {
    return;
  }

  errors.forEach((message) => logger.error('Configuration error', { message }));
  logger.error('Refusing to start: invalid production configuration', {
    error_count: errors.length,
  });
  exit(1);
};

module.exports = { validateConfig, assertConfigValid, isPlaceholder };
