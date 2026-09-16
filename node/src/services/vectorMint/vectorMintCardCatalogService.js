'use strict';

const { httpError } = require('../../lib/httpError');
const models = require('../../models');
const { getCurrentUser } = require('../authService');
const { createVectorMintClient } = require('./vectorMintClient');
const {
  normalizeCardName,
  normalizeVectorMintCards,
} = require('./vectorMintCardMapper');

const requireAdmin = async () => {
  const user = await getCurrentUser();

  if (user.account_type !== 'admin') {
    throw httpError(
      403,
      'Only admin accounts can preview Vector Mint card data.',
    );
  }
};

const serializeCurrentCard = ({ cardType, earningRewards, perkAwards }) => ({
  id: Number(cardType.id),
  name: cardType.name,
  nameKey: normalizeCardName(cardType.name),
  annualFee: Number(cardType.annual_fee || 0),
  status: cardType.status || 'active',
  externalSource: cardType.external_source || null,
  externalCardId: cardType.external_card_id || null,
  sourceFingerprint: cardType.source_fingerprint || null,
  earningRewards: earningRewards
    .filter((reward) => String(reward.credit_card_type_id) === String(cardType.id))
    .map((reward) => ({
      category: reward.category,
      rewardPercent: Number(reward.reward_percent),
      keywords: reward.keywords || null,
    })),
  perkAwards: perkAwards
    .filter((award) => String(award.credit_card_type_id) === String(cardType.id))
    .map((award) => ({
      name: award.name,
      dollarValue: Number(award.dollar_value || 0),
      frequencyCount: Number(award.frequency_count || 1),
      frequencyPeriod: award.frequency_period || 'per_year',
      autoComplete: Boolean(award.auto_complete),
    })),
});

const compareCard = ({ currentCard, vectorMintCard }) => ({
  card: {
    id: currentCard.id,
    name: currentCard.name,
  },
  status: vectorMintCard ? 'matched' : 'missing_external_match',
  current: {
    annualFee: currentCard.annualFee,
    earningRewardCount: currentCard.earningRewards.length,
    earningRewards: currentCard.earningRewards,
    perkAwardCount: currentCard.perkAwards.length,
    perkAwards: currentCard.perkAwards,
  },
  vectorMint: vectorMintCard
    ? {
        sourceId: vectorMintCard.sourceId,
        name: vectorMintCard.name,
        annualFee: vectorMintCard.annualFee,
        earningRewards: vectorMintCard.earningRewards,
        perkAwards: vectorMintCard.perkAwards,
        excludedBenefits: [
          ...vectorMintCard.earningRewards
            .filter((reward) => reward.status === 'excluded')
            .map((reward) => ({
              type: 'earning_reward',
              reason: reward.statusReason,
            })),
          ...vectorMintCard.perkAwards
            .filter((perk) => perk.status === 'excluded')
            .map((perk) => ({
              type: 'perk_award',
              reason: perk.statusReason,
            })),
        ],
      }
      : null,
});

const CARD_NAME_STOP_WORDS = new Set([
  'amex',
  'american',
  'bank',
  'card',
  'cash',
  'chase',
  'citi',
  'credit',
  'express',
  'fargo',
  'from',
  'of',
  'one',
  'rewards',
  'the',
  'us',
  'visa',
  'wells',
]);

const PRODUCT_VARIANT_TOKENS = new Set([
  'business',
  'delta',
  'hilton',
  'journey',
  'marriott',
  'secured',
  'skymiles',
  'united',
  'x',
]);

const getDistinctiveNameTokens = (name) =>
  normalizeCardName(name)
    .split(' ')
    .filter(
      (token) =>
        (token.length > 1 || token === 'x') &&
        !CARD_NAME_STOP_WORDS.has(token),
    );

const isSafeNameMatch = (currentCard, vectorMintCard) => {
  if (currentCard.nameKey === vectorMintCard.nameKey) {
    return true;
  }

  const currentTokens = getDistinctiveNameTokens(currentCard.name);
  const vectorMintTokens = new Set(getDistinctiveNameTokens(vectorMintCard.name));

  if (currentTokens.length === 0) {
    return false;
  }

  const currentTokenSet = new Set(currentTokens);
  const hasUnexpectedVariant = Array.from(PRODUCT_VARIANT_TOKENS).some(
    (token) => vectorMintTokens.has(token) && !currentTokenSet.has(token),
  );

  return (
    !hasUnexpectedVariant &&
    currentTokens.every((token) => vectorMintTokens.has(token))
  );
};

const findVectorMintCardMatch = ({ currentCard, vectorMintCards }) =>
  vectorMintCards.find((card) => isSafeNameMatch(currentCard, card)) || null;

const previewVectorMintCardCatalog = async ({
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
  const comparisons = currentCards.map((currentCard) =>
    compareCard({
      currentCard,
      vectorMintCard: findVectorMintCardMatch({
        currentCard,
        vectorMintCards,
      }),
    }),
  );
  const matchedKeys = new Set(
    comparisons
      .filter((comparison) => comparison.vectorMint)
      .map((comparison) => normalizeCardName(comparison.vectorMint.name)),
  );

  return {
    matched_card_count: comparisons.filter(
      (comparison) => comparison.status === 'matched',
    ).length,
    current_card_count: currentCards.length,
    external_card_count: vectorMintCards.length,
    comparisons,
    external_only_cards: vectorMintCards
      .filter((card) => !matchedKeys.has(card.nameKey))
      .map((card) => ({
        sourceId: card.sourceId,
        name: card.name,
        annualFee: card.annualFee,
        earningRewardCount: card.earningRewards.length,
        perkAwardCount: card.perkAwards.length,
        excludedBenefitCount: [
          ...card.earningRewards,
          ...card.perkAwards,
        ].filter((benefit) => benefit.status === 'excluded').length,
      })),
  };
};

module.exports = {
  findVectorMintCardMatch,
  previewVectorMintCardCatalog,
  serializeCurrentCard,
};
