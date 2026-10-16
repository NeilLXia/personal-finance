'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateConfig } = require('../src/config/validateConfig');

const webhookWarnings = (env) =>
  validateConfig({ env: { NODE_ENV: 'production', ...env } }).warnings.filter(
    (message) => message.startsWith('PLAID_WEBHOOK_URL'),
  );

test('warns when PLAID_WEBHOOK_URL is unset in production', () => {
  assert.equal(webhookWarnings({}).length, 1);
  assert.match(webhookWarnings({})[0], /unset/);
});

test('warns when PLAID_WEBHOOK_URL points at an ngrok tunnel or localhost', () => {
  for (const url of [
    'https://goatskin-motor-lettuce.ngrok-free.dev/api/webhook',
    'http://localhost:8001/api/webhook',
  ]) {
    const warnings = webhookWarnings({ PLAID_WEBHOOK_URL: url });
    assert.equal(warnings.length, 1, url);
    assert.match(warnings[0], /ngrok/);
  }
});

test('accepts a stable public PLAID_WEBHOOK_URL', () => {
  assert.deepEqual(
    webhookWarnings({
      PLAID_WEBHOOK_URL: 'https://personal-finance.neilxia.com/api/webhook',
    }),
    [],
  );
});

test('skips webhook checks outside production', () => {
  assert.deepEqual(
    validateConfig({ env: { NODE_ENV: 'development' } }).warnings,
    [],
  );
});
