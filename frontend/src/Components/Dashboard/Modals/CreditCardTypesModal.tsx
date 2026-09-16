import { useState } from "react";
import type { FormEvent } from "react";

import SearchableChipSelect from "../../shared/SearchableChipSelect";
import { manualExpenseCategories } from "../shared/constants";
import styles from "./index.module.css";
import cardTypeFormStyles from "../../CreditCardRewards/index.module.css";
import type {
  CreateCreditCardTypeInput,
  CreditCardEarningReward,
  CreditCardPerkAward,
  CreditCardType,
  VectorMintImportResult,
} from "../../CreditCardRewards/types";

type CreditCardTypesPanelProps = {
  cardTypes: CreditCardType[];
  isDeleting: boolean;
  isImportingVectorMintCards: boolean;
  isSaving: boolean;
  showHeader?: boolean;
  onCreateCardType: (input: CreateCreditCardTypeInput) => Promise<unknown>;
  onUpdateCardType: (params: {
    cardTypeId: number;
    input: CreateCreditCardTypeInput;
  }) => Promise<unknown>;
  onDeleteCardType: (cardTypeId: number) => Promise<unknown>;
  onImportVectorMintCards: () => Promise<unknown>;
};

const CUSTOM_CATEGORY_VALUE = "__custom_category__";

const EARNING_REWARD_CATEGORY_OPTIONS = [
  "Base rate",
  ...manualExpenseCategories,
];

const FREQUENCY_LIMITS: Record<CreditCardPerkAward["frequency_period"], number> = {
  per_year: 24,
  per_quarter: 6,
  per_month: 2,
};
const BENEFIT_STATUS_OPTIONS = [
  { value: "included", label: "Included" },
  { value: "needs_review", label: "Needs review" },
  { value: "excluded", label: "Excluded" },
] as const;

type BenefitStatus = (typeof BENEFIT_STATUS_OPTIONS)[number]["value"];

type EarningRewardFormRow = {
  id: string;
  dbId?: number;
  categorySelection: string;
  customDisplayName: string;
  customKeywords: string;
  rewardPercent: string;
  status: BenefitStatus;
  source?: string;
  sourceDescription?: string | null;
  statusReason?: string | null;
  matchStrategy?: string | null;
};

type PerkAwardFormRow = {
  id: string;
  dbId?: number;
  name: string;
  dollarValue: string;
  frequencyCount: string;
  frequencyPeriod: CreditCardPerkAward["frequency_period"];
  autoComplete: boolean;
  status: BenefitStatus;
  source?: string;
  sourceDescription?: string | null;
  statusReason?: string | null;
  matchStrategy?: string | null;
};

const createLocalId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

const createEarningRewardRow = (): EarningRewardFormRow => ({
  id: createLocalId(),
  categorySelection: "",
  customDisplayName: "",
  customKeywords: "",
  rewardPercent: "",
  status: "included",
});

const createPerkAwardRow = (): PerkAwardFormRow => ({
  id: createLocalId(),
  name: "",
  dollarValue: "",
  frequencyCount: "1",
  frequencyPeriod: "per_year",
  autoComplete: false,
  status: "included",
});

const createBaseRateRow = (): EarningRewardFormRow => ({
  id: createLocalId(),
  categorySelection: "Base rate",
  customDisplayName: "",
  customKeywords: "",
  rewardPercent: "",
  status: "included",
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

const formatRewardPercent = (value: number | string) => {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? String(numericValue) : "";
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to save credit card type.";

const buildEarningRewardRow = (
  reward: CreditCardEarningReward,
): EarningRewardFormRow => ({
  id: createLocalId(),
  dbId: reward.id,
  categorySelection: reward.keywords ? CUSTOM_CATEGORY_VALUE : reward.category,
  customDisplayName: reward.keywords ? reward.category : "",
  customKeywords: reward.keywords || "",
  rewardPercent: formatRewardPercent(reward.reward_percent),
  status: reward.status || "included",
  source: reward.source,
  sourceDescription: reward.source_description,
  statusReason: reward.status_reason,
  matchStrategy: reward.match_strategy,
});

const buildPerkAwardRow = (award: CreditCardPerkAward): PerkAwardFormRow => ({
  id: createLocalId(),
  dbId: award.id,
  name: award.name,
  dollarValue: String(award.dollar_value),
  frequencyCount: String(award.frequency_count),
  frequencyPeriod: award.frequency_period,
  autoComplete: award.auto_complete,
  status: award.status || "included",
  source: award.source,
  sourceDescription: award.source_description,
  statusReason: award.status_reason,
  matchStrategy: award.match_strategy,
});

const getReviewCards = (cardTypes: CreditCardType[]) =>
  cardTypes.filter(
    (cardType) =>
      cardType.status === "in_review" ||
      Boolean(cardType.review_reason) ||
      // "excluded" is a deliberate, resolved state (e.g. a combo reward we
      // can't safely track) - only "needs_review" means a benefit is still
      // waiting on admin attention. Treating excluded the same as
      // needs_review here would keep a fully-reviewed card in this list
      // forever just because it has an intentionally-excluded benefit.
      cardType.earning_rewards.some((reward) => reward.status === "needs_review") ||
      cardType.perk_awards.some((award) => award.status === "needs_review"),
  );

const countBenefitsByStatus = (cardType: CreditCardType) => {
  const benefits = [...cardType.earning_rewards, ...cardType.perk_awards];

  return BENEFIT_STATUS_OPTIONS.reduce(
    (counts, option) => ({
      ...counts,
      [option.value]: benefits.filter(
        (benefit) => (benefit.status || "included") === option.value,
      ).length,
    }),
    {} as Record<BenefitStatus, number>,
  );
};

export const CreditCardTypesPanel = ({
  cardTypes,
  isDeleting,
  isImportingVectorMintCards,
  isSaving,
  showHeader = true,
  onCreateCardType,
  onUpdateCardType,
  onDeleteCardType,
  onImportVectorMintCards,
}: CreditCardTypesPanelProps) => {
  const [activePanelTab, setActivePanelTab] = useState<"manage" | "review">(
    "manage",
  );
  const [selectedCardTypeId, setSelectedCardTypeId] = useState<number | null>(
    null,
  );
  const [importSummary, setImportSummary] = useState<
    VectorMintImportResult["import_summary"] | null
  >(null);
  const [name, setName] = useState("");
  const [annualFee, setAnnualFee] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [earningRewards, setEarningRewards] = useState<EarningRewardFormRow[]>(
    [createBaseRateRow()],
  );
  const [perkAwards, setPerkAwards] = useState<PerkAwardFormRow[]>([]);
  const reviewCards = getReviewCards(cardTypes);

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
            status: reward.status,
            source: reward.source,
            source_description: reward.sourceDescription || null,
            status_reason: reward.statusReason || null,
            match_strategy: reward.matchStrategy || null,
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
          status: award.status,
          source: award.source,
          source_description: award.sourceDescription || null,
          status_reason: award.statusReason || null,
          match_strategy: award.matchStrategy || null,
        })),
    };

    try {
      if (selectedCardTypeId) {
        await onUpdateCardType({ cardTypeId: selectedCardTypeId, input });
      } else {
        await onCreateCardType(input);
      }

      selectCardType(null);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  const handleImportVectorMintCards = async () => {
    setFormError(null);

    try {
      const result = (await onImportVectorMintCards()) as VectorMintImportResult;
      setImportSummary(result.import_summary);
      setActivePanelTab("review");
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
      selectCardType(null);
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
    <>
      {showHeader && (
        <div className={styles.settingsPanelHeader}>
          <h3>Card types</h3>
          <p>Configure the credit cards available to assign to accounts.</p>
        </div>
      )}

      <div className={cardTypeFormStyles.cardTypeTabs} role="tablist">
        <button
          className={
            activePanelTab === "manage" ? cardTypeFormStyles.cardTypeTabActive : ""
          }
          type="button"
          onClick={() => setActivePanelTab("manage")}
        >
          Manage cards
        </button>
        <button
          className={
            activePanelTab === "review" ? cardTypeFormStyles.cardTypeTabActive : ""
          }
          type="button"
          onClick={() => setActivePanelTab("review")}
        >
          Review imports
          {reviewCards.length > 0 ? ` (${reviewCards.length})` : ""}
        </button>
        <button
          className={cardTypeFormStyles.secondaryButton}
          disabled={isImportingVectorMintCards || isSaving}
          type="button"
          onClick={handleImportVectorMintCards}
        >
          {isImportingVectorMintCards ? "Updating from VectorMint" : "Update from VectorMint"}
        </button>
      </div>

      {importSummary && (
        <p className={cardTypeFormStyles.importSummary}>
          VectorMint checked {importSummary.fetched_count} cards, added{" "}
          {importSummary.created_review_count} for review, and merged{" "}
          {importSummary.benefits_added_count} new benefits.
        </p>
      )}

      {activePanelTab === "review" && (
        <div className={cardTypeFormStyles.reviewList}>
          {reviewCards.length === 0 ? (
            <p className={cardTypeFormStyles.formEmptyText}>
              No imported cards or benefits need review.
            </p>
          ) : (
            reviewCards.map((cardType) => {
              const counts = countBenefitsByStatus(cardType);

              return (
                <button
                  className={cardTypeFormStyles.reviewCard}
                  key={cardType.id}
                  type="button"
                  onClick={() => {
                    selectCardType(cardType.id);
                    setActivePanelTab("manage");
                  }}
                >
                  <span>
                    <strong>{cardType.name}</strong>
                    <small>
                      {cardType.status === "in_review" ? "In review" : "Active"}
                      {cardType.review_reason ? ` - ${cardType.review_reason}` : ""}
                    </small>
                  </span>
                  <span>
                    {counts.included} included · {counts.needs_review} review ·{" "}
                    {counts.excluded} excluded
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      <form
        className={cardTypeFormStyles.cardTypeForm}
        hidden={activePanelTab !== "manage"}
        onSubmit={submit}
      >
        {formError && (
          <p className={cardTypeFormStyles.formError}>{formError}</p>
        )}

        <label className={cardTypeFormStyles.field}>
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

        <div className={cardTypeFormStyles.formGrid}>
          <label className={cardTypeFormStyles.field}>
            <span>Credit card type</span>
            <input
              required
              maxLength={120}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className={cardTypeFormStyles.field}>
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

        <section className={cardTypeFormStyles.formSection}>
          <div className={cardTypeFormStyles.formSectionHeader}>
            <h3>Earning rates</h3>
            <button
              type="button"
              onClick={() =>
                setEarningRewards((rows) => [...rows, createEarningRewardRow()])
              }
            >
              Add earning rate
            </button>
          </div>
          {earningRewards.length === 0 ? (
            <p className={cardTypeFormStyles.formEmptyText}>
              No earning rates added.
            </p>
          ) : (
            <div className={cardTypeFormStyles.benefitRows}>
              {earningRewards.map((reward) => (
                <div
                  className={cardTypeFormStyles.earningRewardRow}
                  key={reward.id}
                >
                  <div className={cardTypeFormStyles.earningRewardRowPrimary}>
                    <label className={cardTypeFormStyles.field}>
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
                    <label className={cardTypeFormStyles.field}>
                      <span>Rate</span>
                      <div className={cardTypeFormStyles.percentInputWrapper}>
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
                    <label className={cardTypeFormStyles.field}>
                      <span>Status</span>
                      <select
                        value={reward.status}
                        onChange={(event) =>
                          updateEarningReward(reward.id, {
                            status: event.target.value as BenefitStatus,
                          })
                        }
                      >
                        {BENEFIT_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className={cardTypeFormStyles.removeButton}
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
                    <div className={cardTypeFormStyles.earningRewardCustomFields}>
                      <label className={cardTypeFormStyles.field}>
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
                      <label className={cardTypeFormStyles.field}>
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
                  {(reward.sourceDescription || reward.statusReason) && (
                    <p className={cardTypeFormStyles.sourceNote}>
                      {reward.statusReason || "Imported benefit."}
                      {reward.sourceDescription
                        ? ` Source: ${reward.sourceDescription}`
                        : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={cardTypeFormStyles.formSection}>
          <div className={cardTypeFormStyles.formSectionHeader}>
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
            <p className={cardTypeFormStyles.formEmptyText}>No perks added.</p>
          ) : (
            <div className={cardTypeFormStyles.benefitRows}>
              {perkAwards.map((award) => (
                <div
                  className={`${cardTypeFormStyles.benefitRow} ${cardTypeFormStyles.perkBenefitRow}`}
                  key={award.id}
                >
                  <label className={cardTypeFormStyles.field}>
                    <span>Perk</span>
                    <input
                      required
                      maxLength={160}
                      type="text"
                      value={award.name}
                      onChange={(event) =>
                        updatePerkAward(award.id, { name: event.target.value })
                      }
                    />
                  </label>
                  <label className={cardTypeFormStyles.field}>
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
                  <label className={cardTypeFormStyles.field}>
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
                  <label className={cardTypeFormStyles.field}>
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
                  <label className={cardTypeFormStyles.autoCompleteField}>
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
                  <label className={cardTypeFormStyles.field}>
                    <span>Status</span>
                    <select
                      value={award.status}
                      onChange={(event) =>
                        updatePerkAward(award.id, {
                          status: event.target.value as BenefitStatus,
                        })
                      }
                    >
                      {BENEFIT_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className={cardTypeFormStyles.removeButton}
                    type="button"
                    onClick={() =>
                      setPerkAwards((rows) =>
                        rows.filter((row) => row.id !== award.id),
                      )
                    }
                  >
                    Remove
                  </button>
                  {(award.sourceDescription || award.statusReason) && (
                    <p className={cardTypeFormStyles.sourceNote}>
                      {award.statusReason || "Imported benefit."}
                      {award.sourceDescription ? ` Source: ${award.sourceDescription}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className={cardTypeFormStyles.modalActions}>
          {selectedCardTypeId && (
            <button
              className={cardTypeFormStyles.removeButton}
              disabled={isSaving || isDeleting}
              style={{ marginRight: "auto" }}
              type="button"
              onClick={handleDelete}
            >
              {isDeleting ? "Deleting" : "Delete card type"}
            </button>
          )}
          <button
            className={cardTypeFormStyles.secondaryButton}
            disabled={isSaving}
            type="button"
            onClick={() => selectCardType(null)}
          >
            Clear
          </button>
          <button
            className={cardTypeFormStyles.primaryButton}
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
    </>
  );
};
