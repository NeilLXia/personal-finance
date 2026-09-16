'use strict';

const crypto = require('crypto');
const {
  canonicalizeExpenseCategory,
  normalizeCategoryRuleText,
} = require('../transactions/transactionCategory');

const TRACKABLE_REWARD_CATEGORIES = new Set([
  'bills',
  'dining',
  'entertainment',
  'fitness',
  'gifts',
  'groceries',
  'health',
  'housing',
  'insurance',
  'personal care',
  'shopping',
  'travel',
]);

const CATEGORY_ALIASES = new Map([
  ['drug store', 'Health'],
  ['drug stores', 'Health'],
  ['dining', 'Dining'],
  ['restaurant', 'Dining'],
  ['restaurants', 'Dining'],
  ['grocery', 'Groceries'],
  ['grocery stores', 'Groceries'],
  ['groceries', 'Groceries'],
  ['hotel', 'Travel'],
  ['hotels', 'Travel'],
  ['travel', 'Travel'],
]);

const VAGUE_REWARD_TERMS = [
  'all eligible',
  'online groceries',
  'rotating',
  'select',
  'streaming',
  'transit',
];

const UNTRACKABLE_PERK_TERMS = [
  'airport lounge',
  'baggage',
  'car rental',
  'concierge',
  'earlybird',
  'elite status',
  'extended warranty',
  'global entry',
  'insurance',
  'partner',
  'priority pass',
  'purchase protection',
  'tsa precheck',
];

const MERCHANT_KEYWORD_ALIASES = new Map([
  ['amazon', 'Amazon'],
  ['amazon.com', 'Amazon'],
  ['amex travel', 'Amex Travel'],
  ['chase travel', 'Chase Travel'],
  ['hyatt', 'Hyatt'],
  ['ihg', 'IHG'],
  ['southwest', 'Southwest'],
  ['uber', 'Uber'],
  ['whole foods', 'Whole Foods'],
]);

const CATEGORY_ID_ALIASES = new Map([
  ['dining', 'Dining'],
  ['entertainment', 'Entertainment'],
  ['fitness', 'Fitness'],
  ['general-purchases', 'Base rate'],
  ['groceries', 'Groceries'],
  ['grocery', 'Groceries'],
  ['hotel', 'Travel'],
  ['hotels', 'Travel'],
  ['pharmacy', 'Health'],
  ['restaurants', 'Dining'],
  ['supermarkets', 'Groceries'],
  ['travel', 'Travel'],
]);

const getString = (...values) => {
  const value = values.find(
    (candidate) => typeof candidate === 'string' && candidate.trim(),
  );

  return value ? value.trim() : '';
};

const getNumber = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    const numericValue =
      typeof value === 'string'
        ? Number(value.replace(/[$,%\s,]/g, ''))
        : Number(value);

    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return null;
};

const getArray = (...values) =>
  values.find((value) => Array.isArray(value)) || [];

const normalizeTextKey = (value) => normalizeCategoryRuleText(value || '');

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const createFingerprint = (value) =>
  crypto.createHash('sha256').update(stableStringify(value)).digest('hex');

const includesVagueTerm = (value) => {
  const normalizedValue = normalizeTextKey(value);

  return VAGUE_REWARD_TERMS.some((term) => normalizedValue.includes(term));
};

const normalizeCardName = (value) =>
  normalizeTextKey(value)
    .replace(/[®℠™]/g, '')
    .replace(/\bamerican express\b/g, 'amex')
    .replace(/\b(credit card|card|visa|mastercard|the|from)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getExternalId = (value, fallbackPrefix, index) =>
  getString(value.id, value.reward_id, value.rewardId, value.credit_id, value.creditId) ||
  `${fallbackPrefix}-${index}`;

const getSourceDescription = (value) =>
  getString(
    value.human_description,
    value.humanDescription,
    value.description,
    value.name,
    value.category,
  );

const getTravelSpecificName = ({ keyword, sourceDescription }) => {
  const text = normalizeTextKey(sourceDescription);

  if (!keyword || (!text.includes('travel') && !text.includes('portal'))) {
    return null;
  }

  if (text.includes('hotel')) {
    return `${keyword} Hotels`;
  }

  if (text.includes('flight') || text.includes('airline')) {
    return `${keyword} Flights`;
  }

  if (text.includes('rental') || text.includes('cruise')) {
    return `${keyword} Car Rentals/Cruises`;
  }

  return null;
};

const isGasStationReward = (reward) => {
  const searchableText = normalizeTextKey(
    [
      reward.category_id,
      reward.categoryId,
      reward.category,
      reward.reward_category,
      reward.rewardCategory,
      reward.normalized_category,
      reward.normalizedCategory,
      reward.merchant_category,
      reward.merchantCategory,
      reward.spend_category,
      reward.spendCategory,
      reward.name,
      reward.description,
      reward.human_description,
      reward.humanDescription,
    ]
      .filter(Boolean)
      .join(' '),
  );

  return (
    searchableText.includes('gas station') ||
    searchableText.includes('gas-station') ||
    searchableText.includes('gas stations') ||
    searchableText.includes('gas-stations')
  );
};

const isPharmacyReward = (reward) => {
  const searchableText = normalizeTextKey(
    [
      reward.category_id,
      reward.categoryId,
      reward.category,
      reward.reward_category,
      reward.rewardCategory,
      reward.normalized_category,
      reward.normalizedCategory,
      reward.merchant_category,
      reward.merchantCategory,
      reward.spend_category,
      reward.spendCategory,
      reward.name,
      reward.description,
      reward.human_description,
      reward.humanDescription,
    ]
      .filter(Boolean)
      .join(' '),
  );

  return (
    searchableText.includes('pharmacy') ||
    searchableText.includes('pharmacies') ||
    searchableText.includes('drug store') ||
    searchableText.includes('drug stores') ||
    searchableText.includes('drugstore') ||
    searchableText.includes('drugstores')
  );
};

const normalizeRewardCategory = (reward) => {
  const category = getString(
    reward.category,
    CATEGORY_ID_ALIASES.get(normalizeTextKey(reward.category_id)),
    CATEGORY_ID_ALIASES.get(normalizeTextKey(reward.categoryId)),
    reward.reward_category,
    reward.rewardCategory,
    reward.normalized_category,
    reward.normalizedCategory,
    reward.merchant_category,
    reward.merchantCategory,
    reward.spend_category,
    reward.spendCategory,
    reward.name,
    reward.description,
  );
  const normalizedCategory = normalizeTextKey(category);
  const alias = CATEGORY_ALIASES.get(normalizedCategory);

  if (alias) {
    return alias;
  }

  const canonicalCategory = canonicalizeExpenseCategory(category);

  if (category === 'Base rate') {
    return category;
  }

  return TRACKABLE_REWARD_CATEGORIES.has(normalizeTextKey(canonicalCategory))
    ? canonicalCategory
    : null;
};

const normalizeMerchantKeywords = (reward) => {
  const candidates = [
    ...getArray(reward.merchants, reward.vendors, reward.partners),
    ...getString(reward.merchant, reward.vendor, reward.partner)
      .split(',')
      .map((value) => value.trim()),
    ...getString(reward.keywords).split(',').map((value) => value.trim()),
  ].filter(Boolean);
  const searchableText = normalizeTextKey(
    getString(
      reward.human_description,
      reward.humanDescription,
      reward.description,
      reward.name,
    ),
  );

  MERCHANT_KEYWORD_ALIASES.forEach((keyword, alias) => {
    if (searchableText.includes(alias)) {
      candidates.push(keyword);
    }
  });

  const keywords = candidates
    .map((candidate) => {
      const normalizedCandidate = normalizeTextKey(candidate);

      return MERCHANT_KEYWORD_ALIASES.get(normalizedCandidate) || candidate;
    })
    .filter((keyword) =>
      MERCHANT_KEYWORD_ALIASES.has(normalizeTextKey(keyword)),
    );

  return Array.from(new Set(keywords));
};

const normalizeFrequency = (perk) => {
  const frequencyText = normalizeTextKey(
    getString(perk.frequency, perk.period, perk.reset_period, perk.resetPeriod),
  );
  const count = getNumber(
    perk.frequency_count,
    perk.frequencyCount,
    perk.uses_per_period,
    perk.usesPerPeriod,
    perk.count,
  ) || 1;

  if (frequencyText.includes('month')) {
    return { frequencyCount: Math.min(count, 2), frequencyPeriod: 'per_month' };
  }

  if (frequencyText.includes('quarter')) {
    return {
      frequencyCount: Math.min(count, 6),
      frequencyPeriod: 'per_quarter',
    };
  }

  return { frequencyCount: Math.min(count, 24), frequencyPeriod: 'per_year' };
};

const normalizeReward = (reward) => {
  const rewardPercent = getNumber(
    reward.reward_percent,
    reward.rewardPercent,
    reward.cashback_percent,
    reward.cashbackPercent,
    reward.cashback_rate,
    reward.cashbackRate,
    reward.percent,
    reward.points_per_dollar,
    reward.pointsPerDollar,
    reward.earn_rate,
    reward.earnRate,
    reward.rate,
    reward.multiplier,
  );

  const sourceDescription = getSourceDescription(reward);

  if (rewardPercent === null) {
    return {
      normalized: buildEarningReward({
        reward,
        category: getString(reward.category, reward.name) || 'Unvalued earning',
        rewardPercent: 0,
        keywords: null,
        sourceDescription,
        status: 'excluded',
        statusReason: 'Reward rate is missing or not numeric.',
        matchStrategy: 'unvalued',
      }),
    };
  }

  const keywords = normalizeMerchantKeywords(reward);
  if (isGasStationReward(reward)) {
    return {
      normalized: buildEarningReward({
        reward,
        category: 'Gas Stations',
        rewardPercent,
        keywords: 'Gas Stations',
        sourceDescription,
        status: 'included',
        statusReason: null,
        matchStrategy: 'plaid_category_keyword',
      }),
    };
  }

  if (isPharmacyReward(reward)) {
    return {
      normalized: buildEarningReward({
        reward,
        category: 'Pharmacies',
        rewardPercent,
        keywords: 'Pharmacies',
        sourceDescription,
        status: 'included',
        statusReason: null,
        matchStrategy: 'plaid_category_keyword',
      }),
    };
  }

  if (keywords.length > 0) {
    const category =
      getTravelSpecificName({
        keyword: keywords[0],
        sourceDescription,
      }) ||
      getString(reward.category, reward.name) ||
      keywords[0];

    return {
      normalized: buildEarningReward({
        reward,
        category,
        rewardPercent,
        keywords: keywords.join(', '),
        sourceDescription,
        status: 'needs_review',
        statusReason:
          'Vendor keyword rule imported from VectorMint; review transaction labels before including.',
        matchStrategy: 'merchant_keywords',
      }),
    };
  }

  const description = getString(reward.description, reward.name, reward.category);
  if (includesVagueTerm(description)) {
    return {
      normalized: buildEarningReward({
        reward,
        category: getString(reward.category, reward.name) || 'Vague earning',
        rewardPercent,
        keywords: null,
        sourceDescription,
        status: 'excluded',
        statusReason: 'Reward category is too vague to map safely.',
        matchStrategy: 'excluded_vague',
      }),
    };
  }

  const category = normalizeRewardCategory(reward);
  if (!category) {
    return {
      normalized: buildEarningReward({
        reward,
        category: getString(reward.category, reward.name) || 'Unmapped earning',
        rewardPercent,
        keywords: null,
        sourceDescription,
        status: 'excluded',
        statusReason:
          'Reward category does not map to a tracked transaction category.',
        matchStrategy: 'excluded_unmapped',
      }),
    };
  }

  return {
    normalized: buildEarningReward({
      reward,
      category,
      rewardPercent,
      keywords: null,
      sourceDescription,
      status: 'included',
      statusReason: null,
      matchStrategy: 'manual_category',
    }),
  };
};

const buildEarningReward = ({
  reward,
  category,
  rewardPercent,
  keywords,
  sourceDescription,
  status,
  statusReason,
  matchStrategy,
}) => {
  const externalId = getString(
    reward.id,
    reward.reward_id,
    reward.rewardId,
    reward.rule_id,
    reward.ruleId,
    reward.__fallbackExternalId,
  );
  const normalized = {
    externalId: externalId || null,
    category,
    rewardPercent,
    keywords,
    status,
    source: 'vectormint',
    sourceDescription: sourceDescription || null,
    statusReason,
    matchStrategy,
  };

  return {
    ...normalized,
    sourceFingerprint: createFingerprint({
      type: 'earning_reward',
      externalId: normalized.externalId,
      category: normalizeTextKey(normalized.category),
      rewardPercent: Number(normalized.rewardPercent || 0),
      keywords: normalizeTextKey(normalized.keywords || ''),
      sourceDescription: normalizeTextKey(normalized.sourceDescription || ''),
    }),
  };
};

const normalizePerk = (perk) => {
  const name = getString(
    perk.name,
    perk.title,
    perk.merchant_name,
    perk.merchantName,
    perk.human_description,
    perk.humanDescription,
    perk.description,
  );
  const dollarValue = getNumber(
    perk.dollar_value,
    perk.dollarValue,
    perk.annual_maximum_usd,
    perk.annualMaximumUsd,
    perk.amount_per_period,
    perk.amountPerPeriod,
    perk.amount_usd,
    perk.amountUsd,
    perk.estimated_value_usd,
    perk.estimatedValueUsd,
    perk.annual_value_usd,
    perk.annualValueUsd,
    perk.value,
    perk.amount,
    perk.annual_value,
    perk.annualValue,
  );

  const sourceDescription = getSourceDescription(perk);

  if (!name) {
    return {
      normalized: buildPerkAward({
        perk,
        name: 'Unnamed perk',
        dollarValue: 0,
        frequencyCount: 1,
        frequencyPeriod: 'per_year',
        sourceDescription,
        status: 'excluded',
        statusReason: 'Perk name is missing.',
        matchStrategy: 'excluded_missing_name',
      }),
    };
  }

  if (dollarValue === null || dollarValue <= 0) {
    return {
      normalized: buildPerkAward({
        perk,
        name,
        dollarValue: 0,
        frequencyCount: 1,
        frequencyPeriod: 'per_year',
        sourceDescription,
        status: 'excluded',
        statusReason: 'Perk has no stable dollar value.',
        matchStrategy: 'excluded_unvalued',
      }),
    };
  }

  const normalizedName = normalizeTextKey(name);
  if (UNTRACKABLE_PERK_TERMS.some((term) => normalizedName.includes(term))) {
    return {
      normalized: buildPerkAward({
        perk,
        name,
        dollarValue,
        frequencyCount: 1,
        frequencyPeriod: 'per_year',
        sourceDescription,
        status: 'excluded',
        statusReason: 'Perk is not cleanly trackable from transactions.',
        matchStrategy: 'excluded_untrackable',
      }),
    };
  }

  const { frequencyCount, frequencyPeriod } = normalizeFrequency(perk);

  return {
    normalized: buildPerkAward({
      perk,
      name,
      dollarValue,
      frequencyCount,
      frequencyPeriod,
      sourceDescription,
      status: 'needs_review',
      statusReason:
        'Perk imported from VectorMint; review value and frequency before including.',
      matchStrategy: 'statement_credit',
      autoComplete: false,
    }),
  };
};

const buildPerkAward = ({
  perk,
  name,
  dollarValue,
  frequencyCount,
  frequencyPeriod,
  sourceDescription,
  status,
  statusReason,
  matchStrategy,
  autoComplete = false,
}) => {
  const externalId = getString(
    perk.id,
    perk.credit_id,
    perk.creditId,
    perk.benefit_id,
    perk.benefitId,
    perk.__fallbackExternalId,
  );
  const normalized = {
    externalId: externalId || null,
    name,
    dollarValue,
    frequencyCount,
    frequencyPeriod,
    autoComplete,
    status,
    source: 'vectormint',
    sourceDescription: sourceDescription || null,
    statusReason,
    matchStrategy,
  };

  return {
    ...normalized,
    sourceFingerprint: createFingerprint({
      type: 'perk_award',
      externalId: normalized.externalId,
      name: normalizeTextKey(normalized.name),
      dollarValue: Number(normalized.dollarValue || 0),
      frequencyCount: Number(normalized.frequencyCount || 1),
      frequencyPeriod: normalized.frequencyPeriod,
      autoComplete: Boolean(normalized.autoComplete),
      sourceDescription: normalizeTextKey(normalized.sourceDescription || ''),
    }),
  };
};

const getCardRewards = (card) =>
  getArray(
    card.reward_rules,
    card.rewardRules,
    card.earning_rewards,
    card.earningRewards,
    card.rewards,
    card.earn,
    card.earnings,
  );

const getCardPerks = (card) =>
  [
    ...getArray(card.perk_awards, card.perkAwards, card.perks, card.benefits),
    ...getArray(card.credits, card.statement_credits, card.statementCredits),
  ];

const extractExternalCards = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  return getArray(
    payload.data,
    payload.cards,
    payload.card_types,
    payload.cardTypes,
    payload.data?.cards,
    payload.data?.card_types,
    payload.data?.cardTypes,
  );
};

const normalizeVectorMintCard = (card) => {
  const name = getString(card.name, card.card_name, card.cardName, card.title);
  const annualFee = getNumber(card.annual_fee, card.annualFee, card.fee) || 0;
  const earningRewards = [];
  const perkAwards = [];
  const excludedBenefits = [];

  getCardRewards(card).forEach((reward, index) => {
    reward.__fallbackExternalId = getExternalId(reward, 'reward', index);
    const result = normalizeReward(reward);

    if (result.normalized) {
      earningRewards.push(result.normalized);
    }
  });

  getCardPerks(card).forEach((perk, index) => {
    perk.__fallbackExternalId = getExternalId(perk, 'perk', index);
    const result = normalizePerk(perk);

    if (result.normalized) {
      perkAwards.push(result.normalized);
    }
  });

  const earningRewardsWithUniqueNames = ensureUniqueBenefitNames({
    benefits: earningRewards,
    nameKey: 'category',
  });
  const perkAwardsWithUniqueNames = ensureUniqueBenefitNames({
    benefits: perkAwards,
    nameKey: 'name',
  });

  const normalizedCard = {
    sourceId: card.id || card.slug || null,
    name,
    nameKey: normalizeCardName(name),
    annualFee,
    earningRewards: earningRewardsWithUniqueNames,
    perkAwards: perkAwardsWithUniqueNames,
    excludedBenefits,
    raw: card,
  };

  return {
    ...normalizedCard,
    sourceFingerprint: createFingerprint({
      type: 'card',
      sourceId: normalizedCard.sourceId,
      name: normalizeCardName(normalizedCard.name),
      annualFee: normalizedCard.annualFee,
      earningRewards: earningRewardsWithUniqueNames.map(
        (reward) => reward.sourceFingerprint,
      ),
      perkAwards: perkAwardsWithUniqueNames.map(
        (perk) => perk.sourceFingerprint,
      ),
    }),
  };
};

const ensureUniqueBenefitNames = ({ benefits, nameKey }) => {
  const nameCounts = new Map();

  return benefits.map((benefit) => {
    const label = benefit[nameKey];
    const normalizedLabel = normalizeTextKey(label);
    const currentCount = nameCounts.get(normalizedLabel) || 0;

    nameCounts.set(normalizedLabel, currentCount + 1);

    if (currentCount === 0) {
      return benefit;
    }

    const descriptionHint = getString(benefit.sourceDescription)
      .replace(/\s+/g, ' ')
      .slice(0, 44)
      .trim();

    return {
      ...benefit,
      [nameKey]: descriptionHint
        ? `${label} (${descriptionHint})`
        : `${label} (${currentCount + 1})`,
    };
  });
};

const normalizeVectorMintCards = (payload) =>
  extractExternalCards(payload)
    .map(normalizeVectorMintCard)
    .filter((card) => card.name);

module.exports = {
  extractExternalCards,
  normalizeCardName,
  createFingerprint,
  normalizeVectorMintCard,
  normalizeVectorMintCards,
  isGasStationReward,
  isPharmacyReward,
};
