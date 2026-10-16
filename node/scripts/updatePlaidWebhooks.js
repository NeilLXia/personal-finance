'use strict';

// Point every active, non-demo Plaid Item at a new webhook URL. Plaid stores
// the webhook on each Item when it is linked, so changing PLAID_WEBHOOK_URL
// only affects Items linked afterwards; existing Items need this.
//
//   npm run plaid:update-webhooks -- --url https://example.com/api/webhook
//   npm run plaid:update-webhooks -- --url https://example.com/api/webhook --apply
//
// Without --apply it only reports each Item's current webhook. --url defaults
// to PLAID_WEBHOOK_URL.

require('dotenv').config();
const db = require('../src/db/connection');
const models = require('../src/models');
const { getPlaidClient } = require('../src/services/plaid/client');

const readArg = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const webhookUrl = readArg('--url') || process.env.PLAID_WEBHOOK_URL || '';
const apply = process.argv.includes('--apply');

const validateWebhookUrl = (value) => {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid webhook URL: "${value}". Pass --url or set PLAID_WEBHOOK_URL.`);
  }

  if (url.protocol !== 'https:') {
    throw new Error('Webhook URL must use https.');
  }

  if (/ngrok|localhost|127\.0\.0\.1/i.test(url.host)) {
    throw new Error('Refusing to point Items at a tunnel or localhost URL.');
  }
};

const main = async () => {
  validateWebhookUrl(webhookUrl);

  const plaidItems = await models.plaidItems.findActiveNonDemoItems();
  const results = [];

  for (const plaidItem of plaidItems) {
    const plaidClient = getPlaidClient(plaidItem.plaid_environment);
    const result = {
      id: plaidItem.id,
      user_id: plaidItem.user_id,
      institution_name: plaidItem.institution_name,
    };

    try {
      const { data } = await plaidClient.itemGet({
        access_token: plaidItem.access_token,
      });
      result.previous_webhook = data.item.webhook || null;

      if (result.previous_webhook === webhookUrl) {
        result.status = 'unchanged';
      } else if (!apply) {
        result.status = 'would_update';
      } else {
        const response = await plaidClient.itemWebhookUpdate({
          access_token: plaidItem.access_token,
          webhook: webhookUrl,
        });
        result.webhook = response.data.item.webhook;
        result.status = 'updated';
      }
    } catch (error) {
      result.status = 'failed';
      result.error = error.response?.data?.error_message || error.message;
      process.exitCode = 1;
    }

    results.push(result);
  }

  console.log(
    JSON.stringify({ webhook: webhookUrl, applied: apply, items: results }, null, 2),
  );
};

main()
  .catch((error) => {
    console.error(error.response?.data || error.message || error);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());
