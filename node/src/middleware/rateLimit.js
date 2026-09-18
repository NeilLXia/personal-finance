'use strict';

const defaultWindowMs = 15 * 60 * 1000;

const createRateLimiter = ({
  windowMs = defaultWindowMs,
  max = 100,
  keyPrefix = 'default',
} = {}) => {
  const hits = new Map();

  return (request, response, next) => {
    const now = Date.now();
    const user = request.user || {};
    const identity = user.id || request.ip || request.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${identity}`;
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      next();
      return;
    }

    current.count += 1;

    if (current.count > max) {
      response.setHeader(
        'Retry-After',
        String(Math.ceil((current.resetAt - now) / 1000)),
      );
      response.status(429).json({
        error: {
          error_message: 'Too many requests. Please wait and try again.',
        },
      });
      return;
    }

    next();
  };
};

module.exports = {
  createRateLimiter,
};
