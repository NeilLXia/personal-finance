'use strict';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');

const dbPath = require.resolve('../src/db/connection');
const accountModelPath = require.resolve('../src/models/accountModel');
const plaidItemModelPath = require.resolve('../src/models/plaidItemModel');
const tokenEncryptionServicePath = require.resolve(
  '../src/services/security/tokenEncryptionService',
);

const originalDbCache = require.cache[dbPath];
const originalTokenEncryptionServiceCache =
  require.cache[tokenEncryptionServicePath];

const restoreModuleState = () => {
  delete require.cache[accountModelPath];
  delete require.cache[plaidItemModelPath];

  if (originalDbCache) {
    require.cache[dbPath] = originalDbCache;
  } else {
    delete require.cache[dbPath];
  }

  if (originalTokenEncryptionServiceCache) {
    require.cache[tokenEncryptionServicePath] = originalTokenEncryptionServiceCache;
  } else {
    delete require.cache[tokenEncryptionServicePath];
  }
};

const stubDb = ({ rows = [] } = {}) => {
  const calls = [];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      query: async (text, params) => {
        calls.push({ text, params });
        return { rows };
      },
    },
  };

  return calls;
};

const stubTokenEncryption = () => {
  require.cache[tokenEncryptionServicePath] = {
    id: tokenEncryptionServicePath,
    filename: tokenEncryptionServicePath,
    loaded: true,
    exports: {
      decryptToken: async (token) => token,
      encryptToken: async (token) => token,
    },
  };
};

const getSetClause = (sql) => sql.split(/\bWHERE\b/)[0].split(/\bSET\b/)[1];

afterEach(restoreModuleState);

test('plaidItems.upsert preserves owner on conflict and returns same-owner row', async () => {
  restoreModuleState();
  stubTokenEncryption();
  const calls = stubDb({
    rows: [
      {
        id: 10,
        user_id: 1,
        plaid_item_id: 'item-1',
        access_token: 'access-token',
      },
    ],
  });
  const plaidItems = require(plaidItemModelPath);

  const result = await plaidItems.upsert({
    userId: 1,
    plaidItemId: 'item-1',
    accessToken: 'access-token',
    plaidEnvironment: 'sandbox',
    institutionId: 'ins_1',
    institutionName: 'Test Bank',
  });

  assert.equal(result.user_id, 1);
  assert.match(calls[0].text, /WHERE plaid_items\.user_id = EXCLUDED\.user_id/);
  assert.doesNotMatch(getSetClause(calls[0].text), /user_id\s*=/);
});

test('plaidItems.upsert throws 409 when conflict belongs to another user', async () => {
  restoreModuleState();
  stubTokenEncryption();
  stubDb({ rows: [] });
  const plaidItems = require(plaidItemModelPath);

  await assert.rejects(
    plaidItems.upsert({
      userId: 1,
      plaidItemId: 'item-owned-elsewhere',
      accessToken: 'access-token',
      plaidEnvironment: 'sandbox',
      institutionId: 'ins_1',
      institutionName: 'Test Bank',
    }),
    {
      status: 409,
      message: 'Plaid Item is already linked to another user.',
    },
  );
});

test('accounts.upsert preserves owner on conflict and returns same-owner row', async () => {
  restoreModuleState();
  const calls = stubDb({
    rows: [
      {
        id: 20,
        user_id: 1,
        plaid_account_id: 'account-1',
      },
    ],
  });
  const accounts = require(accountModelPath);

  const result = await accounts.upsert({
    userId: 1,
    plaidAccountId: 'account-1',
    plaidItemId: 'item-1',
    name: 'Checking',
    mask: '0000',
    officialName: null,
    subtype: 'checking',
    type: 'depository',
    balanceAvailable: 100,
    balanceCurrent: 100,
    balanceLimit: null,
    isoCurrencyCode: 'USD',
    unofficialCurrencyCode: null,
  });

  assert.equal(result.user_id, 1);
  assert.match(calls[0].text, /WHERE accounts\.user_id = EXCLUDED\.user_id/);
  assert.doesNotMatch(getSetClause(calls[0].text), /user_id\s*=/);
});

test('accounts.upsert throws 409 when conflict belongs to another user', async () => {
  restoreModuleState();
  stubDb({ rows: [] });
  const accounts = require(accountModelPath);

  await assert.rejects(
    accounts.upsert({
      userId: 1,
      plaidAccountId: 'account-owned-elsewhere',
      plaidItemId: 'item-1',
      name: 'Checking',
      mask: '0000',
      officialName: null,
      subtype: 'checking',
      type: 'depository',
      balanceAvailable: 100,
      balanceCurrent: 100,
      balanceLimit: null,
      isoCurrencyCode: 'USD',
      unofficialCurrencyCode: null,
    }),
    {
      status: 409,
      message: 'Plaid account is already linked to another user.',
    },
  );
});
