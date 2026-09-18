'use strict';

require('dotenv').config({ quiet: true });

const db = require('../src/db/connection');
const {
  encryptToken,
  isEncryptedToken,
  isKmsEncryptionConfigured,
} = require('../src/services/security/tokenEncryptionService');

const encryptExistingPlaidTokens = async () => {
  if (!isKmsEncryptionConfigured()) {
    throw new Error('AWS_KMS_KEY_ID must be set before encrypting tokens.');
  }

  const { rows } = await db.query(
    `
      SELECT id, user_id, plaid_item_id, access_token
      FROM plaid_items
      WHERE access_token IS NOT NULL
      ORDER BY id
    `,
  );

  let encryptedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    if (isEncryptedToken(row.access_token)) {
      skippedCount += 1;
      continue;
    }

    const encryptedAccessToken = await encryptToken(row.access_token, {
      userId: row.user_id,
      plaidItemId: row.plaid_item_id,
    });

    await db.query(
      `
        UPDATE plaid_items
        SET access_token = $2, updated_at = NOW()
        WHERE id = $1
      `,
      [row.id, encryptedAccessToken],
    );
    encryptedCount += 1;
  }

  return {
    checked: rows.length,
    encrypted: encryptedCount,
    skipped: skippedCount,
  };
};

encryptExistingPlaidTokens()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => db.closePool());
