'use strict';

/**
 * 409 raised by the account / plaid-item upserts when an `ON CONFLICT` row is
 * owned by a different user, so one user can't hijack another's linked resource.
 */
const createOwnershipConflictError = (resource) => {
  const error = new Error(`${resource} is already linked to another user.`);
  error.status = 409;
  return error;
};

module.exports = { createOwnershipConflictError };
