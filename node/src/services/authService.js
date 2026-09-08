'use strict';

const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const { OAuth2Client } = require('google-auth-library');
const models = require('../models');
const logger = require('../lib/logger');
const { parsePositiveNumber } = require('../lib/httpTimeout');
const {
  clearDemoSessionData,
  cleanupExpiredDemoUsers,
  createDemoSessionData,
} = require('./demo');

const sessionStorage = new AsyncLocalStorage();
const googleOAuthClient = new OAuth2Client();
const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'finance_session';
const allowedAuthEmails = (process.env.ALLOWED_AUTH_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production';
const sessionMaxAgeSeconds = parsePositiveNumber(
  process.env.SESSION_MAX_AGE_SECONDS,
  60 * 60 * 24 * 30,
);
const DEV_SESSION_SECRET = 'dev-session-secret';
const MIN_SESSION_SECRET_LENGTH = 32;

// Every session cookie is signed with this key. It must be a real, dedicated
// secret: it is the only thing standing between a forged cookie and a logged-in
// session. Deliberately has no fallback to other secrets (e.g. the Plaid
// secret) — sharing one secret across subsystems means rotating one silently
// breaks the other, and widens the blast radius if either leaks.
const resolveSessionSecret = () => {
  const configured =
    typeof process.env.SESSION_SECRET === 'string'
      ? process.env.SESSION_SECRET.trim()
      : '';
  const isPlaceholder =
    configured === '' ||
    configured === DEV_SESSION_SECRET ||
    /^replace-with-/i.test(configured);

  if (!isPlaceholder && configured.length >= MIN_SESSION_SECRET_LENGTH) {
    return configured;
  }

  if (isProduction) {
    throw new Error(
      `SESSION_SECRET must be set to a random string of at least ${MIN_SESSION_SECRET_LENGTH} characters in production ` +
        '(it is currently unset, a placeholder, or too short).',
    );
  }

  if (!isPlaceholder && configured.length > 0) {
    // Non-production: honour whatever was set, even if it is short.
    return configured;
  }

  logger.warn(
    'SESSION_SECRET is not set — using an insecure development default. Set SESSION_SECRET before deploying.',
  );
  return DEV_SESSION_SECRET;
};

const sessionSecret = resolveSessionSecret();

const encodeBase64Url = (value) => Buffer.from(value).toString('base64url');

const decodeBase64Url = (value) =>
  Buffer.from(value, 'base64url').toString('utf8');

const sign = (value) =>
  crypto.createHmac('sha256', sessionSecret).update(value).digest('base64url');

const parseCookies = (cookieHeader = '') =>
  cookieHeader.split(';').reduce((cookies, cookie) => {
    const separatorIndex = cookie.indexOf('=');

    if (separatorIndex === -1) {
      return cookies;
    }

    const name = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();

    if (name) {
      cookies[name] = decodeURIComponent(value);
    }

    return cookies;
  }, {});

const serializeCookie = (name, value, options = {}) => {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge != null) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  parts.push('Path=/');
  parts.push('HttpOnly');
  parts.push('SameSite=Lax');

  if (isProduction) {
    parts.push('Secure');
  }

  return parts.join('; ');
};

const createSessionToken = (user, { maxAge = sessionMaxAgeSeconds } = {}) => {
  const issuedAt = Date.now();
  const payload = encodeBase64Url(
    JSON.stringify({
      user_id: user.id,
      email: user.email,
      is_demo: Boolean(user.is_demo),
      created_at: issuedAt,
      expires_at: issuedAt + maxAge * 1000,
    }),
  );

  return `${payload}.${sign(payload)}`;
};

const readSessionToken = (token) => {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split('.');

  if (!payload || !signature || sign(payload) !== signature) {
    return null;
  }

  try {
    const session = JSON.parse(decodeBase64Url(payload));
    const expiresAt = Number(session.expires_at);

    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
};

const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatar_url: user.avatar_url,
  is_demo: Boolean(user.is_demo),
  demo_expires_at: user.demo_expires_at || null,
});

const setSessionCookie = (response, user, options = {}) => {
  const maxAge = options.maxAge || sessionMaxAgeSeconds;

  response.setHeader(
    'Set-Cookie',
    serializeCookie(sessionCookieName, createSessionToken(user, { maxAge }), {
      maxAge,
    }),
  );
};

const clearSessionCookie = (response) => {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(sessionCookieName, '', {
      maxAge: 0,
    }),
  );
};

const attachSessionContext = async (request, response, next) => {
  const cookies = parseCookies(request.headers.cookie || '');
  const session = readSessionToken(cookies[sessionCookieName]);
  let user = null;

  if (session?.user_id) {
    user = await models.users.findById(session.user_id);
  }

  if (models.users.isExpiredDemoUser(user)) {
    clearSessionCookie(response);
    await clearDemoSessionData(user.id);
    user = null;
  }

  request.user = user;
  sessionStorage.run({ user }, next);
};

const getCurrentUserFromSession = () => sessionStorage.getStore()?.user || null;

const requireCurrentUser = () => {
  const user = getCurrentUserFromSession();

  if (!user) {
    const error = new Error('Please sign in to continue.');
    error.status = 401;
    throw error;
  }

  return user;
};

// App-wide "who is this request for" accessor. Async so callers can `await` it
// uniformly; every domain service (dashboard, properties, payslips, budget
// targets, transactions) resolves the current user through this.
const getCurrentUser = async () => requireCurrentUser();

const verifyGoogleCredential = async (credential) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    const error = new Error('GOOGLE_CLIENT_ID is not configured.');
    error.status = 500;
    throw error;
  }

  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const profile = ticket.getPayload();

    if (!profile?.email) {
      const error = new Error('Google account email was not provided.');
      error.status = 401;
      throw error;
    }

    if (profile.email_verified !== 'true' && profile.email_verified !== true) {
      const error = new Error('Google account email is not verified.');
      error.status = 401;
      throw error;
    }

    return {
      email: profile.email,
      name: profile.name || profile.email,
      googleSub: profile.sub,
      avatarUrl: profile.picture || null,
    };
  } catch (error) {
    if (error.status) {
      throw error;
    }

    const verificationError = new Error('Google sign-in could not be verified.');
    verificationError.status = 401;
    throw verificationError;
  }
};

const loginWithGoogle = async ({ credential, response }) => {
  if (isProduction && allowedAuthEmails.length === 0) {
    const error = new Error(
      'Google sign-in is not configured for production. Set ALLOWED_AUTH_EMAILS before enabling registration.',
    );
    error.status = 503;
    throw error;
  }

  const profile = await verifyGoogleCredential(credential);

  if (
    allowedAuthEmails.length > 0 &&
    !allowedAuthEmails.includes(profile.email.toLowerCase())
  ) {
    const error = new Error(
      'This Google account is not allowed to sign in. Please contact the developer to request access.',
    );
    error.status = 403;
    throw error;
  }

  const user = await models.users.upsertFromGoogleProfile(profile);
  setSessionCookie(response, user);

  return { user: toPublicUser(user) };
};

const loginAsDemo = async ({ response }) => {
  await cleanupExpiredDemoUsers();
  const user = await createDemoSessionData();

  setSessionCookie(response, user, {
    maxAge: 60 * 60 * 24,
  });

  return { user: toPublicUser(user) };
};

const getSession = () => {
  const user = getCurrentUserFromSession();
  return {
    authenticated: Boolean(user),
    user: user ? toPublicUser(user) : null,
    google_client_id: process.env.GOOGLE_CLIENT_ID || null,
  };
};

const logout = async ({ response }) => {
  const user = getCurrentUserFromSession();
  clearSessionCookie(response);

  if (user?.is_demo) {
    await clearDemoSessionData(user.id);
  }

  return { authenticated: false, user: null };
};

module.exports = {
  attachSessionContext,
  getCurrentUser,
  getCurrentUserFromSession,
  requireCurrentUser,
  loginWithGoogle,
  loginAsDemo,
  getSession,
  logout,
};
