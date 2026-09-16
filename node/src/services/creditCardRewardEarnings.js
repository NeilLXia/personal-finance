'use strict';

const {
  canonicalizeExpenseCategory,
  isExcludedFromTransactionCalculations,
} = require('./transactions/transactionCategory');
const { roundMoney } = require('../utils/money');

const BASE_RATE_CATEGORY = 'base rate';

const getIncludedEarningRewards = (earningRewards) =>
  earningRewards.filter((reward) => !reward.status || reward.status === 'included');

const parseKeywords = (keywords) =>
  (keywords || '')
    .split(',')
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);

const transactionMatchesKeywords = (transaction, keywords) => {
  const haystack = [
    transaction.name,
    transaction.merchant_name,
    transaction.category,
    transaction.manual_category,
    transaction.display_category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return keywords.some((keyword) => haystack.includes(keyword));
};

const findMatchingEarningReward = ({ earningRewards, transaction }) => {
  const includedEarningRewards = getIncludedEarningRewards(earningRewards);
  const customReward = includedEarningRewards.find((reward) => {
    const keywords = parseKeywords(reward.keywords);

    return keywords.length > 0 && transactionMatchesKeywords(transaction, keywords);
  });

  if (customReward) {
    return customReward;
  }

  const manualCategoryReward = includedEarningRewards.find((reward) => {
    if (reward.keywords) {
      return false;
    }

    if (reward.category.trim().toLowerCase() === BASE_RATE_CATEGORY) {
      return false;
    }

    return (
      canonicalizeExpenseCategory(reward.category).toLowerCase() ===
      canonicalizeExpenseCategory(transaction.display_category).toLowerCase()
    );
  });

  if (manualCategoryReward) {
    return manualCategoryReward;
  }

  return (
    includedEarningRewards.find(
      (reward) =>
        !reward.keywords &&
        reward.category.trim().toLowerCase() === BASE_RATE_CATEGORY,
    ) || null
  );
};

const getEarningRewardAmountForTransaction = ({ earningRewards, transaction }) => {
  if (
    Number(transaction.amount) <= 0 ||
    isExcludedFromTransactionCalculations(transaction)
  ) {
    return {
      amount: 0,
      reward: null,
    };
  }

  const reward = findMatchingEarningReward({ earningRewards, transaction });

  return {
    amount: reward
      ? roundMoney(Number(transaction.amount) * (Number(reward.reward_percent) / 100))
      : 0,
    reward,
  };
};

const createRewardAccumulator = (earningRewards) =>
  new Map(
    getIncludedEarningRewards(earningRewards).map((reward) => [
      reward.id,
      {
        earning_reward_id: reward.id,
        amount: 0,
        transactions: [],
      },
    ]),
  );

const addRewardTransactions = ({
  accumulator,
  reward,
  transactions,
}) => {
  const entry = accumulator.get(reward.id);

  entry.transactions.push(...transactions);
  entry.amount = roundMoney(
    entry.transactions.reduce(
      (sum, transaction) => sum + Number(transaction.amount),
      0,
    ) *
      (Number(reward.reward_percent) / 100),
  );
};

/**
 * Splits an account's spend for its current reward cycle across its card
 * type's earning rewards: custom keyword categories first (in configured
 * order, each transaction claimed by only the first match), then manual
 * category rewards, then whatever is left falls to the base rate. Each
 * transaction contributes to at most one reward. `transactions` must already
 * carry `display_category` (see categoryRules.applyTransactionCategoryRules).
 */
const computeEarningRewardBreakdown = ({ earningRewards, transactions }) => {
  const spendTransactions = transactions.filter(
    (transaction) =>
      Number(transaction.amount) > 0 &&
      !isExcludedFromTransactionCalculations(transaction),
  );
  const claimedTransactionIds = new Set();
  const rewardBreakdownById = createRewardAccumulator(earningRewards);
  const includedEarningRewards = getIncludedEarningRewards(earningRewards);

  const customRewards = includedEarningRewards.filter((reward) => reward.keywords);
  const baseRateReward = includedEarningRewards.find(
    (reward) =>
      !reward.keywords &&
      reward.category.trim().toLowerCase() === BASE_RATE_CATEGORY,
  );
  const manualCategoryRewards = includedEarningRewards.filter(
    (reward) => reward !== baseRateReward && !reward.keywords,
  );

  const claimTransactions = (predicate) =>
    spendTransactions.reduce((matches, transaction) => {
      if (claimedTransactionIds.has(transaction.id)) {
        return matches;
      }

      if (!predicate(transaction)) {
        return matches;
      }

      claimedTransactionIds.add(transaction.id);
      matches.push(transaction);
      return matches;
    }, []);

  customRewards.forEach((reward) => {
    const keywords = parseKeywords(reward.keywords);
    const rewardTransactions = claimTransactions((transaction) =>
      transactionMatchesKeywords(transaction, keywords),
    );

    addRewardTransactions({
      accumulator: rewardBreakdownById,
      reward,
      transactions: rewardTransactions,
    });
  });

  manualCategoryRewards.forEach((reward) => {
    const targetCategory = canonicalizeExpenseCategory(
      reward.category,
    ).toLowerCase();
    const rewardTransactions = claimTransactions(
      (transaction) =>
        canonicalizeExpenseCategory(
          transaction.display_category,
        ).toLowerCase() === targetCategory,
    );

    addRewardTransactions({
      accumulator: rewardBreakdownById,
      reward,
      transactions: rewardTransactions,
    });
  });

  if (baseRateReward) {
    const rewardTransactions = claimTransactions(() => true);

    addRewardTransactions({
      accumulator: rewardBreakdownById,
      reward: baseRateReward,
      transactions: rewardTransactions,
    });
  }

  return Array.from(rewardBreakdownById.values());
};

const computeEarningRewardTotals = ({ earningRewards, transactions }) =>
  computeEarningRewardBreakdown({ earningRewards, transactions }).map(
    ({ earning_reward_id, amount }) => ({
      earning_reward_id,
      amount,
    }),
  );

module.exports = {
  computeEarningRewardBreakdown,
  computeEarningRewardTotals,
  findMatchingEarningReward,
  getEarningRewardAmountForTransaction,
};
