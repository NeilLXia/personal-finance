'use strict';

const {
  GetSecretValueCommand,
  SecretsManagerClient,
} = require('@aws-sdk/client-secrets-manager');

const logger = require('../lib/logger');

const DEFAULT_REGION = 'us-east-1';

let cachedClient;

const defaultSend = (command, { region }) => {
  if (!cachedClient) {
    cachedClient = new SecretsManagerClient({ region });
  }

  return cachedClient.send(command);
};

/**
 * Map a resolved secret onto the DB_* vars that db/connection.js reads.
 *
 * RDS-managed secrets store JSON like
 *   { username, password, host, port, dbname, engine }
 * A hand-rolled secret may just be the raw password string.
 *
 * The credential fields (username, password) always come from the secret since
 * that is the value that rotates. Connection targeting (host, port, name) only
 * fills in when the operator left it unset in .env — a proxy or tunnel endpoint
 * set explicitly should win over whatever the secret happens to carry.
 */
const applySecretValue = (secretString, env) => {
  let parsed = null;

  try {
    const candidate = JSON.parse(secretString);
    if (candidate && typeof candidate === 'object') {
      parsed = candidate;
    }
  } catch {
    parsed = null;
  }

  if (!parsed) {
    env.DB_PASSWORD = secretString;
    return;
  }

  if (parsed.password != null) {
    env.DB_PASSWORD = String(parsed.password);
  }
  if (parsed.username != null) {
    env.DB_USER = String(parsed.username);
  }
  if (parsed.host != null && !env.DB_HOST) {
    env.DB_HOST = String(parsed.host);
  }
  if (parsed.port != null && !env.DB_PORT) {
    env.DB_PORT = String(parsed.port);
  }
  if (parsed.dbname != null && !env.DB_NAME) {
    env.DB_NAME = String(parsed.dbname);
  }
};

/**
 * When DB_SECRET_ID is set, fetch that secret from AWS Secrets Manager and load
 * the database credentials into process.env before anything builds the pool.
 * No-op (returns false) when DB_SECRET_ID is unset, so local Docker development
 * is unaffected.
 *
 * Must be awaited before requiring src/db/connection — that module reads
 * process.env at load time.
 *
 * @param {object}   [options]
 * @param {object}   [options.env=process.env]
 * @param {Function} [options.send] injection point for tests; receives
 *   (command, { region }) and returns the GetSecretValue response.
 * @returns {Promise<boolean>} whether a secret was applied.
 */
const resolveDatabaseSecret = async ({
  env = process.env,
  send = defaultSend,
} = {}) => {
  const secretId = env.DB_SECRET_ID;

  if (!secretId) {
    return false;
  }

  const region =
    env.AWS_REGION || env.AWS_DEFAULT_REGION || DEFAULT_REGION;

  const response = await send(
    new GetSecretValueCommand({ SecretId: secretId }),
    { region },
  );

  const secretString =
    response.SecretString ||
    (response.SecretBinary
      ? Buffer.from(response.SecretBinary).toString('utf8')
      : '');

  if (!secretString) {
    throw new Error(
      `Secret "${secretId}" has no value (empty SecretString and SecretBinary).`,
    );
  }

  applySecretValue(secretString, env);

  // connection.js prefers DATABASE_URL when it is set, which would mask the
  // credentials we just loaded. A secret and a connection string together is a
  // misconfiguration; drop the string so the secret takes effect.
  if (env.DATABASE_URL) {
    logger.warn(
      'DB_SECRET_ID and DATABASE_URL are both set; ignoring DATABASE_URL in favour of the secret.',
    );
    delete env.DATABASE_URL;
  }

  logger.info('Loaded database credentials from Secrets Manager', {
    secret_id: secretId,
    region,
  });

  return true;
};

module.exports = { resolveDatabaseSecret, applySecretValue };
