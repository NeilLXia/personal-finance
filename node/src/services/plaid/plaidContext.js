'use strict';

const models = require('../../models');
const { httpError } = require('../../lib/httpError');
const { getCurrentUser } = require('../authService');
const { plaidEnv } = require('./client');

// Plaid-specific slice of the request context. `getCurrentUser` is re-exported
// from authService so Plaid callers have one import for "user + Plaid env/items".

const getCurrentPlaidEnvironment = async () => {
  const user = await getCurrentUser();
  return user.is_demo ? 'sandbox' : plaidEnv;
};

const getCurrentPlaidItems = async () => {
  const user = await getCurrentUser();
  const currentPlaidEnv = await getCurrentPlaidEnvironment();
  const plaidItems = await models.plaidItems.findByUserIdAndEnvironment(
    user.id,
    currentPlaidEnv,
  );

  if (plaidItems.length === 0) {
    throw httpError(400, 'No Plaid Items have been linked yet');
  }

  return plaidItems;
};

module.exports = {
  getCurrentUser,
  getCurrentPlaidEnvironment,
  getCurrentPlaidItems,
};
