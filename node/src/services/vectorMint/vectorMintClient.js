'use strict';

const { httpError } = require('../../lib/httpError');
const {
  createTimeoutError,
  createTimeoutSignal,
  isTimeoutError,
  parsePositiveNumber,
} = require('../../lib/httpTimeout');
const {
  extractExternalCards,
  normalizeCardName,
} = require('./vectorMintCardMapper');

const DEFAULT_BASE_URL = 'https://api.vectormint.app/v1';
const DEFAULT_AUTH_MODE = 'bearer';
const DEFAULT_CARDS_PATH = '/cards';
const DEFAULT_CARD_DETAIL_PATH_TEMPLATE = '/cards/{id}';
const DEFAULT_TIMEOUT_MS = 10000;

const getVectorMintConfig = (env = process.env) => ({
  apiKey: env.VECTOR_MINT_API_KEY || '',
  authMode: env.VECTOR_MINT_AUTH_MODE || DEFAULT_AUTH_MODE,
  baseUrl: env.VECTOR_MINT_BASE_URL || DEFAULT_BASE_URL,
  cardDetailPathTemplate:
    env.VECTOR_MINT_CARD_DETAIL_PATH_TEMPLATE || DEFAULT_CARD_DETAIL_PATH_TEMPLATE,
  cardsPath: env.VECTOR_MINT_CARDS_PATH || DEFAULT_CARDS_PATH,
  listingId: env.VECTOR_MINT_LISTING_ID || '',
  timeoutMs: parsePositiveNumber(
    env.VECTOR_MINT_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  ),
});

const applyAuthentication = ({ url, headers, apiKey, authMode }) => {
  if (!apiKey) {
    return;
  }

  if (authMode === 'query') {
    url.searchParams.set('api_key', apiKey);
    return;
  }

  if (authMode === 'x-api-key') {
    headers['x-api-key'] = apiKey;
    return;
  }

  headers.Authorization = `Bearer ${apiKey}`;
};

const resolveCardDetailPath = (template, cardId) =>
  template.includes('{id}')
    ? template.replace('{id}', encodeURIComponent(cardId))
    : `${template.replace(/\/$/, '')}/${encodeURIComponent(cardId)}`;

const buildUrl = (path, baseUrl) => {
  if (/^https?:\/\//i.test(path)) {
    return new URL(path);
  }

  return new URL(
    path.replace(/^\/+/, ''),
    `${baseUrl.href.replace(/\/?$/, '/')}`,
  );
};

const getExternalCardId = (card) =>
  card?.id || card?.card_id || card?.cardId || card?.slug || null;

const normalizeCardDetailPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  return payload.card || payload.data?.card || payload.data || payload;
};

const payloadHasHydratedCards = (payload) =>
  extractExternalCards(payload).some(
    (card) =>
      Array.isArray(card.reward_rules) ||
      Array.isArray(card.rewardRules) ||
      Array.isArray(card.credits) ||
      Array.isArray(card.benefits) ||
      Array.isArray(card.perks),
  );

const mergeListPayloads = (payloads) => {
  const [firstPayload] = payloads;
  const cards = payloads.flatMap(extractExternalCards);

  if (!firstPayload || typeof firstPayload !== 'object') {
    return { cards };
  }

  const mergedPayload = {
    ...firstPayload,
  };

  if (Array.isArray(firstPayload.data)) {
    mergedPayload.data = cards;
  }

  if (firstPayload.cards) {
    mergedPayload.cards = cards;
  }

  return mergedPayload;
};

const createVectorMintClient = ({
  config = getVectorMintConfig(),
  fetchImpl = fetch,
} = {}) => {
  const baseUrl = new URL(config.baseUrl);

  const requestJson = async (path, { authenticated = false, query = {} } = {}) => {
    const url = buildUrl(path, baseUrl);

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });

    if (authenticated) {
      if (!config.apiKey) {
        throw httpError(503, 'Vector Mint API key is not configured.');
      }
    }

    try {
      const headers = { Accept: 'application/json' };

      if (authenticated) {
        applyAuthentication({
          url,
          headers,
          apiKey: config.apiKey,
          authMode: config.authMode,
        });
      }

      const response = await fetchImpl(url, {
        headers,
        signal: createTimeoutSignal(config.timeoutMs),
      });

      if (!response.ok) {
        throw httpError(
          response.status,
          `Vector Mint request failed with ${response.status}.`,
        );
      }

      return response.json();
    } catch (error) {
      if (isTimeoutError(error)) {
        throw createTimeoutError('Vector Mint', config.timeoutMs);
      }

      throw error;
    }
  };

  const fetchCardDetail = async (cardId) =>
    normalizeCardDetailPayload(
      await requestJson(
        resolveCardDetailPath(config.cardDetailPathTemplate, cardId),
        { authenticated: true },
      ),
    );

  const fetchCards = async () => {
    const firstPayload = await requestJson(config.cardsPath, {
      authenticated: true,
      query: {
        limit: 100,
        page: 1,
      },
    });

    const total = Number(firstPayload?.meta?.total || 0);
    const limit = Number(firstPayload?.meta?.limit || 100);
    const pageCount = total > limit ? Math.ceil(total / limit) : 1;
    const additionalPayloads = [];

    for (let page = 2; page <= pageCount; page += 1) {
      additionalPayloads.push(
        await requestJson(config.cardsPath, {
          authenticated: true,
          query: {
            limit,
            page,
          },
        }),
      );
    }

    const listPayload = mergeListPayloads([firstPayload, ...additionalPayloads]);

    if (payloadHasHydratedCards(listPayload)) {
      return listPayload;
    }

    const listedCards = extractExternalCards(listPayload);
    const cardIds = listedCards.map(getExternalCardId).filter(Boolean);

    if (cardIds.length === 0) {
      return listPayload;
    }

    return {
      cards: await Promise.all(cardIds.map(fetchCardDetail)),
      list: listPayload,
    };
  };

  const searchCards = ({ query, limit = 10 } = {}) =>
    requestJson('/cards/search', {
      authenticated: true,
      query: {
        q: query,
        limit,
      },
    });

  const findBestCardSearchMatch = (cards, cardName) => {
    const cardNameKey = normalizeCardName(cardName);

    return (
      cards.find((card) => normalizeCardName(card.name) === cardNameKey) ||
      cards.find((card) => card.match_type === 'exact') ||
      null
    );
  };

  const fetchCardDetailsForNames = async (cardNames) => {
    const cards = [];

    for (const cardName of cardNames) {
      const searchPayload = await searchCards({ query: cardName, limit: 5 });
      const match = findBestCardSearchMatch(
        extractExternalCards(searchPayload),
        cardName,
      );
      const cardId = getExternalCardId(match);

      if (cardId) {
        cards.push(await fetchCardDetail(cardId));
      }
    }

    return { cards };
  };

  const searchListings = ({ query = 'credit card rewards', limit = 20 } = {}) =>
    requestJson('/api/marketplace/listings', {
      query: {
        q: query,
        samples: 'include',
        limit,
      },
    });

  const getListingPreview = (listingId = config.listingId) => {
    if (!listingId) {
      throw httpError(503, 'Vector Mint listing id is not configured.');
    }

    return requestJson(`/api/marketplace/listings/${encodeURIComponent(listingId)}`);
  };

  const fetchConfiguredCardData = async () => {
    if (config.cardsPath) {
      return fetchCards();
    }

    if (config.listingId) {
      const listing = await getListingPreview(config.listingId);

      return listing.preview || listing.data || listing;
    }

    return { cards: [], listings: await searchListings() };
  };

  return {
    fetchCardDetailsForNames,
    fetchCardDetail,
    fetchCards,
    fetchConfiguredCardData,
    getListingPreview,
    requestJson,
    searchListings,
    searchCards,
  };
};

module.exports = {
  createVectorMintClient,
  getVectorMintConfig,
};
