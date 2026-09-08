'use strict';

const models = require('../../models');
const logger = require('../../lib/logger');
const {
  getPlaidClient,
  Products,
  products,
  countryCodes,
  redirectUri,
  webhookUrl,
  logPlaidResponse,
} = require('./client');
const {
  getCurrentPlaidEnvironment,
  getCurrentUser,
} = require('./plaidContext');
const { saveAccounts } = require('./persistenceService');
const { syncTransactionsForPlaidItemId } = require('./transactionSyncService');

const createLinkToken = async ({ plaidItemId } = {}) => {
  const user = await getCurrentUser();
  const plaidEnv = await getCurrentPlaidEnvironment();
  const client = getPlaidClient(plaidEnv);
  const plaidItem = plaidItemId
    ? await models.plaidItems.findByPlaidItemId(plaidItemId)
    : null;

  if (plaidItemId && (!plaidItem || plaidItem.user_id !== user.id)) {
    const error = new Error('Plaid Item was not found for the current user');
    error.status = 404;
    throw error;
  }

  if (plaidItem && plaidItem.plaid_environment !== plaidEnv) {
    const error = new Error(
      `Plaid Item belongs to ${plaidItem.plaid_environment}, but the app is running in ${plaidEnv}`,
    );
    error.status = 400;
    throw error;
  }

  const configs = {
    user: {
      client_user_id: String(user.id),
    },
    client_name: 'Personal Finance',
    language: 'en',
  };

  if (plaidItem) {
    configs.access_token = plaidItem.access_token;
  } else {
    configs.products = products;
    configs.country_codes = countryCodes;

    if (products.includes(Products.Transactions)) {
      configs.transactions = {
        days_requested: Number(
          process.env.PLAID_TRANSACTIONS_DAYS_REQUESTED || 730,
        ),
      };
    }
  }

  if (redirectUri !== '') {
    configs.redirect_uri = redirectUri;
  }

  if (webhookUrl !== '') {
    configs.webhook = webhookUrl;
  }

  const response = await client.linkTokenCreate(configs);
  logPlaidResponse(response);
  return response.data;
};

const exchangePublicToken = async (publicToken) => {
  const plaidEnv = await getCurrentPlaidEnvironment();
  const client = getPlaidClient(plaidEnv);
  const tokenResponse = await client.itemPublicTokenExchange({
    public_token: publicToken,
  });
  logPlaidResponse(tokenResponse);

  const user = await getCurrentUser();
  const itemResponse = await client.itemGet({
    access_token: tokenResponse.data.access_token,
  });
  const institutionId = itemResponse.data.item.institution_id;
  let institutionName = null;

  if (institutionId) {
    const institutionResponse = await client.institutionsGetById({
      institution_id: institutionId,
      country_codes: countryCodes,
    });
    institutionName = institutionResponse.data.institution.name;
  }

  await models.plaidItems.upsert({
    userId: user.id,
    plaidItemId: tokenResponse.data.item_id,
    accessToken: tokenResponse.data.access_token,
    plaidEnvironment: plaidEnv,
    institutionId,
    institutionName,
  });
  const accountsResponse = await client.accountsGet({
    access_token: tokenResponse.data.access_token,
  });
  await saveAccounts({
    userId: user.id,
    plaidItemId: tokenResponse.data.item_id,
    accounts: accountsResponse.data.accounts,
  });
  const transactionSync = await syncTransactionsForPlaidItemId(
    tokenResponse.data.item_id,
    {
      pendingRetries: Number(process.env.PLAID_LINK_TRANSACTION_SYNC_RETRIES || 6),
      pendingRetryMs: Number(process.env.PLAID_LINK_TRANSACTION_SYNC_RETRY_MS || 2000),
    },
  );
  const deletedStaleItems =
    await models.plaidItems.pruneStaleForUserEnvironment({
      userId: user.id,
      plaidEnvironment: plaidEnv,
    });
  logger.info('Plaid cleanup pruned stale data after token exchange', {
    user_id: user.id,
    plaid_environment: plaidEnv,
    deleted_items: deletedStaleItems.deletedItems.length,
    deleted_accounts: deletedStaleItems.deletedAccounts.length,
    deleted_transactions: deletedStaleItems.deletedTransactions.length,
  });

  return {
    access_token: null,
    item_id: tokenResponse.data.item_id,
    transaction_sync: transactionSync,
    deleted_stale_items: deletedStaleItems.deletedItems.length,
    error: null,
  };
};

const removeConnection = async (plaidItemId) => {
  const user = await getCurrentUser();
  const plaidEnv = await getCurrentPlaidEnvironment();
  const client = getPlaidClient(plaidEnv);
  const plaidItem = await models.plaidItems.findByPlaidItemId(plaidItemId);

  if (!plaidItem || plaidItem.user_id !== user.id) {
    const error = new Error('Plaid Item was not found for the current user');
    error.status = 404;
    throw error;
  }

  if (plaidItem.plaid_environment !== plaidEnv) {
    const error = new Error(
      `Plaid Item belongs to ${plaidItem.plaid_environment}, but the app is running in ${plaidEnv}`,
    );
    error.status = 400;
    throw error;
  }

  await client.itemRemove({
    access_token: plaidItem.access_token,
  });

  const deleted = await models.plaidItems.deleteByPlaidItemIdForUser({
    plaidItemId,
    userId: user.id,
  });

  return {
    plaid_item_id: plaidItemId,
    deleted_items: deleted.deletedItems.length,
    deleted_accounts: deleted.deletedAccounts.length,
    deleted_transactions: deleted.deletedTransactions.length,
    error: null,
  };
};

module.exports = {
  createLinkToken,
  exchangePublicToken,
  removeConnection,
};
