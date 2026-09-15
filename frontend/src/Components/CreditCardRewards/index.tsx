import { useState } from "react";
import type { FormEvent } from "react";

import EditableChipSelect from "../shared/EditableChipSelect";
import SearchableChipSelect from "../shared/SearchableChipSelect";
import { manualExpenseCategories } from "../Dashboard/shared/constants";
import { formatCurrency, formatDate } from "../Dashboard/shared/formatters";
import styles from "./index.module.css";
import type {
  CreateCreditCardTypeInput,
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
  isCreatingCardType: boolean;
  isDeletingCardType: boolean;
  isCardTypeManager: boolean;
  isUpdating: boolean;
  isUpdatingCardType: boolean;
  isUpdatingPerkCompletion: boolean;
  error: unknown;
  onBackToDashboard: () => void;
  onCreateCardType: (input: CreateCreditCardTypeInput) => Promise<unknown>;
  onUpdateCardType: (params: {
    cardTypeId: number;
    input: CreateCreditCardTypeInput;
  }) => Promise<unknown>;
  onDeleteCardType: (cardTypeId: number) => Promise<unknown>;
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

const CUSTOM_CATEGORY_VALUE = "__custom_category__";

const EARNING_REWARD_CATEGORY_OPTIONS = [
  "Base rate",
  ...manualExpenseCategories,
];

type EarningRewardFormRow = {
  id: string;
  dbId?: number;
  categorySelection: string;
  customDisplayName: string;
  customKeywords: string;
  rewardPercent: string;
};

type PerkAwardFormRow = {
  id: string;
  dbId?: number;
  name: string;
  dollarValue: string;
  frequencyCount: string;
  frequencyPeriod: CreditCardPerkAward["frequency_period"];
  autoComplete: boolean;
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

const FREQUENCY_LIMITS: Record<CreditCardPerkAward["frequency_period"], number> = {
  per_year: 24,
  per_quarter: 6,
  per_month: 2,
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

const createLocalId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

const getCurrentMonthValue = () => {
  const now = new Date();

  return String(now.getMonth() + 1).padStart(2, "0");
};

const createEarningRewardRow = (): EarningRewardFormRow => ({
  id: createLocalId(),
  categorySelection: "",
  customDisplayName: "",
  customKeywords: "",
  rewardPercent: "",
});

const createPerkAwardRow = (): PerkAwardFormRow => ({
  id: createLocalId(),
  name: "",
  dollarValue: "",
  frequencyCount: "1",
  frequencyPeriod: "per_year",
  autoComplete: false,
});

const createBaseRateRow = (): EarningRewardFormRow => ({
  id: createLocalId(),
  categorySelection: "Base rate",
  customDisplayName: "",
  customKeywords: "",
  rewardPercent: "",
});

const toNumberValue = (value: string) =>
  Number(value.replace(/[^\d.]/g, "") || 0);

const formatDollarInput = (value: string) => {
  const normalized = value.replace(/[^\d.]/g, "");
  const [wholeValue, decimalValue] = normalized.split(".");
  const whole = wholeValue.replace(/^0+(?=\d)/, "");
  const formattedWhole = whole
    ? Number(whole).toLocaleString("en-US")
    : wholeValue === "0"
      ? "0"
      : "";

  if (decimalValue !== undefined) {
    return formattedWhole ? `$${formattedWhole}.${decimalValue.slice(0, 2)}` : "";
  }

  return formattedWhole ? `$${formattedWhole}` : "";
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

          return (
            <button
              className={styles.rewardRow}
              key={reward.id}
              type="button"
              onClick={() => onShowTransactions({ reward, breakdown })}
            >
              <span>
                <span className={styles.rewardName}>{reward.category}</span>
                <span className={styles.rewardDetail}>
                  {formatRewardPercent(reward.reward_percent)}%
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
          const annualCount = getAnnualPerkOccurrenceCount(award);
          const valuePerCheckbox = award.dollar_value;

          if (annualCount === 1) {
            const isChecked = isPerkOccurrenceCompleted({
              award,
              perkCompletions,
              occurrenceIndex: 0,
            });

            return (
              <label className={styles.perkRowCompact} key={award.id}>
                <input
                  checked={isChecked}
                  disabled={award.auto_complete || isUpdatingPerkCompletion}
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
                    {getPerkFrequencyText(award)}
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
                  {getPerkFrequencyText(award)} -{" "}
                  {formatCurrency(valuePerCheckbox)} each
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
                        disabled={award.auto_complete || isUpdatingPerkCompletion}
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

const buildEarningRewardRow = (
  reward: CreditCardEarningReward,
): EarningRewardFormRow => ({
  id: createLocalId(),
  dbId: reward.id,
  categorySelection: reward.keywords ? CUSTOM_CATEGORY_VALUE : reward.category,
  customDisplayName: reward.keywords ? reward.category : "",
  customKeywords: reward.keywords || "",
  rewardPercent: formatRewardPercent(reward.reward_percent),
});

const buildPerkAwardRow = (award: CreditCardPerkAward): PerkAwardFormRow => ({
  id: createLocalId(),
  dbId: award.id,
  name: award.name,
  dollarValue: String(award.dollar_value),
  frequencyCount: String(award.frequency_count),
  frequencyPeriod: award.frequency_period,
  autoComplete: award.auto_complete,
});

const ManageCardTypesModal = ({
  cardTypes,
  isDeleting,
  isSaving,
  onClose,
  onCreateCardType,
  onUpdateCardType,
  onDeleteCardType,
}: {
  cardTypes: CreditCardType[];
  isDeleting: boolean;
  isSaving: boolean;
  onClose: () => void;
  onCreateCardType: CreditCardRewardsPageProps["onCreateCardType"];
  onUpdateCardType: CreditCardRewardsPageProps["onUpdateCardType"];
  onDeleteCardType: CreditCardRewardsPageProps["onDeleteCardType"];
}) => {
  const [selectedCardTypeId, setSelectedCardTypeId] = useState<number | null>(
    null,
  );
  const [name, setName] = useState("");
  const [annualFee, setAnnualFee] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [earningRewards, setEarningRewards] = useState<EarningRewardFormRow[]>(
    [createBaseRateRow()],
  );
  const [perkAwards, setPerkAwards] = useState<PerkAwardFormRow[]>([]);

  const selectCardType = (cardTypeId: number | null) => {
    setSelectedCardTypeId(cardTypeId);
    setFormError(null);

    const cardType = cardTypeId
      ? cardTypes.find((type) => type.id === cardTypeId) || null
      : null;

    if (!cardType) {
      setName("");
      setAnnualFee("");
      setEarningRewards([createBaseRateRow()]);
      setPerkAwards([]);
      return;
    }

    setName(cardType.name);
    setAnnualFee(formatDollarInput(String(cardType.annual_fee)));
    setEarningRewards(
      cardType.earning_rewards.length > 0
        ? cardType.earning_rewards.map(buildEarningRewardRow)
        : [createBaseRateRow()],
    );
    setPerkAwards(cardType.perk_awards.map(buildPerkAwardRow));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const input: CreateCreditCardTypeInput = {
      name: name.trim(),
      annual_fee: toNumberValue(annualFee),
      earning_rewards: earningRewards
        .filter((reward) =>
          reward.categorySelection === CUSTOM_CATEGORY_VALUE
            ? reward.customDisplayName.trim()
            : reward.categorySelection,
        )
        .map((reward) => {
          const isCustom = reward.categorySelection === CUSTOM_CATEGORY_VALUE;

          return {
            id: reward.dbId,
            category: isCustom
              ? reward.customDisplayName.trim()
              : reward.categorySelection,
            keywords: isCustom ? reward.customKeywords.trim() || null : null,
            reward_percent: toNumberValue(reward.rewardPercent),
          };
        }),
      perk_awards: perkAwards
        .filter((award) => award.name.trim())
        .map((award) => ({
          id: award.dbId,
          name: award.name.trim(),
          dollar_value: toNumberValue(award.dollarValue),
          frequency_count: Math.max(1, Number(award.frequencyCount || 1)),
          frequency_period: award.frequencyPeriod,
          auto_complete: award.autoComplete,
        })),
    };

    try {
      if (selectedCardTypeId) {
        await onUpdateCardType({ cardTypeId: selectedCardTypeId, input });
      } else {
        await onCreateCardType(input);
      }

      onClose();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  const handleDelete = async () => {
    if (!selectedCardTypeId) {
      return;
    }

    const cardType = cardTypes.find((type) => type.id === selectedCardTypeId);

    if (
      !window.confirm(
        `Delete ${cardType?.name || "this card type"}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setFormError(null);

    try {
      await onDeleteCardType(selectedCardTypeId);
      onClose();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  const updateEarningReward = (
    rowId: string,
    patch: Partial<EarningRewardFormRow>,
  ) => {
    setEarningRewards((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  };

  const updatePerkAward = (rowId: string, patch: Partial<PerkAwardFormRow>) => {
    setPerkAwards((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  };

  return (
    <div className={styles.modalBackdrop}>
      <div
        aria-labelledby="manage-card-types-title"
        aria-modal="true"
        className={styles.modalPanel}
        role="dialog"
      >
        <div className={styles.modalHeader}>
          <h2 id="manage-card-types-title">Manage card types</h2>
          <button disabled={isSaving} type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <form className={styles.cardTypeForm} onSubmit={submit}>
          {formError && <p className={styles.formError}>{formError}</p>}

          <label className={styles.field}>
            <span>Card type to edit</span>
            <SearchableChipSelect
              aria-label="Card type to edit"
              disabled={isSaving}
              options={cardTypes.map((type) => ({
                value: String(type.id),
                label: type.name,
              }))}
              placeholder="New card type"
              value={selectedCardTypeId?.toString() || ""}
              onChange={(value) => selectCardType(value ? Number(value) : null)}
            />
          </label>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Credit card type</span>
              <input
                required
                maxLength={120}
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Annual fee</span>
              <input
                required
                inputMode="decimal"
                type="text"
                value={annualFee}
                onChange={(event) =>
                  setAnnualFee(formatDollarInput(event.target.value))
                }
              />
            </label>
          </div>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeader}>
              <h3>Earning rates</h3>
              <button
                type="button"
                onClick={() =>
                  setEarningRewards((rows) => [
                    ...rows,
                    createEarningRewardRow(),
                  ])
                }
              >
                Add earning rate
              </button>
            </div>
            {earningRewards.length === 0 ? (
              <p className={styles.formEmptyText}>No earning rates added.</p>
            ) : (
              <div className={styles.benefitRows}>
                {earningRewards.map((reward) => (
                  <div className={styles.earningRewardRow} key={reward.id}>
                    <div className={styles.earningRewardRowPrimary}>
                      <label className={styles.field}>
                        <span>Category</span>
                        <select
                          required
                          value={reward.categorySelection}
                          onChange={(event) =>
                            updateEarningReward(reward.id, {
                              categorySelection: event.target.value,
                            })
                          }
                        >
                          <option value="">Choose a category</option>
                          {EARNING_REWARD_CATEGORY_OPTIONS.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                          <option value={CUSTOM_CATEGORY_VALUE}>
                            Custom category
                          </option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span>Rate</span>
                        <div className={styles.percentInputWrapper}>
                          <input
                            min="1"
                            max="100"
                            step="0.01"
                            type="number"
                            placeholder="0"
                            value={reward.rewardPercent}
                            onChange={(event) =>
                              updateEarningReward(reward.id, {
                                rewardPercent: event.target.value,
                              })
                            }
                          />
                        </div>
                      </label>
                      <button
                        className={styles.removeButton}
                        type="button"
                        onClick={() =>
                          setEarningRewards((rows) =>
                            rows.filter((row) => row.id !== reward.id),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                    {reward.categorySelection === CUSTOM_CATEGORY_VALUE && (
                      <div className={styles.earningRewardCustomFields}>
                        <label className={styles.field}>
                          <span>Display name</span>
                          <input
                            required
                            maxLength={120}
                            type="text"
                            value={reward.customDisplayName}
                            onChange={(event) =>
                              updateEarningReward(reward.id, {
                                customDisplayName: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          <span>Keywords (comma-separated)</span>
                          <input
                            required
                            maxLength={500}
                            placeholder="e.g. starbucks, blue bottle"
                            type="text"
                            value={reward.customKeywords}
                            onChange={(event) =>
                              updateEarningReward(reward.id, {
                                customKeywords: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={styles.formSection}>
            <div className={styles.formSectionHeader}>
              <h3>Perks</h3>
              <button
                type="button"
                onClick={() =>
                  setPerkAwards((rows) => [...rows, createPerkAwardRow()])
                }
              >
                Add perk
              </button>
            </div>
            {perkAwards.length === 0 ? (
              <p className={styles.formEmptyText}>No perks added.</p>
            ) : (
              <div className={styles.benefitRows}>
                {perkAwards.map((award) => (
                  <div
                    className={`${styles.benefitRow} ${styles.perkBenefitRow}`}
                    key={award.id}
                  >
                    <label className={styles.field}>
                      <span>Perk</span>
                      <input
                        required
                        maxLength={160}
                        type="text"
                        value={award.name}
                        onChange={(event) =>
                          updatePerkAward(award.id, {
                            name: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Value</span>
                      <input
                        required
                        inputMode="decimal"
                        type="text"
                        value={award.dollarValue}
                        onChange={(event) =>
                          updatePerkAward(award.id, {
                            dollarValue: formatDollarInput(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Times</span>
                      <input
                        required
                        min="0"
                        max={FREQUENCY_LIMITS[award.frequencyPeriod]}
                        step="1"
                        type="number"
                        value={award.frequencyCount}
                        onChange={(event) =>
                          updatePerkAward(award.id, {
                            frequencyCount: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Frequency</span>
                      <select
                        value={award.frequencyPeriod}
                        onChange={(event) => {
                          const frequencyPeriod = event.target
                            .value as CreditCardPerkAward["frequency_period"];
                          const currentCount = Number(award.frequencyCount || 1);

                          updatePerkAward(award.id, {
                            frequencyPeriod,
                            frequencyCount: String(
                              Math.min(
                                currentCount,
                                FREQUENCY_LIMITS[frequencyPeriod],
                              ),
                            ),
                          });
                        }}
                      >
                        <option value="per_year">per year</option>
                        <option value="per_quarter">per quarter</option>
                        <option value="per_month">per month</option>
                      </select>
                    </label>
                    <label className={styles.autoCompleteField}>
                      <input
                        checked={award.autoComplete}
                        type="checkbox"
                        onChange={(event) =>
                          updatePerkAward(award.id, {
                            autoComplete: event.target.checked,
                          })
                        }
                      />
                      <span>Auto-completes each cycle</span>
                    </label>
                    <button
                      className={styles.removeButton}
                      type="button"
                      onClick={() =>
                        setPerkAwards((rows) =>
                          rows.filter((row) => row.id !== award.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className={styles.modalActions}>
            {selectedCardTypeId && (
              <button
                className={styles.removeButton}
                disabled={isSaving || isDeleting}
                style={{ marginRight: "auto" }}
                type="button"
                onClick={handleDelete}
              >
                {isDeleting ? "Deleting" : "Delete card type"}
              </button>
            )}
            <button
              className={styles.secondaryButton}
              disabled={isSaving}
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className={styles.primaryButton}
              disabled={isSaving}
              type="submit"
            >
              {isSaving
                ? "Saving"
                : selectedCardTypeId
                  ? "Save changes"
                  : "Save card type"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
  optimization,
  onClose,
  onSelectGroup,
  onSelectRecommendation,
}: {
  cardRecommendations?: CreditCardNewCardRecommendations;
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
          </div>
        </div>
      </div>
    </div>
  );
};

const AccountTile = ({
  account,
  cardTypes,
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
        <EditableChipSelect
          aria-label={`Card type for ${account.name}`}
          disabled={isUpdating}
          options={cardTypes.map((type) => ({
            value: String(type.id),
            label: type.name,
          }))}
          placeholder="Choose card type"
          value={account.credit_card_type_id?.toString() || ""}
          onChange={(value) => {
            const creditCardTypeId = value ? Number(value) : null;

            onAccountTypeChange({
              accountId: account.id,
              creditCardTypeId,
              effectiveMonth: creditCardTypeId
                ? account.effective_month || getCurrentMonthValue()
                : null,
            });
          }}
        />
      </div>
      {account.credit_card_type_id && (
        <div className={styles.typeSelector}>
          <span>Effective month</span>
          <EditableChipSelect
            aria-label={`Effective month for ${account.name}`}
            disabled={isUpdating}
            options={MONTH_OPTIONS}
            placeholder="Effective month"
            value={account.effective_month || getCurrentMonthValue()}
            onChange={(value) =>
              onAccountTypeChange({
                accountId: account.id,
                creditCardTypeId: account.credit_card_type_id,
                effectiveMonth: value || getCurrentMonthValue(),
              })
            }
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
        effectiveMonth={account.effective_month}
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
  isCreatingCardType,
  isDeletingCardType,
  isCardTypeManager,
  isUpdating,
  isUpdatingCardType,
  isUpdatingPerkCompletion,
  error,
  onBackToDashboard,
  onCreateCardType,
  onUpdateCardType,
  onDeleteCardType,
  onAccountTypeChange,
  onPerkCompletionChange,
}: CreditCardRewardsPageProps) => {
  const [isManageCardTypesModalOpen, setIsManageCardTypesModalOpen] =
    useState(false);
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
          {isCardTypeManager && (
            <button
              className={styles.primaryButton}
              disabled={isLoading}
              type="button"
              onClick={() => setIsManageCardTypesModalOpen(true)}
            >
              Manage card types
            </button>
          )}
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
        onOptimize={() => setIsOptimizationModalOpen(true)}
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

      {isCardTypeManager && isManageCardTypesModalOpen && (
        <ManageCardTypesModal
          cardTypes={data?.card_types || []}
          isDeleting={isDeletingCardType}
          isSaving={isCreatingCardType || isUpdatingCardType}
          onClose={() => setIsManageCardTypesModalOpen(false)}
          onCreateCardType={onCreateCardType}
          onUpdateCardType={onUpdateCardType}
          onDeleteCardType={onDeleteCardType}
        />
      )}

      {isOptimizationModalOpen && (
        <RewardsOptimizationModal
          cardRecommendations={data?.card_recommendations}
          optimization={data?.optimization}
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
