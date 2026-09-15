'use strict';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');

const seederPath = require.resolve('../src/services/demo/seeder');
const cleanupPath = require.resolve('../src/services/demo/cleanup');
const dbPath = require.resolve('../src/db/connection');
const modelsPath = require.resolve('../src/models');
const loggerPath = require.resolve('../src/lib/logger');

const cachedModules = new Map(
  [seederPath, cleanupPath, dbPath, modelsPath, loggerPath].map((id) => [
    id,
    require.cache[id],
  ]),
);

const restore = () => {
  cachedModules.forEach((entry, id) => {
    if (entry) {
      require.cache[id] = entry;
    } else {
      delete require.cache[id];
    }
  });
};

afterEach(restore);

test('createDemoSessionData creates an isolated demo user with batched seed writes', async () => {
  restore();
  delete require.cache[seederPath];
  delete require.cache[cleanupPath];

  const createdUser = {
    id: 42,
    email: 'demo+session@example.com',
    name: 'Demo User',
    is_demo: true,
    account_type: 'user',
    demo_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  const queries = [];
  let nextAccountId = 100;

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      query: async (sql, params) => {
        queries.push(sql);

        if (sql.includes('INSERT INTO users')) {
          assert.match(params[0], /^demo\+.+@example\.com$/);
          return {
            rows: [
              {
                ...createdUser,
                email: params[0],
                demo_expires_at: params[1],
              },
            ],
          };
        }

        if (sql.includes('INSERT INTO transactions')) {
          const plaidTransactionIds = [];
          for (let index = 1; index < params.length; index += 9) {
            plaidTransactionIds.push(params[index]);
          }

          return {
            rows: plaidTransactionIds.map((plaidTransactionId, index) => ({
              id: index + 1000,
              plaid_transaction_id: plaidTransactionId,
            })),
          };
        }

        if (sql.includes('INSERT INTO properties')) {
          return { rows: [{ id: 500 }] };
        }

        return { rows: [] };
      },
    },
  };
  require.cache[modelsPath] = {
    id: modelsPath,
    filename: modelsPath,
    loaded: true,
    exports: {
      accounts: {
        upsert: async (account) => ({
          ...account,
          id: nextAccountId += 1,
        }),
      },
      plaidItems: {
        upsert: async (item) => item,
      },
      users: {
        deleteExpiredDemoUsers: async () => 0,
      },
    },
  };
  require.cache[loggerPath] = {
    id: loggerPath,
    filename: loggerPath,
    loaded: true,
    exports: {
      error: () => {},
      info: () => {},
      warn: () => {},
    },
  };

  const { createDemoSessionData } = require(seederPath);
  const user = await createDemoSessionData();

  assert.equal(user.id, createdUser.id);
  assert.match(user.email, /^demo\+.+@example\.com$/);
  assert.equal(
    queries.filter((sql) => sql.includes('INSERT INTO account_balance_history'))
      .length,
    1,
  );
  assert.equal(
    queries.filter((sql) => sql.includes('INSERT INTO transactions')).length,
    1,
  );
  assert.equal(
    queries.filter((sql) => sql.includes('INSERT INTO payslips')).length,
    1,
  );
  assert.equal(
    queries.filter((sql) => sql.includes('INSERT INTO property_value_history'))
      .length,
    1,
  );
});
