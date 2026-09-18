'use strict';

const logger = require('../lib/logger');

const formatError = (error) => ({
  error: { ...error?.data, status_code: error?.status },
});

// Express identifies error middleware by arity (4 args); keep `next` even though
// it is unused.
// eslint-disable-next-line no-unused-vars
const errorHandler = (error, request, response, next) => {
  if (error.response?.data) {
    logger.error('API upstream request failed', {
      method: request.method,
      path: request.originalUrl,
      status: error.response.status,
      error: error.response.data,
    });
  } else {
    logger.error('API request failed', {
      method: request.method,
      path: request.originalUrl,
      status: error.status || 500,
      message: error.message || String(error),
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    });
  }

  if (!error.response) {
    const statusCode = Number(error.status || error.statusCode) || 500;
    const isClientError = statusCode >= 400 && statusCode < 500;

    response.status(statusCode).json({
      error: {
        error_message:
          isClientError && error.message
            ? error.message
            : 'Internal server error',
      },
    });
    return;
  }

  const statusCode = error.response?.status || 500;
  response.status(statusCode).json(formatError(error.response));
};

module.exports = { errorHandler };
