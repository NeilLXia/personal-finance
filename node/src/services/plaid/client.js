'use strict';

const {
  Configuration,
  PlaidApi,
  Products,
  PlaidEnvironments,
} = require('plaid');
const logger = require('../../lib/logger');
const { parsePositiveNumber } = require('../../lib/httpTimeout');

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const plaidEnv = process.env.PLAID_ENV || 'sandbox';
const supportedPlaidEnvironments = ['sandbox', 'production'];

if (!supportedPlaidEnvironments.includes(plaidEnv)) {
  throw new Error(
    `Unsupported PLAID_ENV "${plaidEnv}". Use one of: ${supportedPlaidEnvironments.join(
      ', ',
    )}.`,
  );
}

const secretByEnvironment = {
  sandbox: process.env.PLAID_SANDBOX_SECRET,
  production: process.env.PLAID_PRODUCTION_SECRET,
};
const PLAID_SECRET = secretByEnvironment[plaidEnv] || process.env.PLAID_SECRET;

if (!PLAID_SECRET) {
  throw new Error(
    `Missing Plaid secret for PLAID_ENV "${plaidEnv}". Set PLAID_${plaidEnv.toUpperCase()}_SECRET in .env.`,
  );
}

const products = (process.env.PLAID_PRODUCTS || Products.Transactions).split(
  ',',
);
const countryCodes = (process.env.PLAID_COUNTRY_CODES || 'US').split(',');
const redirectUri = process.env.PLAID_REDIRECT_URI || '';
const webhookUrl = process.env.PLAID_WEBHOOK_URL || '';
const plaidRequestTimeoutMs = parsePositiveNumber(
  process.env.PLAID_REQUEST_TIMEOUT_MS,
  30000,
);

const plaidClients = new Map();

const getPlaidSecret = (environment) =>
  secretByEnvironment[environment] || process.env.PLAID_SECRET;

const createPlaidClient = (environment) => {
  const secret = getPlaidSecret(environment);

  if (!secret) {
    throw new Error(
      `Missing Plaid secret for PLAID_ENV "${environment}". Set PLAID_${environment.toUpperCase()}_SECRET in .env.`,
    );
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[environment],
    baseOptions: {
      timeout: plaidRequestTimeoutMs,
      headers: {
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': secret,
        'Plaid-Version': '2020-09-14',
      },
    },
  });

  return new PlaidApi(configuration);
};

const getPlaidClient = (environment = plaidEnv) => {
  if (!supportedPlaidEnvironments.includes(environment)) {
    throw new Error(
      `Unsupported Plaid environment "${environment}". Use one of: ${supportedPlaidEnvironments.join(
        ', ',
      )}.`,
    );
  }

  if (!plaidClients.has(environment)) {
    plaidClients.set(environment, createPlaidClient(environment));
  }

  return plaidClients.get(environment);
};

const client = getPlaidClient(plaidEnv);

const getPlaidResponseSummary = (data = {}) => ({
  request_id: data.request_id,
  item_id: data.item?.item_id || data.item_id,
  keys: Object.keys(data).sort(),
  account_count: Array.isArray(data.accounts) ? data.accounts.length : undefined,
  added_count: Array.isArray(data.added) ? data.added.length : undefined,
  modified_count: Array.isArray(data.modified) ? data.modified.length : undefined,
  removed_count: Array.isArray(data.removed) ? data.removed.length : undefined,
  has_more: data.has_more,
});

const logPlaidResponse = (response) => {
  logger.info('Plaid response received', getPlaidResponseSummary(response.data));
};

module.exports = {
  client,
  Products,
  plaidEnv,
  getPlaidClient,
  products,
  countryCodes,
  redirectUri,
  webhookUrl,
  logPlaidResponse,
};
