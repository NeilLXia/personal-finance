'use strict';

const {
  createValidationError,
  validateInteger,
  validateParams,
  validateString,
} = require('../middleware/validation');
const { numericIdPattern, datePattern } = require('./patterns');

const parseIdParam = (request, field = 'id') =>
  validateInteger(
    validateParams(request, (params) =>
      validateString(params[field], field, {
        required: true,
        pattern: numericIdPattern,
      }),
    ),
    field,
    { min: 1 },
  );

const requirePdfUpload = (request) => {
  if (!request.file?.buffer) {
    throw createValidationError('payslip_pdf is required.');
  }

  return request.file;
};

/**
 * Reject any query key not in `allowed` so a client typo fails loudly instead of
 * silently falling through to a default.
 */
const rejectUnknownParams = (query, allowed) => {
  const unknown = Object.keys(query).filter((key) => !allowed.has(key));

  if (unknown.length > 0) {
    throw createValidationError(
      `Unknown query parameter(s): ${unknown.join(', ')}.`,
    );
  }
};

/**
 * Validate a `<prefix>_start_date` / `<prefix>_end_date` pair against its range
 * selector:
 *   - `range=custom`  -> both dates required
 *   - otherwise       -> neither date allowed
 *   - start must be on or before end (ISO YYYY-MM-DD compares lexically)
 */
const parseDateWindow = (query, prefix, rangeField, rangeValue) => {
  const startDate = validateString(
    query[`${prefix}_start_date`],
    `${prefix}_start_date`,
    { pattern: datePattern, required: false },
  );
  const endDate = validateString(
    query[`${prefix}_end_date`],
    `${prefix}_end_date`,
    { pattern: datePattern, required: false },
  );

  if (rangeValue === 'custom') {
    if (!startDate || !endDate) {
      throw createValidationError(
        `${prefix}_start_date and ${prefix}_end_date are both required when ${rangeField}=custom.`,
      );
    }
  } else if (startDate || endDate) {
    throw createValidationError(
      `${prefix}_start_date / ${prefix}_end_date are only allowed when ${rangeField}=custom.`,
    );
  }

  if (startDate && endDate && startDate > endDate) {
    throw createValidationError(
      `${prefix}_start_date must be on or before ${prefix}_end_date.`,
    );
  }

  return { startDate, endDate };
};

module.exports = {
  parseIdParam,
  requirePdfUpload,
  rejectUnknownParams,
  parseDateWindow,
};
