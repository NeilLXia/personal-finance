'use strict';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');

const modulePath = require.resolve('../src/services/addressSearchService');

const loadService = (env = {}) => {
  delete require.cache[modulePath];
  const previousEnv = { ...process.env };
  process.env = { ...process.env, ...env };
  const service = require('../src/services/addressSearchService');

  return {
    service,
    restore: () => {
      process.env = previousEnv;
      delete require.cache[modulePath];
    },
  };
};

afterEach(() => {
  delete require.cache[modulePath];
});

test('normalizes Mapbox address suggestions into the app contract', () => {
  const { service, restore } = loadService();

  try {
    assert.deepEqual(
      service.normalizeMapboxSuggestions([
        {
          mapbox_id: 'address.123',
          name: '123 Main Street',
          address: '123 Main Street',
          full_address: '123 Main Street, Austin, Texas 78701, United States',
          place_formatted: 'Austin, Texas 78701, United States',
          context: {
            place: { name: 'Austin' },
            region: { name: 'Texas', region_code: 'TX' },
            postcode: { name: '78701' },
            country: { name: 'United States', country_code: 'US' },
          },
        },
      ]),
      [
        {
          id: 'address.123',
          label: '123 Main Street, Austin, Texas 78701, United States',
          address: '123 Main Street',
          city: 'Austin',
          region: 'TX',
          postal_code: '78701',
          country: 'US',
          source: 'mapbox',
        },
      ],
    );
  } finally {
    restore();
  }
});

test('searchAddressSuggestions sends a constrained Mapbox suggest request', async () => {
  const { service, restore } = loadService({
    MAPBOX_ACCESS_TOKEN: 'pk.test-token',
    MAPBOX_SEARCH_BASE_URL: 'https://example.test/search',
  });
  const requestedUrls = [];

  try {
    const result = await service.searchAddressSuggestions({
      query: '123 main',
      sessionToken: 'session_123',
      fetchImpl: async (url) => {
        requestedUrls.push(url);

        return {
          ok: true,
          json: async () => ({
            attribution: 'Mapbox',
            suggestions: [
              {
                mapbox_id: 'address.123',
                address: '123 Main Street',
                place_formatted: 'Austin, Texas 78701, United States',
              },
            ],
          }),
        };
      },
    });

    const url = requestedUrls[0];
    assert.equal(url.origin, 'https://example.test');
    assert.equal(url.pathname, '/search/suggest');
    assert.equal(url.searchParams.get('q'), '123 main');
    assert.equal(url.searchParams.get('session_token'), 'session_123');
    assert.equal(url.searchParams.get('access_token'), 'pk.test-token');
    assert.equal(url.searchParams.get('country'), 'US');
    assert.equal(url.searchParams.get('types'), 'address');
    assert.equal(result.suggestions.length, 1);
  } finally {
    restore();
  }
});

test('searchAddressSuggestions requires a Mapbox token', async () => {
  const { service, restore } = loadService({
    MAPBOX_ACCESS_TOKEN: '',
  });

  try {
    await assert.rejects(
      () =>
        service.searchAddressSuggestions({
          query: '123 main',
          sessionToken: 'session_123',
          fetchImpl: async () => {
            throw new Error('fetch should not be called');
          },
        }),
      /Missing MAPBOX_ACCESS_TOKEN/,
    );
  } finally {
    restore();
  }
});
