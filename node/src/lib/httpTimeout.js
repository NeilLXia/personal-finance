'use strict';

const createTimeoutSignal = (timeoutMs) => {
  const cleanTimeoutMs = parsePositiveNumber(timeoutMs, 0);

  if (!Number.isFinite(cleanTimeoutMs) || cleanTimeoutMs <= 0) {
    return undefined;
  }

  if (AbortSignal.timeout) {
    return AbortSignal.timeout(cleanTimeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), cleanTimeoutMs);

  return controller.signal;
};

const createTimeoutError = (serviceName, timeoutMs) => {
  const error = new Error(`${serviceName} request timed out after ${timeoutMs}ms`);
  error.status = 504;
  return error;
};

const isTimeoutError = (error) =>
  error?.name === 'AbortError' || error?.name === 'TimeoutError';

const parsePositiveNumber = (value, defaultValue) => {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : defaultValue;
};

module.exports = {
  createTimeoutError,
  createTimeoutSignal,
  isTimeoutError,
  parsePositiveNumber,
};
