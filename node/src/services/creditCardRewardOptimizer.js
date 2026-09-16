'use strict';

const { roundMoney } = require('../utils/money');
const {
  getEarningRewardAmountForTransaction,
} = require('./creditCardRewardEarnings');
const {
  canonicalizeExpenseCategory,
  getTransactionVendorName,
} = require('./transactions/transactionCategory');

const MIN_MISSED_REWARD = 0.01;
const MIN_NET_ANNUAL_CARD_VALUE = 12;

const isIncludedBenefit = (benefit) =>
  !benefit.status || benefit.status === 'included';

const isActiveCardType = (cardType) =>
  !cardType.status || cardType.status === 'active';

const getIncludedEarningRewards = (cardType) =>
  (cardType.earning_rewards || []).filter(isIncludedBenefit);

const toNumber = (value) =>
  value === null || value === undefined ? null : Number(value);

const formatDate = (value) => {
  if (!value) {
    return null;
  }

  return value.toISOString ? value.toISOString().slice(0, 10) : String(value);
};

const serializeOptimizerTransaction = (transaction) => ({
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

const getAccountLabel = (account) =>
  [account.institution_name, account.mask ? `**** ${account.mask}` : null]
    .filter(Boolean)
    .join(' ') ||
  account.official_name ||
  account.name ||
  'Credit card';

// Same idea as getAccountLabel, but for a raw transaction row joined against
// accounts/plaid_items (models.transactions.findByUserIdEnvironmentAndDateRange),
// which carries account_mask/account_name instead of an account object.
const getTransactionAccountLabel = (transaction) =>
  [
    transaction.institution_name,
    transaction.account_mask ? `**** ${transaction.account_mask}` : null,
  ]
    .filter(Boolean)
    .join(' ') ||
  transaction.account_name ||
  'Account';

const getOwnedCardTypes = ({ accounts, cardTypes }) => {
  const cardTypeById = new Map(
    cardTypes.map((cardType) => [Number(cardType.id), cardType]),
  );
  const ownedCardTypesById = new Map();

  accounts
    .filter((account) => account.credit_card_type_id)
    .forEach((account) => {
      const cardType = cardTypeById.get(Number(account.credit_card_type_id));

      const earningRewards = cardType ? getIncludedEarningRewards(cardType) : [];

      if (cardType && isActiveCardType(cardType) && earningRewards.length > 0) {
        ownedCardTypesById.set(cardType.id, {
          ...cardType,
          earning_rewards: earningRewards,
        });
      }
    });

  return Array.from(ownedCardTypesById.values());
};

const getCardRewardValue = ({ cardType, transaction }) => {
  const result = getEarningRewardAmountForTransaction({
    earningRewards: getIncludedEarningRewards(cardType),
    transaction,
  });

  return {
    reward: result.reward,
    rewardValue: result.amount,
  };
};

const isCreditCardTransaction = (transaction) =>
  transaction.account_type === 'credit' ||
  transaction.account_subtype === 'credit card';

const getBestCardForTransaction = ({ ownedCardTypes, transaction }) =>
  ownedCardTypes.reduce(
    (best, cardType) => {
      const cardResult = getCardRewardValue({ cardType, transaction });

      if (!best || cardResult.rewardValue > best.rewardValue) {
        return {
          cardType,
          ...cardResult,
        };
      }

      return best;
    },
    null,
  );

const addGroupTransaction = ({ groups, key, group, transactionFinding }) => {
  const existingGroup =
    groups.get(key) ||
    {
      ...group,
      transaction_count: 0,
      total_spend: 0,
      actual_reward_value: 0,
      optimized_reward_value: 0,
      missed_reward_value: 0,
      largest_missed_reward_value: 0,
      transactions: [],
    };

  existingGroup.transaction_count += 1;
  existingGroup.total_spend = roundMoney(
    existingGroup.total_spend + transactionFinding.transaction.amount,
  );
  existingGroup.actual_reward_value = roundMoney(
    existingGroup.actual_reward_value + transactionFinding.actual_reward_value,
  );
  existingGroup.optimized_reward_value = roundMoney(
    existingGroup.optimized_reward_value +
      transactionFinding.optimized_reward_value,
  );
  existingGroup.missed_reward_value = roundMoney(
    existingGroup.missed_reward_value + transactionFinding.missed_reward_value,
  );
  existingGroup.largest_missed_reward_value = Math.max(
    existingGroup.largest_missed_reward_value,
    transactionFinding.missed_reward_value,
  );
  existingGroup.transactions.push(transactionFinding);
  groups.set(key, existingGroup);
};

const scoreGroup = (group) =>
  roundMoney(
    group.missed_reward_value +
      group.transaction_count * 0.25 +
      group.largest_missed_reward_value * 0.1,
  );

const buildRecommendationGroups = (findings) => {
  const groups = new Map();

  findings.forEach((finding) => {
    const category = canonicalizeExpenseCategory(
      finding.transaction.display_category ||
        finding.transaction.manual_category ||
        finding.transaction.category ||
        'Uncategorized',
    );
    const vendor = getTransactionVendorName(finding.transaction);
    const recommendationKey = [
      finding.actual_card_type_id,
      finding.recommended_card_type_id,
    ].join(':');

    addGroupTransaction({
      groups,
      key: `category:${recommendationKey}:${category.toLowerCase()}`,
      group: {
        group_type: 'category',
        group_label: category,
        actual_card_type_id: finding.actual_card_type_id,
        actual_card_name: finding.actual_card_name,
        recommended_card_type_id: finding.recommended_card_type_id,
        recommended_card_name: finding.recommended_card_name,
      },
      transactionFinding: finding,
    });

    addGroupTransaction({
      groups,
      key: `vendor:${recommendationKey}:${vendor.toLowerCase()}`,
      group: {
        group_type: 'vendor',
        group_label: vendor,
        actual_card_type_id: finding.actual_card_type_id,
        actual_card_name: finding.actual_card_name,
        recommended_card_type_id: finding.recommended_card_type_id,
        recommended_card_name: finding.recommended_card_name,
      },
      transactionFinding: finding,
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      priority_score: scoreGroup(group),
      transactions: group.transactions.sort(
        (left, right) =>
          right.missed_reward_value - left.missed_reward_value ||
          right.transaction.amount - left.transaction.amount,
      ),
    }))
    .filter(
      (group) =>
        group.missed_reward_value >= MIN_MISSED_REWARD &&
        (group.group_type === 'category' ||
          group.transaction_count > 1 ||
          group.missed_reward_value >= 1),
    )
    .sort(
      (left, right) =>
        right.missed_reward_value - left.missed_reward_value ||
        right.transaction_count - left.transaction_count ||
        right.largest_missed_reward_value - left.largest_missed_reward_value,
    );
};

/**
 * `transactions` is the already-fetched, already-categorized transaction list
 * for the trailing optimization period across the user's accounts (see
 * creditCardRewardsService.getCreditCardRewards) - shared with
 * buildNewCardRecommendations so the period's transactions are only fetched
 * once per request.
 */
const buildCreditCardRewardOptimization = ({
  accounts,
  cardTypes,
  transactions,
  periodStart,
  periodEnd,
}) => {
  const assignedCreditAccounts = accounts.filter(
    (account) => account.credit_card_type_id,
  );
  const accountById = new Map(
    assignedCreditAccounts.map((account) => [Number(account.id), account]),
  );
  const cardTypeById = new Map(
    cardTypes.map((cardType) => [Number(cardType.id), cardType]),
  );
  const ownedCardTypes = getOwnedCardTypes({ accounts, cardTypes });

  if (ownedCardTypes.length === 0 || assignedCreditAccounts.length === 0) {
    return {
      period_start: periodStart,
      period_end: periodEnd,
      actual_reward_value: 0,
      optimized_reward_value: 0,
      missed_reward_value: 0,
      recommendation_groups: [],
    };
  }

  const scopedTransactions = transactions.filter(
    (transaction) =>
      accountById.has(Number(transaction.account_id)) &&
      Number(transaction.amount) > 0,
  );
  const findings = [];
  let actualRewardValue = 0;
  let optimizedRewardValue = 0;

  scopedTransactions.forEach((transaction) => {
    const account = accountById.get(Number(transaction.account_id));
    const actualCardType = cardTypeById.get(Number(account.credit_card_type_id));

    if (
      !actualCardType ||
      !isActiveCardType(actualCardType) ||
      getIncludedEarningRewards(actualCardType).length === 0
    ) {
      return;
    }

    const actualResult = getCardRewardValue({
      cardType: actualCardType,
      transaction,
    });
    const optimizedResult = getBestCardForTransaction({
      ownedCardTypes,
      transaction,
    });

    actualRewardValue = roundMoney(actualRewardValue + actualResult.rewardValue);
    optimizedRewardValue = roundMoney(
      optimizedRewardValue + (optimizedResult?.rewardValue || 0),
    );

    if (
      !optimizedResult ||
      optimizedResult.cardType.id === actualCardType.id ||
      optimizedResult.rewardValue - actualResult.rewardValue < MIN_MISSED_REWARD
    ) {
      return;
    }

    findings.push({
      transaction: {
        ...serializeOptimizerTransaction(transaction),
        account_id: Number(account.id),
        account_label: getAccountLabel(account),
      },
      actual_card_type_id: actualCardType.id,
      actual_card_name: actualCardType.name,
      actual_reward_category: actualResult.reward?.category || null,
      actual_reward_percent: actualResult.reward
        ? toNumber(actualResult.reward.reward_percent)
        : 0,
      actual_reward_value: actualResult.rewardValue,
      recommended_card_type_id: optimizedResult.cardType.id,
      recommended_card_name: optimizedResult.cardType.name,
      recommended_reward_category: optimizedResult.reward?.category || null,
      recommended_reward_percent: optimizedResult.reward
        ? toNumber(optimizedResult.reward.reward_percent)
        : 0,
      optimized_reward_value: optimizedResult.rewardValue,
      missed_reward_value: roundMoney(
        optimizedResult.rewardValue - actualResult.rewardValue,
      ),
    });
  });

  return {
    period_start: periodStart,
    period_end: periodEnd,
    actual_reward_value: actualRewardValue,
    optimized_reward_value: optimizedRewardValue,
    missed_reward_value: roundMoney(optimizedRewardValue - actualRewardValue),
    recommendation_groups: buildRecommendationGroups(findings),
  };
};

const buildCardRecommendationCategoryBreakdown = (transactionFindings) => {
  const byCategory = new Map();

  transactionFindings.forEach((finding) => {
    const category = canonicalizeExpenseCategory(
      finding.transaction.display_category ||
        finding.transaction.manual_category ||
        finding.transaction.category ||
        'Uncategorized',
    );
    const candidateRewardCategory =
      finding.candidate_reward_category || 'Base rate';
    const candidateRewardPercent = finding.candidate_reward_percent || 0;
    const key = [
      category.toLowerCase(),
      candidateRewardCategory.toLowerCase(),
      candidateRewardPercent,
    ].join(':');
    const entry = byCategory.get(key) || {
      category,
      candidate_reward_category: candidateRewardCategory,
      candidate_reward_percent: candidateRewardPercent,
      total_spend: 0,
      current_reward_value: 0,
      expected_reward_value: 0,
      additional_reward_value: 0,
      transaction_count: 0,
    };

    entry.total_spend = roundMoney(
      entry.total_spend + finding.transaction.amount,
    );
    entry.current_reward_value = roundMoney(
      entry.current_reward_value + finding.baseline_reward_value,
    );
    entry.expected_reward_value = roundMoney(
      entry.expected_reward_value + finding.candidate_reward_value,
    );
    entry.additional_reward_value = roundMoney(
      entry.additional_reward_value + finding.additional_reward_value,
    );
    entry.transaction_count += 1;
    byCategory.set(key, entry);
  });

  return Array.from(byCategory.values()).sort(
    (left, right) => right.additional_reward_value - left.additional_reward_value,
  );
};

const buildCardRecommendation = ({
  candidateCardType,
  ownedCardTypes,
  spendTransactions,
}) => {
  let projectedRewardValue = 0;
  let additionalRewardValue = 0;
  const transactionFindings = [];

  spendTransactions.forEach((transaction) => {
    const baseline = getBestCardForTransaction({ ownedCardTypes, transaction });
    const baselineRewardValue = baseline?.rewardValue || 0;
    const candidateResult = getCardRewardValue({
      cardType: candidateCardType,
      transaction,
    });
    const additionalValue = roundMoney(
      candidateResult.rewardValue - baselineRewardValue,
    );

    projectedRewardValue = roundMoney(
      projectedRewardValue + candidateResult.rewardValue,
    );

    if (additionalValue < MIN_MISSED_REWARD) {
      return;
    }

    additionalRewardValue = roundMoney(additionalRewardValue + additionalValue);
    transactionFindings.push({
      transaction: {
        ...serializeOptimizerTransaction(transaction),
        account_id: Number(transaction.account_id),
        account_label: getTransactionAccountLabel(transaction),
      },
      baseline_card_type_id: baseline?.cardType?.id || null,
      baseline_card_name: baseline?.cardType?.name || null,
      baseline_reward_value: baselineRewardValue,
      candidate_reward_category: candidateResult.reward?.category || null,
      candidate_reward_percent: candidateResult.reward
        ? toNumber(candidateResult.reward.reward_percent)
        : 0,
      candidate_reward_value: candidateResult.rewardValue,
      additional_reward_value: additionalValue,
    });
  });

  const netAnnualValue = roundMoney(
    additionalRewardValue - candidateCardType.annual_fee,
  );

  if (netAnnualValue < MIN_NET_ANNUAL_CARD_VALUE) {
    return null;
  }

  const categoryBreakdown =
    buildCardRecommendationCategoryBreakdown(transactionFindings);
  const applicableSpend = roundMoney(
    categoryBreakdown.reduce(
      (total, category) => total + category.total_spend,
      0,
    ),
  );

  return {
    card_type_id: candidateCardType.id,
    card_type_name: candidateCardType.name,
    annual_fee: candidateCardType.annual_fee,
    transaction_count: transactionFindings.length,
    total_spend: applicableSpend,
    projected_reward_value: projectedRewardValue,
    additional_reward_value: additionalRewardValue,
    net_annual_value: netAnnualValue,
    category_breakdown: categoryBreakdown,
    top_categories: categoryBreakdown.slice(0, 3),
    transactions: transactionFindings.sort(
      (left, right) => right.additional_reward_value - left.additional_reward_value,
    ),
  };
};

/**
 * Looks past the cards the user already owns: for every card type in the
 * catalog they *don't* have, replays credit-card spend from the optimization
 * period against that card's earning rewards,
 * and compares it to the best they could already do with their current
 * wallet. A card only surfaces once its extra reward clears its own annual
 * fee by more than a noise floor - perks are intentionally
 * not part of this, this is earning-rate optimization only.
 */
const buildNewCardRecommendations = ({
  ownedCardTypes,
  candidateCardTypes,
  transactions,
  periodStart,
  periodEnd,
}) => {
  const ownedCardTypeIds = new Set(
    ownedCardTypes.map((cardType) => cardType.id),
  );
  const eligibleCandidates = candidateCardTypes.filter(
    (cardType) =>
      !ownedCardTypeIds.has(cardType.id) &&
      isActiveCardType(cardType) &&
      getIncludedEarningRewards(cardType).length > 0,
  );
  const spendTransactions = transactions.filter(
    (transaction) =>
      transaction.is_expense &&
      Number(transaction.amount) > 0 &&
      isCreditCardTransaction(transaction),
  );

  const recommendations = eligibleCandidates
    .map((candidateCardType) =>
      buildCardRecommendation({
        candidateCardType,
        ownedCardTypes,
        spendTransactions,
      }),
    )
    .filter(Boolean)
    .sort(
      (left, right) =>
        right.net_annual_value - left.net_annual_value ||
        right.additional_reward_value - left.additional_reward_value,
    );

  const bestOverall = recommendations[0] || null;
  const bestNoAnnualFee =
    recommendations.find(
      (recommendation) =>
        recommendation.annual_fee === 0 &&
        recommendation.card_type_id !== bestOverall?.card_type_id,
    ) || null;

  return {
    period_start: periodStart,
    period_end: periodEnd,
    best_overall: bestOverall,
    best_no_annual_fee: bestNoAnnualFee,
    recommendations: recommendations.slice(0, 3),
  };
};

module.exports = {
  buildCreditCardRewardOptimization,
  buildNewCardRecommendations,
  buildRecommendationGroups,
  getBestCardForTransaction,
  getOwnedCardTypes,
};
