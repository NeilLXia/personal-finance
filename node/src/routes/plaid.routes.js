'use strict';

const express = require('express');

const linkService = require('../services/plaid/linkService');
const {
  refreshAccountBalanceSnapshots,
} = require('../services/plaid/accountBalanceSnapshotService');
const {
  handlePlaidWebhook,
  verifyPlaidWebhookRequest,
} = require('../services/plaid/webhookService');
const { route } = require('../http/asyncRoute');
const { syncLimiter, mutationLimiter } = require('../middleware/rateLimiters');
const {
  validateBody,
  validateParams,
  validateString,
} = require('../middleware/validation');

const router = express.Router();

router.post(
  '/create_link_token',
  syncLimiter,
  route(async (request, response) => {
    const body = validateBody(request, (value) => ({
      plaidItemId: validateString(value.plaid_item_id, 'plaid_item_id', {
        required: false,
        maxLength: 200,
      }),
    }));

    response.json(
      await linkService.createLinkToken({ plaidItemId: body.plaidItemId }),
    );
  }),
);

router.post(
  '/set_access_token',
  syncLimiter,
  route(async (request, response) => {
    const body = validateBody(request, (value) => ({
      publicToken: validateString(value.public_token, 'public_token', {
        required: true,
        maxLength: 500,
      }),
    }));

    response.json(await linkService.exchangePublicToken(body.publicToken));
  }),
);

router.delete(
  '/plaid-items/:plaidItemId',
  mutationLimiter,
  route(async (request, response) => {
    const plaidItemId = validateParams(request, (params) =>
      validateString(params.plaidItemId, 'plaidItemId', {
        required: true,
        maxLength: 200,
      }),
    );

    response.json(await linkService.removeConnection(plaidItemId));
  }),
);

router.post(
  '/account-balance-snapshots/refresh',
  syncLimiter,
  route(async (request, response) => {
    response.json(await refreshAccountBalanceSnapshots());
  }),
);

router.post(
  '/webhook',
  route(async (request, response) => {
    await verifyPlaidWebhookRequest(request);
    response.json(await handlePlaidWebhook(request.body));
  }),
);

module.exports = router;
