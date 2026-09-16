'use strict';

const models = require('../models');
const {
  getCurrentCycleRange,
  getCurrentCycleStart,
  getReferenceDate,
} = require('./creditCardRewardCycles');
const {
  computeEarningRewardBreakdown,
} = require('./creditCardRewardEarnings');
const {
  buildCreditCardRewardOptimization,
  buildNewCardRecommendations,
  getOwnedCardTypes,
} = require('./creditCardRewardOptimizer');
const {
  getDashboardPlaidEnvironment,
} = require('./dashboard/dashboardContext');
const {
  applyTransactionCategoryRules,
} = require('./transactions/categoryRules');
const { getCurrentUser } = require('./authService');
const {
  importVectorMintCardCatalog,
} = require('./vectorMint/vectorMintCardImportService');

const FREQUENCY_MULTIPLIERS = {
  per_year: 1,
  per_quarter: 4,
  per_month: 12,
};

const requireCardTypeManager = async () => {
  const user = await getCurrentUser();

  if (user.account_type !== 'admin') {
    const error = new Error('Only the account owner can manage credit card types.');
    error.status = 403;
    throw error;
  }
};

const getAnnualOccurrenceCount = (award) =>
  Number(award.frequency_count || 1) *
  (FREQUENCY_MULTIPLIERS[award.frequency_period] || 1);

const formatMonth = (value) => {
  if (!value) {
    return null;
  }

  return value.toISOString
    ? value.toISOString().slice(5, 7)
    : String(value).slice(5, 7);
};

const formatDate = (value) => {
  if (!value) {
    return null;
  }

  return value.toISOString ? value.toISOString().slice(0, 10) : String(value);
};

const toNumber = (value) =>
  value === null || value === undefined ? null : Number(value);

const isIncludedBenefit = (benefit) =>
  !benefit.status || benefit.status === 'included';

const getIncludedEarningRewards = (cardType) =>
  cardType.earning_rewards.filter(isIncludedBenefit);

const getIncludedPerkAwards = (cardType) =>
  cardType.perk_awards.filter(isIncludedBenefit);

const serializeEarningReward = (reward) => ({
  id: Number(reward.id),
  category: reward.category,
  reward_percent: toNumber(reward.reward_percent),
  keywords: reward.keywords || null,
  status: reward.status || 'included',
  source: reward.source || 'manual',
  source_description: reward.source_description || null,
  status_reason: reward.status_reason || null,
  match_strategy: reward.match_strategy || null,
});

const serializePerkAward = (award) => ({
  id: Number(award.id),
  name: award.name,
  dollar_value: toNumber(award.dollar_value),
  completion_amount: toNumber(award.completion_amount),
  frequency_count: Number(award.frequency_count || 1),
  frequency_period: award.frequency_period || 'per_year',
  auto_complete: Boolean(award.auto_complete),
  status: award.status || 'included',
  source: award.source || 'manual',
  source_description: award.source_description || null,
  status_reason: award.status_reason || null,
  match_strategy: award.match_strategy || null,
});

const serializeEarningRewardTransaction = (transaction) => ({
  id: Number(transaction.id),
  amount: toNumber(transaction.amount),
  date: formatDate(transaction.date),
  manual_date: formatDate(transaction.manual_date),
  name: transaction.name,
  merchant_name: transaction.merchant_name,
  category: transaction.category,
  manual_category: transaction.manual_category,
  display_category: transaction.display_category,
});

const serializeCardType = ({ cardType, earningRewards, perkAwards }) => ({
  id: Number(cardType.id),
  name: cardType.name,
  annual_fee: toNumber(cardType.annual_fee),
  status: cardType.status || 'active',
  source: cardType.source || 'manual',
  review_reason: cardType.review_reason || null,
  external_source: cardType.external_source || null,
  external_card_id: cardType.external_card_id || null,
  earning_rewards: earningRewards
    .filter((reward) => String(reward.credit_card_type_id) === String(cardType.id))
    .map(serializeEarningReward),
  perk_awards: perkAwards
    .filter((award) => String(award.credit_card_type_id) === String(cardType.id))
    .map(serializePerkAward),
});

const serializeAccount = ({
  account,
  cardTypeById,
  perkCompletionsByAccountId,
  earningRewardBreakdownsByAccountId,
}) => {
  const cardTypeId = account.credit_card_type_id
    ? Number(account.credit_card_type_id)
    : null;

  return {
    id: Number(account.id),
    name: account.name,
    mask: account.mask,
    official_name: account.official_name,
    subtype: account.subtype,
    type: account.type,
    institution_name: account.institution_name,
    credit_card_type_id: cardTypeId,
    credit_card_type: cardTypeId ? cardTypeById.get(cardTypeId) || null : null,
    effective_month: formatMonth(account.effective_month),
    perk_completions: perkCompletionsByAccountId.get(Number(account.id)) || [],
    earning_reward_totals: (
      earningRewardBreakdownsByAccountId.get(Number(account.id)) || []
    ).map(({ earning_reward_id: earningRewardId, amount }) => ({
      earning_reward_id: earningRewardId,
      amount,
    })),
    earning_reward_breakdowns:
      earningRewardBreakdownsByAccountId.get(Number(account.id)) || [],
  };
};

const computeAccountEarningRewardBreakdowns = async ({
  accounts,
  cardTypeById,
  referenceDate,
  transactionCategoryRules,
}) => {
  const breakdownsByAccountId = new Map();
  const rewardEligibleAccounts = accounts
    .filter((account) => account.credit_card_type_id && account.effective_month)
    .map((account) => ({
      account,
      cardType: cardTypeById.get(Number(account.credit_card_type_id)),
    }))
    .filter(
      ({ cardType }) =>
        cardType &&
        cardType.status === 'active' &&
        getIncludedEarningRewards(cardType).length > 0,
    );

  if (rewardEligibleAccounts.length === 0) {
    return breakdownsByAccountId;
  }

  const accountRanges = rewardEligibleAccounts.map(({ account }) => {
    const cycleRange = getCurrentCycleRange(
      account.effective_month,
      referenceDate,
    );

    return {
      accountId: Number(account.id),
      startDate: cycleRange.cycleStart,
      endDate: cycleRange.cycleEnd,
    };
  });

  const rawTransactions = await models.transactions.findByAccountIdsAndDateRanges(
    accountRanges,
  );
  const categorizedTransactions = applyTransactionCategoryRules(
    rawTransactions,
    transactionCategoryRules,
  );
  const transactionsByAccountId = new Map();

  categorizedTransactions.forEach((transaction) => {
    const accountId = Number(transaction.account_id);

    if (!transactionsByAccountId.has(accountId)) {
      transactionsByAccountId.set(accountId, []);
    }

    transactionsByAccountId.get(accountId).push(transaction);
  });

  rewardEligibleAccounts.forEach(({ account, cardType }) => {
    breakdownsByAccountId.set(
      Number(account.id),
      computeEarningRewardBreakdown({
        earningRewards: getIncludedEarningRewards(cardType),
        transactions: transactionsByAccountId.get(Number(account.id)) || [],
      }).map((breakdown) => ({
        earning_reward_id: Number(breakdown.earning_reward_id),
        amount: breakdown.amount,
        transactions: breakdown.transactions
          .map(serializeEarningRewardTransaction)
          .sort((left, right) => {
            const leftDate = left.manual_date || left.date;
            const rightDate = right.manual_date || right.date;

            return rightDate.localeCompare(leftDate) || right.id - left.id;
          }),
      })),
    );
  });

  return breakdownsByAccountId;
};

const getCreditCardRewards = async ({ selectedMonth } = {}) => {
  const user = await getCurrentUser();
  const referenceDate = getReferenceDate(selectedMonth);
  const snapshotMonth = referenceDate.format('YYYY-MM');
  const [catalog, accounts, transactionCategoryRules] = await Promise.all([
    models.creditCardRewards.findRewardCatalog(),
    models.creditCardRewards.findCreditAccountsByUserId(user.id),
    models.transactionCategoryRules.findByUserId(user.id),
  ]);
  const cardTypes = catalog.cardTypes.map((cardType) =>
    serializeCardType({
      cardType,
      earningRewards: catalog.earningRewards,
      perkAwards: catalog.perkAwards,
    }),
  );
  const cardTypeById = new Map(
    cardTypes.map((cardType) => [cardType.id, cardType]),
  );

  const accountCycles = accounts
    .filter((account) => account.credit_card_type_id && account.effective_month)
    .map((account) => ({
      accountId: Number(account.id),
      cycleStart: getCurrentCycleStart(account.effective_month, referenceDate),
    }));
  const completions =
    await models.creditCardRewards.findPerkCompletionsForAccountCycles(
      accountCycles,
    );
  const perkCompletionsByAccountId = new Map();

  completions.forEach((row) => {
    const accountId = Number(row.account_id);

    if (!perkCompletionsByAccountId.has(accountId)) {
      perkCompletionsByAccountId.set(accountId, []);
    }

    perkCompletionsByAccountId.get(accountId).push({
      perk_award_id: Number(row.perk_award_id),
      occurrence_index: Number(row.occurrence_index),
    });
  });

  const earningRewardBreakdownsByAccountId =
    await computeAccountEarningRewardBreakdowns({
      accounts,
      cardTypeById,
      referenceDate,
      transactionCategoryRules,
    });

  return {
    selected_month: snapshotMonth,
    card_types: cardTypes,
    accounts: accounts.map((account) =>
      serializeAccount({
        account,
        cardTypeById,
        perkCompletionsByAccountId,
        earningRewardBreakdownsByAccountId,
      }),
    ),
  };
};

const getCreditCardRewardOptimization = async ({ selectedMonth } = {}) => {
  const user = await getCurrentUser();
  const dashboardPlaidEnv = await getDashboardPlaidEnvironment(user);
  const referenceDate = getReferenceDate(selectedMonth);
  const [catalog, accounts, transactionCategoryRules] = await Promise.all([
    models.creditCardRewards.findRewardCatalog(),
    models.creditCardRewards.findCreditAccountsByUserId(user.id),
    models.transactionCategoryRules.findByUserId(user.id),
  ]);
  const cardTypes = catalog.cardTypes.map((cardType) =>
    serializeCardType({
      cardType,
      earningRewards: catalog.earningRewards,
      perkAwards: catalog.perkAwards,
    }),
  );
  const optimizationRangeStart = referenceDate
    .clone()
    .subtract(11, 'months')
    .startOf('month');
  const optimizationRangeEnd = referenceDate.clone().endOf('month');
  const rawOptimizationTransactions =
    await models.transactions.findByUserIdEnvironmentAndDateRange({
      userId: user.id,
      plaidEnvironment: dashboardPlaidEnv,
      startDate: optimizationRangeStart.format('YYYY-MM-DD'),
      endDate: optimizationRangeEnd.format('YYYY-MM-DD'),
    });
  const optimizationTransactions = applyTransactionCategoryRules(
    rawOptimizationTransactions,
    transactionCategoryRules,
  );
  const ownedCardTypes = getOwnedCardTypes({ accounts, cardTypes });
  const optimization = buildCreditCardRewardOptimization({
    accounts,
    cardTypes,
    transactions: optimizationTransactions,
    periodStart: optimizationRangeStart.format('YYYY-MM-DD'),
    periodEnd: optimizationRangeEnd.format('YYYY-MM-DD'),
  });
  const cardRecommendations = buildNewCardRecommendations({
    ownedCardTypes,
    candidateCardTypes: cardTypes,
    transactions: optimizationTransactions,
    periodStart: optimizationRangeStart.format('YYYY-MM-DD'),
    periodEnd: optimizationRangeEnd.format('YYYY-MM-DD'),
  });

  return {
    optimization,
    card_recommendations: cardRecommendations,
  };
};

const setAccountCreditCardType = async ({
  accountId,
  creditCardTypeId = null,
  effectiveMonth = null,
  selectedMonth,
}) => {
  const user = await getCurrentUser();
  const account = await models.creditCardRewards.findCreditAccountByIdForUser({
    accountId,
    userId: user.id,
  });

  if (!account) {
    const error = new Error('Credit card account was not found.');
    error.status = 404;
    throw error;
  }

  if (creditCardTypeId === null) {
    await models.creditCardRewards.deleteAccountType(accountId);
    return getCreditCardRewards({ selectedMonth });
  }

  const cardType =
    await models.creditCardRewards.findCreditCardTypeById(creditCardTypeId);

  if (!cardType) {
    const error = new Error('Credit card type was not found.');
    error.status = 400;
    throw error;
  }

  if (cardType.status && cardType.status !== 'active') {
    const error = new Error('Credit card type is still in review.');
    error.status = 400;
    throw error;
  }

  await models.creditCardRewards.upsertAccountType({
    accountId,
    creditCardTypeId,
    effectiveMonth,
  });

  return getCreditCardRewards({ selectedMonth });
};

const createCreditCardType = async ({
  name,
  annualFee,
  earningRewards,
  perkAwards,
  selectedMonth,
}) => {
  await requireCardTypeManager();

  try {
    await models.creditCardRewards.createCardTypeWithRewards({
      name,
      annualFee,
      earningRewards,
      perkAwards,
    });
  } catch (error) {
    if (error.code === '23505') {
      const validationError = new Error('Credit card type already exists.');
      validationError.status = 409;
      throw validationError;
    }

    throw error;
  }

  return getCreditCardRewards({ selectedMonth });
};

const updateCreditCardType = async ({
  cardTypeId,
  name,
  annualFee,
  earningRewards,
  perkAwards,
  selectedMonth,
}) => {
  await requireCardTypeManager();

  const existing =
    await models.creditCardRewards.findCreditCardTypeById(cardTypeId);

  if (!existing) {
    const error = new Error('Credit card type was not found.');
    error.status = 404;
    throw error;
  }

  try {
    await models.creditCardRewards.updateCardTypeWithRewards({
      cardTypeId,
      name,
      annualFee,
      earningRewards,
      perkAwards,
    });
  } catch (error) {
    if (error.code === '23505') {
      const validationError = new Error('Credit card type already exists.');
      validationError.status = 409;
      throw validationError;
    }

    throw error;
  }

  return getCreditCardRewards({ selectedMonth });
};

const importVectorMintCreditCardTypes = async ({ selectedMonth } = {}) => {
  const importSummary = await importVectorMintCardCatalog();
  const rewards = await getCreditCardRewards({ selectedMonth });

  return {
    import_summary: importSummary,
    rewards,
  };
};

const setPerkCompletion = async ({
  accountId,
  perkAwardId,
  occurrenceIndex,
  completed,
  selectedMonth,
}) => {
  const user = await getCurrentUser();
  const referenceDate = getReferenceDate(selectedMonth);
  const account =
    await models.creditCardRewards.findCreditAccountWithTypeByIdForUser({
      accountId,
      userId: user.id,
    });

  if (!account) {
    const error = new Error('Credit card account was not found.');
    error.status = 404;
    throw error;
  }

  if (!account.credit_card_type_id || !account.effective_month) {
    const error = new Error(
      'Assign a card type and effective month before tracking perks.',
    );
    error.status = 400;
    throw error;
  }

  const perkAward = await models.creditCardRewards.findPerkAwardById(
    perkAwardId,
  );

  if (
    !perkAward ||
    String(perkAward.credit_card_type_id) !== String(account.credit_card_type_id)
  ) {
    const error = new Error('Perk was not found for this card type.');
    error.status = 400;
    throw error;
  }

  if (perkAward.status && perkAward.status !== 'included') {
    const error = new Error('This perk is excluded from reward tracking.');
    error.status = 400;
    throw error;
  }

  if (occurrenceIndex < 0 || occurrenceIndex >= getAnnualOccurrenceCount(perkAward)) {
    const error = new Error('occurrence_index is out of range for this perk.');
    error.status = 400;
    throw error;
  }

  if (perkAward.auto_complete) {
    const error = new Error(
      'This perk auto-completes each cycle and cannot be toggled manually.',
    );
    error.status = 400;
    throw error;
  }

  const completionParams = {
    accountId,
    perkAwardId,
    occurrenceIndex,
    cycleStart: getCurrentCycleStart(account.effective_month, referenceDate),
  };

  if (completed) {
    await models.creditCardRewards.setPerkCompletion(completionParams);
  } else {
    await models.creditCardRewards.deletePerkCompletion(completionParams);
  }

  return getCreditCardRewards({ selectedMonth });
};

const deleteCreditCardType = async ({ cardTypeId, selectedMonth }) => {
  await requireCardTypeManager();

  const existing =
    await models.creditCardRewards.findCreditCardTypeById(cardTypeId);

  if (!existing) {
    const error = new Error('Credit card type was not found.');
    error.status = 404;
    throw error;
  }

  try {
    await models.creditCardRewards.deleteCardType(cardTypeId);
  } catch (error) {
    if (error.code === '23001' || error.code === '23503') {
      const validationError = new Error(
        'This card type is assigned to one or more accounts. Unassign it first.',
      );
      validationError.status = 409;
      throw validationError;
    }

    throw error;
  }

  return getCreditCardRewards({ selectedMonth });
};

module.exports = {
  createCreditCardType,
  deleteCreditCardType,
  getCreditCardRewardOptimization,
  getCreditCardRewards,
  importVectorMintCreditCardTypes,
  setAccountCreditCardType,
  setPerkCompletion,
  updateCreditCardType,
};
