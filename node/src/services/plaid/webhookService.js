'use strict';

const crypto = require('crypto');
const logger = require('../../lib/logger');
const { syncTransactionsForPlaidItemId } = require('./transactionSyncService');
const { getPlaidClient } = require('./client');

const webhookVerificationKeyCache = new Map();
const webhookMaxAgeSeconds = 5 * 60;

const decodeBase64UrlJson = (value) =>
  JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

const createUnauthorizedWebhookError = (message) => {
  const error = new Error(message);
  error.status = 401;
  return error;
};

const logWebhook = (message, details = {}) => {
  logger.info(`Plaid webhook ${message}`, details);
};

const getWebhookVerificationKey = async (keyId) => {
  const cachedKey = webhookVerificationKeyCache.get(keyId);
  const now = Math.floor(Date.now() / 1000);

  if (
    cachedKey &&
    (!cachedKey.expired_at || Number(cachedKey.expired_at) > now)
  ) {
    return cachedKey;
  }

  const response = await getPlaidClient().webhookVerificationKeyGet({
    key_id: keyId,
  });
  const key = response.data.key;
  webhookVerificationKeyCache.set(keyId, key);

  return key;
};

const timingSafeEqualHex = (actual, expected) => {
  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
};

const verifyPlaidWebhookRequest = async (request) => {
  try {
    const signedJwt = request.get('Plaid-Verification');

    if (!signedJwt) {
      throw createUnauthorizedWebhookError('Missing Plaid webhook signature.');
    }

    const tokenParts = signedJwt.split('.');

    if (tokenParts.length !== 3) {
      throw createUnauthorizedWebhookError('Invalid Plaid webhook signature.');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = tokenParts;
    const header = decodeBase64UrlJson(encodedHeader);

    if (header.alg !== 'ES256' || !header.kid) {
      throw createUnauthorizedWebhookError(
        'Unsupported Plaid webhook signature.',
      );
    }

    const key = await getWebhookVerificationKey(header.kid);
    const publicKey = crypto.createPublicKey({
      key,
      format: 'jwk',
    });
    const isValidSignature = crypto.verify(
      'sha256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      {
        key: publicKey,
        dsaEncoding: 'ieee-p1363',
      },
      Buffer.from(encodedSignature, 'base64url'),
    );

    if (!isValidSignature) {
      throw createUnauthorizedWebhookError('Invalid Plaid webhook signature.');
    }

    const payload = decodeBase64UrlJson(encodedPayload);
    const issuedAt = Number(payload.iat);
    const now = Math.floor(Date.now() / 1000);

    if (!issuedAt || Math.abs(now - issuedAt) > webhookMaxAgeSeconds) {
      throw createUnauthorizedWebhookError('Expired Plaid webhook signature.');
    }

    if (!payload.request_body_sha256 || !request.rawBody) {
      throw createUnauthorizedWebhookError('Invalid Plaid webhook payload.');
    }

    const requestBodyHash = crypto
      .createHash('sha256')
      .update(request.rawBody)
      .digest('hex');

    if (!timingSafeEqualHex(requestBodyHash, payload.request_body_sha256)) {
      throw createUnauthorizedWebhookError('Plaid webhook body hash mismatch.');
    }
  } catch (error) {
    if (error.status) {
      throw error;
    }

    throw createUnauthorizedWebhookError('Invalid Plaid webhook signature.');
  }
};

const handlePlaidWebhook = async (webhook) => {
  const { webhook_type: webhookType, webhook_code: webhookCode } = webhook;

  logWebhook('received', {
    webhook_type: webhookType,
    webhook_code: webhookCode,
    item_id: webhook.item_id,
  });

  if (webhookType !== 'TRANSACTIONS') {
    logWebhook('ignored', {
      reason: `Unhandled webhook_type ${webhookType}`,
    });

    return {
      status: 'ignored',
      reason: `Unhandled webhook_type ${webhookType}`,
    };
  }

  if (webhookCode !== 'SYNC_UPDATES_AVAILABLE') {
    logWebhook('ignored', {
      reason: `Unhandled transactions webhook_code ${webhookCode}`,
    });

    return {
      status: 'ignored',
      reason: `Unhandled transactions webhook_code ${webhookCode}`,
    };
  }

  logWebhook('accepted; syncing database', {
    item_id: webhook.item_id,
  });

  const syncResult = await syncTransactionsForPlaidItemId(webhook.item_id);

  logWebhook('database updated', {
    item_id: webhook.item_id,
    status: syncResult.status,
    added: syncResult.added,
    modified: syncResult.modified,
    removed: syncResult.removed,
  });

  return {
    status: 'processed',
    webhook_type: webhookType,
    webhook_code: webhookCode,
    item_id: webhook.item_id,
    sync: syncResult,
  };
};

module.exports = {
  handlePlaidWebhook,
  verifyPlaidWebhookRequest,
};
