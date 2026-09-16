'use strict';

const { httpError } = require('../../lib/httpError');
const models = require('../../models');
const { getCurrentUser } = require('../authService');
const { createVectorMintClient } = require('./vectorMintClient');
const {
  findVectorMintCardMatch,
  serializeCurrentCard,
} = require('./vectorMintCardCatalogService');
const { normalizeVectorMintCards } = require('./vectorMintCardMapper');

const requireAdmin = async () => {
  const user = await getCurrentUser();

  if (user.account_type !== 'admin') {
    throw httpError(403, 'Only admin accounts can import VectorMint card data.');
  }

  return user;
};

const importVectorMintCardCatalog = async ({
  client = createVectorMintClient(),
} = {}) => {
  await requireAdmin();

  const catalog = await models.creditCardRewards.findRewardCatalog();
  const currentCards = catalog.cardTypes.map((cardType) =>
    serializeCurrentCard({
      cardType,
      earningRewards: catalog.earningRewards,
      perkAwards: catalog.perkAwards,
    }),
  );
  const vectorMintPayload = await client.fetchConfiguredCardData();
  const vectorMintCards = normalizeVectorMintCards(vectorMintPayload);
  const matchedCurrentCardIds = new Set();
  const matchCardTypeId = (vectorMintCard) => {
    const linkedCard = currentCards.find(
      (currentCard) =>
        currentCard.externalSource === 'vectormint' &&
        currentCard.externalCardId &&
        currentCard.externalCardId === vectorMintCard.sourceId,
    );

    if (linkedCard) {
      matchedCurrentCardIds.add(linkedCard.id);
      return linkedCard.id;
    }

    const availableCards = currentCards.filter(
      (currentCard) => !matchedCurrentCardIds.has(currentCard.id),
    );
    const matchedCard = availableCards.find((currentCard) =>
      findVectorMintCardMatch({
        currentCard,
        vectorMintCards: [vectorMintCard],
      }),
    );

    if (!matchedCard) {
      return null;
    }

    matchedCurrentCardIds.add(matchedCard.id);
    return matchedCard.id;
  };

  return models.creditCardRewards.mergeVectorMintCardCatalog({
    cards: vectorMintCards,
    matchCardTypeId,
  });
};

module.exports = {
  importVectorMintCardCatalog,
};
