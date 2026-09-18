'use strict';

/**
 * Wrap an async route handler so a rejected promise is forwarded to the Express
 * error middleware instead of becoming an unhandled rejection.
 */
const route = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response)).catch(next);
};

module.exports = { route };
