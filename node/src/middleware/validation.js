'use strict';

const createValidationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const validateString = (value, field, options = {}) => {
  const {
    required = false,
    allowEmpty = false,
    maxLength = 1000,
    pattern = null,
  } = options;

  if (value === undefined || value === null) {
    if (required) {
      throw createValidationError(`${field} is required.`);
    }
    return value;
  }

  if (typeof value !== 'string') {
    throw createValidationError(`${field} must be a string.`);
  }

  const trimmed = value.trim();

  if (!allowEmpty && trimmed.length === 0) {
    throw createValidationError(`${field} cannot be empty.`);
  }

  if (trimmed.length > maxLength) {
    throw createValidationError(`${field} must be ${maxLength} characters or fewer.`);
  }

  if (pattern && !pattern.test(trimmed)) {
    throw createValidationError(`${field} is invalid.`);
  }

  return trimmed;
};

const validateNumber = (value, field, options = {}) => {
  const {
    required = false,
    min = null,
    max = null,
    nullable = true,
  } = options;

  if (value === undefined || value === null || value === '') {
    if (required && !(nullable && value === null)) {
      throw createValidationError(`${field} is required.`);
    }
    return nullable ? null : value;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw createValidationError(`${field} must be a number.`);
  }

  if (min !== null && number < min) {
    throw createValidationError(`${field} must be at least ${min}.`);
  }

  if (max !== null && number > max) {
    throw createValidationError(`${field} must be at most ${max}.`);
  }

  return number;
};

const validateInteger = (value, field, options = {}) => {
  const number = validateNumber(value, field, {
    ...options,
    nullable: false,
  });

  if (!Number.isInteger(number)) {
    throw createValidationError(`${field} must be an integer.`);
  }

  return number;
};

const validateBody = (request, validator) => {
  if (!isPlainObject(request.body)) {
    throw createValidationError('Request body must be a JSON object.');
  }

  return validator(request.body);
};

const validateQuery = (request, validator) => validator(request.query || {});

const validateParams = (request, validator) => validator(request.params || {});

module.exports = {
  createValidationError,
  validateBody,
  validateInteger,
  validateNumber,
  validateParams,
  validateQuery,
  validateString,
};
