'use strict';

const { createRateLimiter } = require('./rateLimit');

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

const generalLimiter = createRateLimiter({
  keyPrefix: 'general',
  windowMs: FIFTEEN_MINUTES,
  max: Number(process.env.RATE_LIMIT_GENERAL_MAX || 1000),
});
const authLimiter = createRateLimiter({
  keyPrefix: 'auth',
  windowMs: FIFTEEN_MINUTES,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX || 40),
});
const dashboardLimiter = createRateLimiter({
  keyPrefix: 'dashboard',
  windowMs: FIFTEEN_MINUTES,
  max: Number(process.env.RATE_LIMIT_DASHBOARD_MAX || 300),
});
const syncLimiter = createRateLimiter({
  keyPrefix: 'sync',
  windowMs: ONE_HOUR,
  max: Number(process.env.RATE_LIMIT_SYNC_MAX || 30),
});
const addressSearchLimiter = createRateLimiter({
  keyPrefix: 'address-search',
  windowMs: FIFTEEN_MINUTES,
  max: Number(process.env.RATE_LIMIT_ADDRESS_SEARCH_MAX || 120),
});
const mutationLimiter = createRateLimiter({
  keyPrefix: 'mutation',
  windowMs: FIFTEEN_MINUTES,
  max: Number(process.env.RATE_LIMIT_MUTATION_MAX || 120),
});
const uploadLimiter = createRateLimiter({
  keyPrefix: 'upload',
  windowMs: ONE_HOUR,
  max: Number(process.env.RATE_LIMIT_UPLOAD_MAX || 20),
});

module.exports = {
  generalLimiter,
  authLimiter,
  dashboardLimiter,
  syncLimiter,
  addressSearchLimiter,
  mutationLimiter,
  uploadLimiter,
};
