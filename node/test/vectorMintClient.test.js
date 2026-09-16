'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createVectorMintClient,
  getVectorMintConfig,
} = require('../src/services/vectorMint/vectorMintClient');

test('getVectorMintConfig reads optional environment configuration', () => {
  const config = getVectorMintConfig({
    VECTOR_MINT_API_KEY: 'test-key',
    VECTOR_MINT_AUTH_MODE: 'x-api-key',
    VECTOR_MINT_BASE_URL: 'https://example.test',
    VECTOR_MINT_CARD_DETAIL_PATH_TEMPLATE: '/card-detail/{id}',
    VECTOR_MINT_CARDS_PATH: '/cards',
    VECTOR_MINT_LISTING_ID: 'listing-1',
    VECTOR_MINT_TIMEOUT_MS: '2500',
  });

  assert.deepEqual(config, {
    apiKey: 'test-key',
    authMode: 'x-api-key',
    baseUrl: 'https://example.test',
    cardDetailPathTemplate: '/card-detail/{id}',
    cardsPath: '/cards',
    listingId: 'listing-1',
    timeoutMs: 2500,
  });
});

test('fetchConfiguredCardData hydrates cards with the v1 card detail endpoint', async () => {
  const requests = [];
  const client = createVectorMintClient({
    config: {
      apiKey: 'test-key',
      authMode: 'bearer',
      baseUrl: 'https://api.example.test/v1',
      cardDetailPathTemplate: '/cards/{id}',
      cardsPath: '/cards',
      listingId: '',
      timeoutMs: 1000,
    },
    fetchImpl: async (url, options) => {
      requests.push({
        authorization: options.headers.Authorization,
        url: url.toString(),
      });

      if (url.pathname === '/v1/cards') {
        return {
          ok: true,
          json: async () => ({ cards: [{ id: 'card-1' }, { id: 'card-2' }] }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          card: {
            id: url.pathname.split('/').pop(),
            name: 'Test Card',
          },
        }),
      };
    },
  });

  const payload = await client.fetchConfiguredCardData();

  assert.deepEqual(payload.cards, [
    { id: 'card-1', name: 'Test Card' },
    { id: 'card-2', name: 'Test Card' },
  ]);
  assert.deepEqual(
    requests.map((request) => request.url),
    [
      'https://api.example.test/v1/cards?limit=100&page=1',
      'https://api.example.test/v1/cards/card-1',
      'https://api.example.test/v1/cards/card-2',
    ],
  );
  assert.equal(
    requests.every((request) => request.authorization === 'Bearer test-key'),
    true,
  );
});

test('fetchConfiguredCardData returns list payload when card ids are absent', async () => {
  const client = createVectorMintClient({
    config: {
      apiKey: 'test-key',
      authMode: 'x-api-key',
      baseUrl: 'https://api.example.test/v1',
      cardDetailPathTemplate: '/cards/{id}',
      cardsPath: '/cards',
      listingId: '',
      timeoutMs: 1000,
    },
    fetchImpl: async (url, options) => {
      assert.equal(
        url.toString(),
        'https://api.example.test/v1/cards?limit=100&page=1',
      );
      assert.equal(options.headers['x-api-key'], 'test-key');

      return {
        ok: true,
        json: async () => ({ cards: [{ name: 'Card without id' }] }),
      };
    },
  });

  assert.deepEqual(await client.fetchConfiguredCardData(), {
    cards: [{ name: 'Card without id' }],
  });
});

test('requestJson supports query auth mode for marketplace-compatible endpoints', async () => {
  const requestedUrls = [];
  const client = createVectorMintClient({
    config: {
      apiKey: 'test-key',
      authMode: 'query',
      baseUrl: 'https://api.example.test/v1',
      cardDetailPathTemplate: '/cards/{id}',
      cardsPath: '',
      listingId: '',
      timeoutMs: 1000,
    },
    fetchImpl: async (url) => {
      requestedUrls.push(url.toString());

      return {
        ok: true,
        json: async () => ({ ok: true }),
      };
    },
  });

  await client.requestJson('/private', { authenticated: true });

  assert.equal(
    requestedUrls[0],
    'https://api.example.test/v1/private?api_key=test-key',
  );
});

test('fetchConfiguredCardData fails fast when authenticated endpoint has no key', async () => {
  const client = createVectorMintClient({
    config: {
      apiKey: '',
      authMode: 'bearer',
      baseUrl: 'https://api.example.test',
      cardDetailPathTemplate: '/cards/{id}',
      cardsPath: '/cards/catalog',
      listingId: '',
      timeoutMs: 1000,
    },
    fetchImpl: async () => {
      throw new Error('fetch should not be called');
    },
  });

  await assert.rejects(() => client.fetchConfiguredCardData(), {
    status: 503,
    message: 'Vector Mint API key is not configured.',
  });
});

test('fetchConfiguredCardData searches public listings when no dataset is configured', async () => {
  const requestedUrls = [];
  const client = createVectorMintClient({
    config: {
      apiKey: '',
      authMode: 'bearer',
      baseUrl: 'https://verticalmarketplace.ai',
      cardDetailPathTemplate: '/cards/{id}',
      cardsPath: '',
      listingId: '',
      timeoutMs: 1000,
    },
    fetchImpl: async (url) => {
      requestedUrls.push(url.toString());

      return {
        ok: true,
        json: async () => ({ listings: [] }),
      };
    },
  });

  const payload = await client.fetchConfiguredCardData();

  assert.deepEqual(payload, { cards: [], listings: { listings: [] } });
  assert.equal(
    requestedUrls[0],
    'https://verticalmarketplace.ai/api/marketplace/listings?q=credit+card+rewards&samples=include&limit=20',
  );
});
