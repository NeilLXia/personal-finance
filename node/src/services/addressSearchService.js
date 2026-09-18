'use strict';

const {
  createTimeoutError,
  createTimeoutSignal,
  isTimeoutError,
  parsePositiveNumber,
} = require('../lib/httpTimeout');
const { isPlaceholder } = require('../config/validateConfig');

const mapboxAccessToken = process.env.MAPBOX_ACCESS_TOKEN;
const mapboxSearchBaseUrl =
  process.env.MAPBOX_SEARCH_BASE_URL ||
  'https://api.mapbox.com/search/searchbox/v1';

const normalizeMapboxSuggestion = (suggestion) => {
  const context = suggestion.context || {};
  const region = context.region || {};
  const postcode = context.postcode || {};
  const country = context.country || {};
  const label =
    suggestion.full_address ||
    [suggestion.address || suggestion.name, suggestion.place_formatted]
      .filter(Boolean)
      .join(', ');

  return {
    id: suggestion.mapbox_id,
    label,
    address: suggestion.address || suggestion.name || label,
    city:
      context.place?.name ||
      context.locality?.name ||
      context.district?.name ||
      null,
    region: region.region_code || region.name || null,
    postal_code: postcode.name || null,
    country: country.country_code || country.name || null,
    source: 'mapbox',
  };
};

const normalizeMapboxSuggestions = (suggestions = []) =>
  suggestions
    .filter((suggestion) => suggestion && suggestion.mapbox_id)
    .map(normalizeMapboxSuggestion);

const ensureMapboxAccessToken = () => {
  if (isPlaceholder(mapboxAccessToken)) {
    const error = new Error('Missing MAPBOX_ACCESS_TOKEN in .env');
    error.status = 400;
    throw error;
  }
};

const searchAddressSuggestions = async ({
  query,
  sessionToken,
  fetchImpl = fetch,
}) => {
  ensureMapboxAccessToken();

  const url = new URL(`${mapboxSearchBaseUrl}/suggest`);
  url.searchParams.set('q', query);
  url.searchParams.set('session_token', sessionToken);
  url.searchParams.set('access_token', mapboxAccessToken);
  url.searchParams.set('country', 'US');
  url.searchParams.set('types', 'address');
  url.searchParams.set('language', 'en');
  url.searchParams.set('limit', '6');

  const timeoutMs = parsePositiveNumber(process.env.MAPBOX_TIMEOUT_MS, 5000);
  let response;

  try {
    response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: createTimeoutSignal(timeoutMs),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw createTimeoutError('Mapbox address search', timeoutMs);
    }

    throw error;
  }

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.message || data.error || 'Mapbox address search request failed',
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return {
    suggestions: normalizeMapboxSuggestions(data.suggestions),
    attribution: data.attribution,
  };
};

module.exports = {
  normalizeMapboxSuggestions,
  searchAddressSuggestions,
};
