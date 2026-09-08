'use strict';

const {
  DecryptCommand,
  EncryptCommand,
  KMSClient,
} = require('@aws-sdk/client-kms');

const ciphertextPrefix = 'kms:v1:';
const kmsKeyId = process.env.AWS_KMS_KEY_ID || '';
const kmsRegion =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

let kmsClient;

const getKmsClient = () => {
  if (!kmsClient) {
    kmsClient = new KMSClient({ region: kmsRegion });
  }

  return kmsClient;
};

const isKmsEncryptionConfigured = () => Boolean(kmsKeyId);

const isEncryptedToken = (value) =>
  typeof value === 'string' && value.startsWith(ciphertextPrefix);

const buildEncryptionContext = ({ userId, plaidItemId } = {}) => {
  const context = {
    purpose: 'plaid-access-token',
  };

  if (userId != null) {
    context.user_id = String(userId);
  }

  if (plaidItemId) {
    context.plaid_item_id = String(plaidItemId);
  }

  return context;
};

const encryptToken = async (token, context = {}) => {
  if (!token || isEncryptedToken(token) || !isKmsEncryptionConfigured()) {
    return token;
  }

  const response = await getKmsClient().send(
    new EncryptCommand({
      KeyId: kmsKeyId,
      Plaintext: Buffer.from(token, 'utf8'),
      EncryptionContext: buildEncryptionContext(context),
    }),
  );

  return `${ciphertextPrefix}${Buffer.from(response.CiphertextBlob).toString(
    'base64',
  )}`;
};

const decryptToken = async (token, context = {}) => {
  if (!token || !isEncryptedToken(token)) {
    return token;
  }

  const ciphertext = Buffer.from(
    token.slice(ciphertextPrefix.length),
    'base64',
  );
  const response = await getKmsClient().send(
    new DecryptCommand({
      CiphertextBlob: ciphertext,
      EncryptionContext: buildEncryptionContext(context),
    }),
  );

  return Buffer.from(response.Plaintext).toString('utf8');
};

module.exports = {
  decryptToken,
  encryptToken,
  isEncryptedToken,
  isKmsEncryptionConfigured,
};
