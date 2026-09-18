'use strict';

/**
 * Build an Error carrying an HTTP `status` (and optional `data`) so the shared
 * error middleware can turn it into a response. Replaces the hand-rolled
 * `const error = new Error(msg); error.status = 400; throw error;` pattern.
 */
const httpError = (status, message, data) => {
  const error = new Error(message);
  error.status = status;

  if (data !== undefined) {
    error.data = data;
  }

  return error;
};

module.exports = { httpError };
