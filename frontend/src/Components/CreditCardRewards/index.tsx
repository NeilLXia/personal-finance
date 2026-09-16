import { useEffect, useState } from "react";

import EditableChipSelect from "../shared/EditableChipSelect";
import SearchableChipSelect from "../shared/SearchableChipSelect";
import { formatCurrency, formatDate } from "../Dashboard/shared/formatters";
import styles from "./index.module.css";
import type {
  CreditCardEarningReward,
  CreditCardEarningRewardBreakdown,
  CreditCardEarningRewardTotal,
  CreditCardNewCardRecommendations,
  CreditCardRewardCardRecommendation,
  CreditCardRewardOptimization,
  CreditCardRewardOptimizationGroup,
  CreditCardPerkAward,
  CreditCardPerkCompletion,
  CreditCardRewardsAccount,
  CreditCardRewardsData,
  CreditCardType,
} from "./types";

type CreditCardRewardsPageProps = {
  data: CreditCardRewardsData | null;
  isLoading: boolean;
  isOptimizationLoading?: boolean;
  isUpdating: boolean;
  isUpdatingPerkCompletion: boolean;
  optimizationError?: unknown;
  optimizationData?: {
    optimization: CreditCardRewardOptimization;
    card_recommendations: CreditCardNewCardRecommendations;
  } | null;
  error: unknown;
  onBackToDashboard: () => void;
  onLoadOptimization?: () => void;
  onAccountTypeChange: (params: {
    accountId: number;
    creditCardTypeId: number | null;
    effectiveMonth: string | null;
  }) => void;
  onPerkCompletionChange: (params: {
    accountId: number;
    perkAwardId: number;
    occurrenceIndex: number;
    completed: boolean;
  }) => void;
};

const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const FREQUENCY_LABELS: Record<CreditCardPerkAward["frequency_period"], string> = {
  per_year: "per year",
  per_quarter: "per quarter",
  per_month: "per month",
};

const FREQUENCY_MULTIPLIERS: Record<
  CreditCardPerkAward["frequency_period"],
  number
> = {
  per_year: 1,
  per_quarter: 4,
  per_month: 12,
};

const trackerCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const getCurrentMonthValue = () => {
  const now = new Date();

  return String(now.getMonth() + 1).padStart(2, "0");
};

const getSelectedMonthValue = (selectedMonth: string | null | undefined) => {
  const month = String(selectedMonth || "").match(/^\d{4}-(\d{2})$/)?.[1];

  return month || getCurrentMonthValue();
};

const getBenefitCycleLabel = (
  effectiveMonth: string | null | undefined,
  selectedMonth: string | null | undefined,
) => {
  const selectedMatch = String(selectedMonth || "").match(/^(\d{4})-(\d{2})$/);
  const monthValue = effectiveMonth || getSelectedMonthValue(selectedMonth);
  const cycleMonthIndex = Number(monthValue) - 1;

  if (
    !selectedMatch ||
    !Number.isInteger(cycleMonthIndex) ||
    cycleMonthIndex < 0 ||
    cycleMonthIndex > 11
  ) {
    return MONTH_OPTIONS[cycleMonthIndex]?.label || "Benefit cycle";
  }

  const selectedYear = Number(selectedMatch[1]);
  const selectedMonthIndex = Number(selectedMatch[2]) - 1;
  const startYear =
    cycleMonthIndex <= selectedMonthIndex ? selectedYear : selectedYear - 1;
  const endMonthIndex = (cycleMonthIndex + 11) % 12;
  const endYear = startYear + (endMonthIndex < cycleMonthIndex ? 1 : 0);
  const startMonthLabel = MONTH_OPTIONS[cycleMonthIndex]?.label;
  const endMonthLabel = MONTH_OPTIONS[endMonthIndex]?.label;

  if (!startMonthLabel || !endMonthLabel) {
    return "Benefit cycle";
  }

  return `${startMonthLabel} ${startYear} - ${endMonthLabel} ${endYear}`;
};

const formatTrackerCurrency = (value: number) =>
  trackerCurrencyFormatter.format(value);

const formatRewardPercent = (value: number | string) => {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? String(numericValue) : "";
};

const formatPeriodLabel = (startDate?: string, endDate?: string) => {
  if (!startDate || !endDate) {
    return "Trailing year";
  }

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to load credit card rewards.";

const getEarningRewardAmount = (
  earningRewardTotals: CreditCardEarningRewardTotal[],
  rewardId: number,
) =>
  earningRewardTotals.find((total) => total.earning_reward_id === rewardId)
    ?.amount || 0;

const getEarningRewardBreakdown = (
  earningRewardBreakdowns: CreditCardEarningRewardBreakdown[] | undefined,
  rewardId: number,
) =>
  earningRewardBreakdowns?.find(
    (breakdown) => breakdown.earning_reward_id === rewardId,
  ) || {
    earning_reward_id: rewardId,
    amount: 0,
    transactions: [],
  };

const getCompletedEarningValue = (
  earningRewardTotals: CreditCardEarningRewardTotal[],
) =>
  earningRewardTotals.reduce(
    (total, rewardTotal) => total + rewardTotal.amount,
    0,
  );

const getEarningRewardExpenseValue = (
  earningRewardBreakdowns: CreditCardEarningRewardBreakdown[] | undefined,
) =>
  earningRewardBreakdowns?.reduce(
    (expenseTotal, breakdown) =>
      expenseTotal +
      breakdown.transactions.reduce(
        (transactionTotal, transaction) => transactionTotal + transaction.amount,
        0,
      ),
    0,
  ) || 0;

const EarningRewards = ({
  cardType,
  earningRewardBreakdowns,
  earningRewardTotals,
  onShowTransactions,
}: {
  cardType: CreditCardType;
  earningRewardBreakdowns?: CreditCardEarningRewardBreakdown[];
  earningRewardTotals: CreditCardEarningRewardTotal[];
  onShowTransactions: (params: {
    reward: CreditCardEarningReward;
    breakdown: CreditCardEarningRewardBreakdown;
  }) => void;
}) => {
  if (cardType.earning_rewards.length === 0) {
    return null;
  }

  return (
    <section className={styles.rewardSection}>
      <div className={styles.rewardList}>
        {cardType.earning_rewards.map((reward) => {
          const breakdown = getEarningRewardBreakdown(
            earningRewardBreakdowns,
            reward.id,
          );
          const isIncluded = !reward.status || reward.status === "included";

          return (
            <button
              className={`${styles.rewardRow} ${
                isIncluded ? "" : styles.rewardRowExcluded
              }`}
              disabled={!isIncluded}
              key={reward.id}
              type="button"
              onClick={() =>
                isIncluded && onShowTransactions({ reward, breakdown })
              }
            >
              <span>
                <span className={styles.rewardName}>{reward.category}</span>
                <span className={styles.rewardDetail}>
                  {isIncluded
                    ? `${formatRewardPercent(reward.reward_percent)}%`
                    : reward.status_reason || "Excluded from calculations"}
                </span>
              </span>
              <strong className={styles.rewardValue}>
                {formatCurrency(
                  getEarningRewardAmount(earningRewardTotals, reward.id),
                )}
              </strong>
            </button>
          );
        })}
      </div>
    </section>
  );
};

const getAnnualPerkOccurrenceCount = (award: CreditCardPerkAward) =>
  award.frequency_count * FREQUENCY_MULTIPLIERS[award.frequency_period];

const getPerkFrequencyText = (award: CreditCardPerkAward) =>
  `${award.frequency_count} ${FREQUENCY_LABELS[award.frequency_period]}`;

const getPerkCheckboxLabel = ({
  award,
  index,
  annualCount,
  effectiveMonth,
}: {
  award: CreditCardPerkAward;
  index: number;
  annualCount: number;
  effectiveMonth: string | null;
}) => {
  const cycleMonthIndex = effectiveMonth ? Number(effectiveMonth) - 1 : 0;
  const monthOffset = Math.floor(index / Math.max(award.frequency_count, 1));
  const quarter = monthOffset + 1;
  const occurrence = (index % Math.max(award.frequency_count, 1)) + 1;

  if (award.frequency_period === "per_quarter") {
    return `Q${quarter} ${occurrence}`;
  }

  if (award.frequency_period === "per_month") {
    const monthIndex = (cycleMonthIndex + monthOffset) % 12;
    const monthLabel = MONTH_OPTIONS[monthIndex]?.label.slice(0, 3);

    return award.frequency_count > 1
      ? `${monthLabel} ${occurrence}`
      : monthLabel;
  }

  return `${index + 1} of ${annualCount}`;
};

const getPerkOccurrenceDisplayItems = ({
  award,
  annualCount,
  effectiveMonth,
}: {
  award: CreditCardPerkAward;
  annualCount: number;
  effectiveMonth: string | null;
}) => {
  const occurrenceIndexes = Array.from(
    { length: annualCount },
    (_, occurrenceIndex) => occurrenceIndex,
  );

  if (award.frequency_period !== "per_month") {
    return occurrenceIndexes.map((occurrenceIndex) => ({
      occurrenceIndex,
      label: getPerkCheckboxLabel({
        award,
        index: occurrenceIndex,
        annualCount,
        effectiveMonth,
      }),
    }));
  }

  const cycleMonthIndex = effectiveMonth ? Number(effectiveMonth) - 1 : 0;
  const monthlyCount = Math.max(award.frequency_count, 1);

  return occurrenceIndexes
    .map((occurrenceIndex) => {
      const monthOffset = Math.floor(occurrenceIndex / monthlyCount);
      const calendarMonthIndex = (cycleMonthIndex + monthOffset) % 12;

      return {
        calendarMonthIndex,
        occurrenceIndex,
        label: getPerkCheckboxLabel({
          award,
          index: occurrenceIndex,
          annualCount,
          effectiveMonth,
        }),
      };
    })
    .sort(
      (left, right) =>
        left.calendarMonthIndex - right.calendarMonthIndex ||
        left.occurrenceIndex - right.occurrenceIndex,
    )
    .map(({ occurrenceIndex, label }) => ({ occurrenceIndex, label }));
};

const isPerkOccurrenceCompleted = ({
  award,
  perkCompletions,
  occurrenceIndex,
}: {
  award: CreditCardPerkAward;
  perkCompletions: CreditCardPerkCompletion[];
  occurrenceIndex: number;
}) =>
  award.auto_complete ||
  perkCompletions.some(
    (completion) =>
      completion.perk_award_id === award.id &&
      completion.occurrence_index === occurrenceIndex,
  );

const PerkAwards = ({
  cardType,
  effectiveMonth,
  perkCompletions,
  isUpdatingPerkCompletion,
  onTogglePerk,
}: {
  cardType: CreditCardType;
  effectiveMonth: string | null;
  perkCompletions: CreditCardPerkCompletion[];
  isUpdatingPerkCompletion: boolean;
  onTogglePerk: (params: {
    perkAwardId: number;
    occurrenceIndex: number;
    completed: boolean;
  }) => void;
}) => {
  if (cardType.perk_awards.length === 0) {
    return null;
  }

  return (
    <section className={styles.rewardSection}>
      <div className={styles.perkGrid}>
        {cardType.perk_awards.map((award) => {
          const isIncluded = !award.status || award.status === "included";
          const annualCount = getAnnualPerkOccurrenceCount(award);
          const valuePerCheckbox = award.dollar_value;

          if (annualCount === 1) {
            const isChecked = isPerkOccurrenceCompleted({
              award,
              perkCompletions,
              occurrenceIndex: 0,
            });

            return (
              <label
                className={`${styles.perkRowCompact} ${
                  isIncluded ? "" : styles.rewardRowExcluded
                }`}
                key={award.id}
              >
                <input
                  checked={isChecked}
                  disabled={
                    !isIncluded || award.auto_complete || isUpdatingPerkCompletion
                  }
                  type="checkbox"
                  onChange={() =>
                    onTogglePerk({
                      perkAwardId: award.id,
                      occurrenceIndex: 0,
                      completed: !isChecked,
                    })
                  }
                />
                <span className={styles.perkCompactText}>
                  <span className={styles.rewardName}>
                    {award.name}
                    {award.auto_complete && " (auto)"}
                  </span>
                  <span className={styles.rewardDetail}>
                    {isIncluded
                      ? getPerkFrequencyText(award)
                      : award.status_reason || "Excluded from calculations"}
                  </span>
                </span>
                <strong className={styles.rewardValue}>
                  {formatCurrency(award.dollar_value)}
                </strong>
              </label>
            );
          }

          return (
            <div className={styles.perkRow} key={award.id}>
              <div>
                <div className={styles.rewardName}>
                  {award.name}
                  {award.auto_complete && " (auto)"}
                </div>
                <div className={styles.rewardDetail}>
                  {isIncluded
                    ? `${getPerkFrequencyText(award)} - ${formatCurrency(
                        valuePerCheckbox,
                      )} each`
                    : award.status_reason || "Excluded from calculations"}
                </div>
              </div>
              <div className={styles.perkCheckboxGrid}>
                {getPerkOccurrenceDisplayItems({
                  award,
                  annualCount,
                  effectiveMonth,
                }).map(({ occurrenceIndex, label }) => {
                  const isChecked = isPerkOccurrenceCompleted({
                    award,
                    perkCompletions,
                    occurrenceIndex,
                  });

                  return (
                    <label
                      className={styles.perkCheckbox}
                      key={`${award.id}-${occurrenceIndex}`}
                    >
                      <input
                        checked={isChecked}
                        disabled={
                          !isIncluded ||
                          award.auto_complete ||
                          isUpdatingPerkCompletion
                        }
                        type="checkbox"
                        onChange={() =>
                          onTogglePerk({
                            perkAwardId: award.id,
                            occurrenceIndex,
                            completed: !isChecked,
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const getCompletedPerkValue = ({
  cardType,
  perkCompletions,
}: {
  cardType: CreditCardType;
  perkCompletions: CreditCardPerkCompletion[];
}) =>
  cardType.perk_awards.reduce((total, award) => {
    if (award.status && award.status !== "included") {
      return total;
    }

    if (award.auto_complete) {
      return total + award.dollar_value * getAnnualPerkOccurrenceCount(award);
    }

    const checkedCount = perkCompletions.filter(
      (completion) => completion.perk_award_id === award.id,
    ).length;

    return total + award.dollar_value * checkedCount;
  }, 0);

const AnnualFeeTracker = ({
  cardType,
  completedValue,
}: {
  cardType: CreditCardType;
  completedValue: number;
}) => {
  const progressPercent =
    cardType.annual_fee > 0
      ? Math.min((completedValue / cardType.annual_fee) * 100, 100)
      : 100;

  return (
    <section className={styles.annualFeeTracker}>
      <div className={styles.trackerHeader}>
        <div className={styles.rewardName}>Rewards earned</div>
        <strong className={styles.rewardValue}>
          {formatTrackerCurrency(completedValue)}/
          {formatTrackerCurrency(cardType.annual_fee)}
        </strong>
      </div>
      <div className={styles.trackerBar} aria-hidden="true">
        <div
          className={styles.trackerBarFill}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </section>
  );
};

const EarningRewardTransactionsModal = ({
  account,
  breakdown,
  reward,
  onClose,
}: {
  account: CreditCardRewardsAccount;
  breakdown: CreditCardEarningRewardBreakdown;
  reward: CreditCardEarningReward;
  onClose: () => void;
}) => {
  const spendTotal = breakdown.transactions.reduce(
    (total, transaction) => total + transaction.amount,
    0,
  );

  return (
    <div
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-labelledby="earning-transactions-title"
        aria-modal="true"
        className={`${styles.modalPanel} ${styles.transactionModalPanel}`}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 id="earning-transactions-title">{reward.category}</h2>
            <p>
              {account.credit_card_type?.name || "Credit card"} ·{" "}
              {account.institution_name || account.official_name || "Account"}
              {account.mask ? ` · **** ${account.mask}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className={styles.transactionSummary}>
          <div>
            <span>Transactions</span>
            <strong>{breakdown.transactions.length}</strong>
          </div>
          <div>
            <span>Spend</span>
            <strong>{formatCurrency(spendTotal)}</strong>
          </div>
          <div>
            <span>Rewards</span>
            <strong>{formatCurrency(breakdown.amount)}</strong>
          </div>
        </div>

        {breakdown.transactions.length === 0 ? (
          <p className={styles.emptyText}>
            No transactions matched this earning category.
          </p>
        ) : (
          <div className={styles.transactionList}>
            {breakdown.transactions.map((transaction) => (
              <div className={styles.transactionRow} key={transaction.id}>
                <div className={styles.transactionMain}>
                  <strong>{transaction.merchant_name || transaction.name}</strong>
                  {transaction.merchant_name && (
                    <span>{transaction.name}</span>
                  )}
                </div>
                <div className={styles.transactionMeta}>
                  <span>{formatDate(transaction.manual_date || transaction.date)}</span>
                  <span>
                    {transaction.display_category ||
                      transaction.manual_category ||
                      transaction.category ||
                      "Uncategorized"}
                  </span>
                </div>
                <strong className={styles.transactionAmount}>
                  {formatCurrency(transaction.amount)}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const getRewardsSummary = (data: CreditCardRewardsData | null) => {
  if (!data) {
    return {
      earningRewards: 0,
      earningRewardExpenses: 0,
      perkRewards: 0,
      annualFees: 0,
    };
  }

  return data.accounts.reduce(
    (summary, account) => {
      const cardType = account.credit_card_type;

      if (!cardType) {
        return summary;
      }

      return {
        earningRewards:
          summary.earningRewards +
          getCompletedEarningValue(account.earning_reward_totals),
        earningRewardExpenses:
          summary.earningRewardExpenses +
          getEarningRewardExpenseValue(account.earning_reward_breakdowns),
        perkRewards:
          summary.perkRewards +
          getCompletedPerkValue({
            cardType,
            perkCompletions: account.perk_completions,
          }),
        annualFees: summary.annualFees + cardType.annual_fee,
      };
    },
    {
      earningRewards: 0,
      earningRewardExpenses: 0,
      perkRewards: 0,
      annualFees: 0,
    },
  );
};

const RewardsSummary = ({
  data,
  isLoading,
  onOptimize,
}: {
  data: CreditCardRewardsData | null;
  isLoading: boolean;
  onOptimize: () => void;
}) => {
  const summary = getRewardsSummary(data);

  return (
    <section className={styles.summarySection}>
      <div className={styles.summaryMetrics}>
        <div className={styles.summaryCard}>
          <span>Credit Card Expenses</span>
          <strong>{formatCurrency(summary.earningRewardExpenses)}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Earnings rewards</span>
          <strong>{formatCurrency(summary.earningRewards)}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Perks</span>
          <strong>{formatCurrency(summary.perkRewards)}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Annual fees</span>
          <strong>{formatCurrency(summary.annualFees)}</strong>
        </div>
      </div>
      <div className={styles.summaryActions}>
        <button
          className={styles.secondaryButton}
          disabled={isLoading || !data}
          type="button"
          onClick={onOptimize}
        >
          Optimize my earnings
        </button>
      </div>
    </section>
  );
};

const OptimizationTransactionsModal = ({
  group,
  onClose,
}: {
  group: CreditCardRewardOptimizationGroup;
  onClose: () => void;
}) => (
  <div
    className={styles.modalBackdrop}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}
  >
    <div
      aria-labelledby="optimization-transactions-title"
      aria-modal="true"
      className={`${styles.modalPanel} ${styles.transactionModalPanel}`}
      role="dialog"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className={styles.modalHeader}>
        <div>
          <h2 id="optimization-transactions-title">{group.group_label}</h2>
          <p>
            Use {group.recommended_card_name} instead of {group.actual_card_name}
          </p>
        </div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.transactionSummary}>
        <div>
          <span>Missed</span>
          <strong>{formatCurrency(group.missed_reward_value)}</strong>
        </div>
        <div>
          <span>Transactions</span>
          <strong>{group.transaction_count}</strong>
        </div>
        <div>
          <span>Spend</span>
          <strong>{formatCurrency(group.total_spend)}</strong>
        </div>
      </div>

      <div className={styles.transactionList}>
        {group.transactions.map((finding) => (
          <div
            className={styles.optimizationTransactionRow}
            key={finding.transaction.id}
          >
            <div className={styles.transactionMain}>
              <strong>
                {finding.transaction.merchant_name || finding.transaction.name}
              </strong>
              {finding.transaction.merchant_name && (
                <span>{finding.transaction.name}</span>
              )}
              <span>{finding.transaction.account_label}</span>
            </div>
            <div className={styles.optimizationCardComparison}>
              <span>
                Used {finding.actual_card_name}
                {finding.actual_reward_category
                  ? ` (${finding.actual_reward_category}, ${formatRewardPercent(
                      finding.actual_reward_percent,
                    )}%)`
                  : ""}
              </span>
              <strong>
                Use {finding.recommended_card_name}
                {finding.recommended_reward_category
                  ? ` (${finding.recommended_reward_category}, ${formatRewardPercent(
                      finding.recommended_reward_percent,
                    )}%)`
                  : ""}
              </strong>
            </div>
            <div className={styles.transactionMeta}>
              <span>
                {formatDate(
                  finding.transaction.manual_date || finding.transaction.date,
                )}
              </span>
              <span>
                {finding.transaction.display_category ||
                  finding.transaction.manual_category ||
                  finding.transaction.category ||
                  "Uncategorized"}
              </span>
            </div>
            <div className={styles.optimizationAmounts}>
              <strong>{formatCurrency(finding.missed_reward_value)}</strong>
              <span>{formatCurrency(finding.transaction.amount)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const RewardsOptimizationContent = ({
  optimization,
  onSelectGroup,
}: {
  optimization?: CreditCardRewardOptimization;
  onSelectGroup: (group: CreditCardRewardOptimizationGroup) => void;
}) => {
  if (!optimization) {
    return null;
  }

  const groups = optimization.recommendation_groups.slice(0, 12);

  return (
    <div className={styles.optimizationTabPanel}>
      <div className={styles.optimizationHeader}>
        <div>
          <h2>Owned card optimization</h2>
          <p>{formatPeriodLabel(optimization.period_start, optimization.period_end)}</p>
        </div>
        <div className={styles.optimizationTotal}>
          <span>Missed rewards</span>
          <strong>{formatCurrency(optimization.missed_reward_value)}</strong>
        </div>
      </div>

      <div className={styles.optimizationSummary}>
        <div>
          <span>Actual</span>
          <strong>{formatCurrency(optimization.actual_reward_value)}</strong>
        </div>
        <div>
          <span>Optimized</span>
          <strong>{formatCurrency(optimization.optimized_reward_value)}</strong>
        </div>
      </div>

      {groups.length > 0 && (
        <div className={styles.optimizationList}>
          {groups.map((group) => (
            <button
              className={styles.optimizationCard}
              key={`${group.group_type}-${group.group_label}-${group.actual_card_type_id}-${group.recommended_card_type_id}`}
              type="button"
              onClick={() => onSelectGroup(group)}
            >
              <div className={styles.optimizationCardHeader}>
                <span>{group.group_type}</span>
                <strong>{formatCurrency(group.missed_reward_value)}</strong>
              </div>
              <div>
                <h3>{group.group_label}</h3>
                <p>
                  Use {group.recommended_card_name} instead of{" "}
                  {group.actual_card_name}
                </p>
              </div>
              <div className={styles.optimizationCardMeta}>
                <span>{group.transaction_count} transactions</span>
                <span>{formatCurrency(group.total_spend)} spend</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CardRecommendationTransactionsModal = ({
  recommendation,
  onClose,
}: {
  recommendation: CreditCardRewardCardRecommendation;
  onClose: () => void;
}) => (
  <div
    className={styles.modalBackdrop}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}
  >
    <div
      aria-labelledby="card-recommendation-transactions-title"
      aria-modal="true"
      className={`${styles.modalPanel} ${styles.transactionModalPanel}`}
      role="dialog"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className={styles.modalHeader}>
        <div>
          <h2 id="card-recommendation-transactions-title">
            {recommendation.card_type_name}
          </h2>
          <p>Spend that would earn more on this card than what you have today.</p>
        </div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.transactionSummary}>
        <div>
          <span>Extra earnings</span>
          <strong>{formatCurrency(recommendation.additional_reward_value)}</strong>
        </div>
        <div>
          <span>Transactions</span>
          <strong>{recommendation.transaction_count}</strong>
        </div>
        <div>
          <span>Applicable spend</span>
          <strong>{formatCurrency(recommendation.total_spend)}</strong>
        </div>
      </div>

      <div className={styles.transactionList}>
        {recommendation.transactions.map((finding) => (
          <div
            className={styles.optimizationTransactionRow}
            key={finding.transaction.id}
          >
            <div className={styles.transactionMain}>
              <strong>
                {finding.transaction.merchant_name || finding.transaction.name}
              </strong>
              {finding.transaction.merchant_name && (
                <span>{finding.transaction.name}</span>
              )}
              <span>{finding.transaction.account_label}</span>
            </div>
            <div className={styles.optimizationCardComparison}>
              <span>
                {finding.baseline_card_name
                  ? `Best today: ${finding.baseline_card_name}`
                  : "No card earns on this today"}
              </span>
              <strong>
                Use {recommendation.card_type_name}
                {finding.candidate_reward_category
                  ? ` (${finding.candidate_reward_category}, ${formatRewardPercent(
                      finding.candidate_reward_percent,
                    )}%)`
                  : ""}
              </strong>
            </div>
            <div className={styles.transactionMeta}>
              <span>
                {formatDate(
                  finding.transaction.manual_date || finding.transaction.date,
                )}
              </span>
              <span>
                {finding.transaction.display_category ||
                  finding.transaction.manual_category ||
                  finding.transaction.category ||
                  "Uncategorized"}
              </span>
            </div>
            <div className={styles.optimizationAmounts}>
              <strong>{formatCurrency(finding.additional_reward_value)}</strong>
              <span>{formatCurrency(finding.transaction.amount)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const formatRecommendationCategoryLabel = (
  category: CreditCardRewardCardRecommendation["category_breakdown"][number],
) =>
  `${category.category} - multiplier ${formatRewardPercent(
    category.candidate_reward_percent,
  )}x`;

const formatRecommendationCategoryEarnings = (
  category: CreditCardRewardCardRecommendation["category_breakdown"][number],
) =>
  `+${formatCurrency(
    category.additional_reward_value,
  )} (earning ${formatCurrency(
    category.current_reward_value,
  )}, expected ${formatCurrency(category.expected_reward_value)})`;

const CardRecommendationsContent = ({
  cardRecommendations,
  onSelectRecommendation,
}: {
  cardRecommendations?: CreditCardNewCardRecommendations;
  onSelectRecommendation: (recommendation: CreditCardRewardCardRecommendation) => void;
}) => {
  if (!cardRecommendations) {
    return (
      <div className={styles.optimizationTabPanel}>
        <div className={styles.optimizationHeader}>
          <div>
            <h2>Card to consider</h2>
            <p>Recommendations are not available yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const recommendations = cardRecommendations.recommendations.slice(0, 3);

  return (
    <div className={styles.optimizationTabPanel}>
      <div className={styles.optimizationHeader}>
        <div>
          <h2>Card to consider</h2>
          <p>
            {formatPeriodLabel(
              cardRecommendations.period_start,
              cardRecommendations.period_end,
            )}
          </p>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <p className={styles.emptyText}>No higher-earning cards found.</p>
      ) : (
        <div className={styles.recommendationGrid}>
          {recommendations.map((recommendation) => (
          <button
            className={styles.optimizationCard}
            key={recommendation.card_type_id}
            type="button"
            onClick={() => onSelectRecommendation(recommendation)}
          >
            <div className={styles.optimizationCardHeader}>
              <span>
                {recommendation.annual_fee > 0
                  ? `${formatCurrency(recommendation.annual_fee)} annual fee`
                  : "No annual fee"}
              </span>
              <strong>
                +{formatCurrency(recommendation.net_annual_value)}
              </strong>
            </div>
            <div>
              <h3>{recommendation.card_type_name}</h3>
            </div>
            <div className={styles.optimizationCardMeta}>
              <span>{recommendation.transaction_count} transactions</span>
              <span>{formatCurrency(recommendation.total_spend)} applicable spend</span>
            </div>
            {recommendation.category_breakdown.length > 0 && (
              <div className={styles.recommendationBreakdown}>
                {recommendation.category_breakdown.slice(0, 4).map((category) => (
                  <div
                    className={styles.recommendationBreakdownRow}
                    key={`${recommendation.card_type_id}-${category.category}-${category.candidate_reward_category}-${category.candidate_reward_percent}`}
                  >
                    <span>{formatRecommendationCategoryLabel(category)}</span>
                    <strong>
                      {formatRecommendationCategoryEarnings(category)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </button>
          ))}
        </div>
      )}
    </div>
  );
};

const RewardsOptimizationModal = ({
  cardRecommendations,
  error,
  isLoading,
  optimization,
  onClose,
  onSelectGroup,
  onSelectRecommendation,
}: {
  cardRecommendations?: CreditCardNewCardRecommendations;
  error?: unknown;
  isLoading?: boolean;
  optimization?: CreditCardRewardOptimization;
  onClose: () => void;
  onSelectGroup: (group: CreditCardRewardOptimizationGroup) => void;
  onSelectRecommendation: (recommendation: CreditCardRewardCardRecommendation) => void;
}) => {
  const [activeTab, setActiveTab] = useState<"owned" | "new">("owned");

  return (
    <div
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-labelledby="rewards-optimization-title"
        aria-modal="true"
        className={`${styles.modalPanel} ${styles.optimizationModalPanel}`}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 id="rewards-optimization-title">Optimize my earnings</h2>
            <p>Trailing-year recommendations based on earning rates only.</p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className={styles.optimizationModalLayout}>
          <div className={styles.optimizationTabList} role="tablist">
            <button
              className={activeTab === "owned" ? styles.optimizationTabActive : ""}
              role="tab"
              type="button"
              aria-selected={activeTab === "owned"}
              onClick={() => setActiveTab("owned")}
            >
              Owned cards
            </button>
            <button
              className={activeTab === "new" ? styles.optimizationTabActive : ""}
              role="tab"
              type="button"
              aria-selected={activeTab === "new"}
              onClick={() => setActiveTab("new")}
            >
              New cards
            </button>
          </div>

          <div className={styles.optimizationModalContent}>
            {isLoading ? (
              <div className={styles.optimizationLoadingState}>
                <p className={styles.statusText}>Analyzing rewards activity.</p>
              </div>
            ) : error ? (
              <div className={styles.optimizationLoadingState}>
                <p className={styles.statusText}>{getErrorMessage(error)}</p>
              </div>
            ) : (
              <>
                {activeTab === "owned" ? (
                  <RewardsOptimizationContent
                    optimization={optimization}
                    onSelectGroup={onSelectGroup}
                  />
                ) : (
                  <CardRecommendationsContent
                    cardRecommendations={cardRecommendations}
                    onSelectRecommendation={onSelectRecommendation}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AccountTile = ({
  account,
  cardTypes,
  selectedMonth,
  isExpanded,
  isUpdating,
  isUpdatingPerkCompletion,
  onToggleExpand,
  onAccountTypeChange,
  onShowEarningTransactions,
  onPerkCompletionChange,
}: {
  account: CreditCardRewardsAccount;
  cardTypes: CreditCardType[];
  selectedMonth: string;
  isExpanded: boolean;
  isUpdating: boolean;
  isUpdatingPerkCompletion: boolean;
  onToggleExpand: () => void;
  onAccountTypeChange: CreditCardRewardsPageProps["onAccountTypeChange"];
  onShowEarningTransactions: (params: {
    account: CreditCardRewardsAccount;
    reward: CreditCardEarningReward;
    breakdown: CreditCardEarningRewardBreakdown;
  }) => void;
  onPerkCompletionChange: CreditCardRewardsPageProps["onPerkCompletionChange"];
}) => {
  const cardType = account.credit_card_type;
  const [pendingEffectiveMonth, setPendingEffectiveMonth] = useState<
    string | null
  >(null);
  const defaultEffectiveMonth = getSelectedMonthValue(selectedMonth);
  const effectiveMonthValue =
    pendingEffectiveMonth || account.effective_month || defaultEffectiveMonth;

  useEffect(() => {
    setPendingEffectiveMonth(null);
  }, [account.id, account.effective_month]);

  const completedValue = cardType
    ? getCompletedPerkValue({
        cardType,
        perkCompletions: account.perk_completions,
      }) + getCompletedEarningValue(account.earning_reward_totals)
    : 0;
  const tracker = cardType ? (
    <AnnualFeeTracker cardType={cardType} completedValue={completedValue} />
  ) : (
    <div className={styles.emptyTracker}>
      <div className={styles.rewardName}>Rewards earned</div>
      <div className={styles.rewardDetail}>No card selected</div>
    </div>
  );
  const controls = (
    <div className={styles.accountExpandedControls}>
      <div className={styles.typeSelector}>
        <span>Card type</span>
        <SearchableChipSelect
          aria-label={`Card type for ${account.name}`}
          disabled={isUpdating}
          options={cardTypes.map((type) => ({
            value: String(type.id),
            label: type.name,
          })).filter((option) => {
            const cardTypeOption = cardTypes.find(
              (type) => String(type.id) === option.value,
            );

            return cardTypeOption?.status !== "in_review";
          })}
          placeholder="Choose card type"
          value={account.credit_card_type_id?.toString() || ""}
          onChange={(value) => {
            const creditCardTypeId = value ? Number(value) : null;

            onAccountTypeChange({
              accountId: account.id,
              creditCardTypeId,
              effectiveMonth: creditCardTypeId
                ? account.effective_month || defaultEffectiveMonth
                : null,
            });
          }}
        />
      </div>
      {account.credit_card_type_id && (
        <div className={styles.typeSelector}>
          <span>Benefit cycle</span>
          <EditableChipSelect
            aria-label={`Benefit cycle for ${account.name}`}
            disabled={isUpdating}
            options={MONTH_OPTIONS}
            placeholder="Benefit cycle"
            value={effectiveMonthValue}
            getDisplayLabel={() =>
              getBenefitCycleLabel(effectiveMonthValue, selectedMonth)
            }
            showPlaceholderOption={false}
            onChange={(value) => {
              const nextEffectiveMonth = value || defaultEffectiveMonth;

              setPendingEffectiveMonth(nextEffectiveMonth);
              onAccountTypeChange({
                accountId: account.id,
                creditCardTypeId: account.credit_card_type_id,
                effectiveMonth: nextEffectiveMonth,
              });
            }}
          />
        </div>
      )}
    </div>
  );
  const rewards = cardType ? (
    <>
      <EarningRewards
        cardType={cardType}
        earningRewardBreakdowns={account.earning_reward_breakdowns}
        earningRewardTotals={account.earning_reward_totals}
        onShowTransactions={({ reward, breakdown }) =>
          onShowEarningTransactions({ account, reward, breakdown })
        }
      />
      <PerkAwards
        cardType={cardType}
        effectiveMonth={effectiveMonthValue}
        isUpdatingPerkCompletion={isUpdatingPerkCompletion}
        perkCompletions={account.perk_completions}
        onTogglePerk={({ perkAwardId, occurrenceIndex, completed }) =>
          onPerkCompletionChange({
            accountId: account.id,
            perkAwardId,
            occurrenceIndex,
            completed,
          })
        }
      />
    </>
  ) : (
    <p className={styles.rewardDetail}>
      Select a card type to show earning rewards and perks.
    </p>
  );

  return (
    <article
      className={`${styles.accountTile} ${
        isExpanded ? styles.accountTileExpanded : ""
      }`}
    >
      {isExpanded ? (
        <div className={styles.accountTileExpandedLayout}>
          <div className={styles.accountInfoColumn}>
            <button
              aria-expanded={isExpanded}
              aria-label={`Card details for ${cardType?.name || account.name}`}
              className={styles.accountTileHeader}
              type="button"
              onClick={onToggleExpand}
            >
              <div className={styles.accountIdentity}>
                <h2>{cardType?.name || "Choose a card type"}</h2>
                <div className={styles.accountMeta}>
                  <span>
                    {account.institution_name ||
                      account.official_name ||
                      "Credit card"}
                  </span>
                  {account.mask && <span>**** {account.mask}</span>}
                </div>
              </div>
              <span aria-hidden="true" className={styles.expandIcon}>
                ▲
              </span>
            </button>
            {controls}
          </div>
          <div className={styles.accountExpandedRewards}>
            {tracker}
            {rewards}
          </div>
        </div>
      ) : (
        <div className={styles.accountTileSummary}>
          <button
            aria-expanded={isExpanded}
            aria-label={`Card details for ${cardType?.name || account.name}`}
            className={styles.accountTileHeader}
            type="button"
            onClick={onToggleExpand}
          >
            <div className={styles.accountIdentity}>
              <h2>{cardType?.name || "Choose a card type"}</h2>
              <div className={styles.accountMeta}>
                <span>
                  {account.institution_name ||
                    account.official_name ||
                    "Credit card"}
                </span>
                {account.mask && <span>**** {account.mask}</span>}
              </div>
            </div>
            <span aria-hidden="true" className={styles.expandIcon}>
              ▼
            </span>
          </button>
          {tracker}
        </div>
      )}
    </article>
  );
};

const CreditCardRewardsPage = ({
  data,
  isLoading,
  isOptimizationLoading = false,
  isUpdating,
  isUpdatingPerkCompletion,
  optimizationData = null,
  optimizationError,
  error,
  onBackToDashboard,
  onLoadOptimization,
  onAccountTypeChange,
  onPerkCompletionChange,
}: CreditCardRewardsPageProps) => {
  const [isOptimizationModalOpen, setIsOptimizationModalOpen] = useState(false);
  const [expandedAccountId, setExpandedAccountId] = useState<number | null>(
    null,
  );
  const [selectedEarningTransactions, setSelectedEarningTransactions] =
    useState<{
      account: CreditCardRewardsAccount;
      reward: CreditCardEarningReward;
      breakdown: CreditCardEarningRewardBreakdown;
    } | null>(null);
  const [selectedOptimizationGroup, setSelectedOptimizationGroup] =
    useState<CreditCardRewardOptimizationGroup | null>(null);
  const [selectedCardRecommendation, setSelectedCardRecommendation] =
    useState<CreditCardRewardCardRecommendation | null>(null);

  return (
    <section className={styles.rewardsPage}>
      <header className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <h1>Credit card rewards</h1>
          <p>Assign card products to credit accounts and review configured benefits.</p>
        </div>
        <div className={styles.pageActions}>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={onBackToDashboard}
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <RewardsSummary
        data={data}
        isLoading={isLoading}
        onOptimize={() => {
          setIsOptimizationModalOpen(true);
          onLoadOptimization?.();
        }}
      />

      {isLoading ? (
        <p className={styles.statusText}>Loading credit card rewards.</p>
      ) : error ? (
        <p className={styles.statusText}>{getErrorMessage(error)}</p>
      ) : !data || data.accounts.length === 0 ? (
        <p className={styles.emptyText}>No credit card accounts found.</p>
      ) : (
        <>
          <div className={styles.accountGrid}>
            {data.accounts.map((account) => (
              <AccountTile
                account={account}
                cardTypes={data.card_types}
                selectedMonth={data.selected_month}
                isExpanded={expandedAccountId === account.id}
                isUpdating={isUpdating}
                isUpdatingPerkCompletion={isUpdatingPerkCompletion}
                key={account.id}
                onAccountTypeChange={onAccountTypeChange}
                onPerkCompletionChange={onPerkCompletionChange}
                onShowEarningTransactions={setSelectedEarningTransactions}
                onToggleExpand={() =>
                  setExpandedAccountId((current) =>
                    current === account.id ? null : account.id,
                  )
                }
              />
            ))}
          </div>
        </>
      )}

      {isOptimizationModalOpen && (
        <RewardsOptimizationModal
          cardRecommendations={optimizationData?.card_recommendations}
          error={optimizationError}
          isLoading={isOptimizationLoading}
          optimization={optimizationData?.optimization}
          onClose={() => setIsOptimizationModalOpen(false)}
          onSelectGroup={setSelectedOptimizationGroup}
          onSelectRecommendation={setSelectedCardRecommendation}
        />
      )}

      {selectedEarningTransactions && (
        <EarningRewardTransactionsModal
          account={selectedEarningTransactions.account}
          breakdown={selectedEarningTransactions.breakdown}
          reward={selectedEarningTransactions.reward}
          onClose={() => setSelectedEarningTransactions(null)}
        />
      )}

      {selectedOptimizationGroup && (
        <OptimizationTransactionsModal
          group={selectedOptimizationGroup}
          onClose={() => setSelectedOptimizationGroup(null)}
        />
      )}

      {selectedCardRecommendation && (
        <CardRecommendationTransactionsModal
          recommendation={selectedCardRecommendation}
          onClose={() => setSelectedCardRecommendation(null)}
        />
      )}
    </section>
  );
};

export default CreditCardRewardsPage;
