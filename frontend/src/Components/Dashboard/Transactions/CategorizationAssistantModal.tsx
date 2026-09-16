import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import ChipSelect from "../../shared/ChipSelect";
import ModalShell from "../Modals/ModalShell";
import { manualExpenseCategories } from "../shared/constants";
import { dashboardPayloadKeys } from "../dashboardQueryKeys";
import { formatCurrency } from "../shared/formatters";
import styles from "./index.module.css";
import {
  approveCategorizationSuggestions,
  createCategorizationBatch,
  dismissCategorizationSuggestion,
} from "./categorizationAssistantApi";
import type {
  CategorizationBatchResponse,
  CategorizationScope,
  CategorizationSuggestion,
  CategorizationSuggestionGroup,
} from "./categorizationAssistantApi";

type CategorizationAssistantModalProps = {
  month: string;
  onClose: () => void;
  onError: (message: string) => void;
};

type ReviewFilter = "needs_review" | "all" | "pending";

const scopeOptions: Array<{ label: string; value: CategorizationScope }> = [
  { label: "My history", value: "user_only" },
  { label: "Starter patterns", value: "user_and_starter_patterns" },
];

const filterOptions: Array<{ label: string; value: ReviewFilter }> = [
  { label: "Needs review", value: "needs_review" },
  { label: "Pending", value: "pending" },
  { label: "All", value: "all" },
];

const reviewReasonLabels: Record<string, string> = {
  ambiguous_vendor: "Ambiguous vendor",
  amount_outlier: "Amount outlier",
  category_outlier: "Category outlier",
  first_time_rule_match: "First rule match",
  low_confidence: "Low confidence",
  new_vendor_for_rule: "New vendor",
  rule_conflict: "Rule conflict",
  uncategorized: "Uncategorized",
};

const sourceLabels: Record<string, string> = {
  manual_category: "Manual",
  model: "Model",
  plaid_default: "Plaid",
  rule: "Rule",
  starter_pattern: "Starter",
  user_history: "History",
};

const getConfidenceLabel = (confidence: number) =>
  `${Math.round(confidence * 100)}%`;

const getNumberEvidence = (
  suggestion: CategorizationSuggestion,
  key: string,
) => {
  const value = suggestion.evidence[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const getSuggestionReason = (suggestion: CategorizationSuggestion) => {
  const suggestedSource = String(
    suggestion.evidence.suggested_source || suggestion.assigned_source,
  );
  const confidence = getConfidenceLabel(suggestion.confidence);
  const userVendorMatches = getNumberEvidence(
    suggestion,
    "user_vendor_matches",
  );
  const userCategoryMatches = getNumberEvidence(
    suggestion,
    "user_category_matches",
  );
  const starterVendorMatches = getNumberEvidence(
    suggestion,
    "starter_vendor_matches",
  );
  const starterCategoryMatches = getNumberEvidence(
    suggestion,
    "starter_category_matches",
  );

  if (suggestedSource === "user_history" && userVendorMatches) {
    return `Confidence - ${confidence}: matched ${userVendorMatches} of your transactions for this vendor`;
  }

  if (suggestedSource === "user_history" && userCategoryMatches) {
    return `Confidence - ${confidence}: based on ${userCategoryMatches} of your transactions in this Plaid category`;
  }

  if (suggestedSource === "starter_pattern" && starterVendorMatches) {
    return `Confidence - ${confidence}: matched ${starterVendorMatches} starter transactions for this vendor`;
  }

  if (suggestedSource === "starter_pattern" && starterCategoryMatches) {
    return `Confidence - ${confidence}: based on ${starterCategoryMatches} starter transactions in this Plaid category`;
  }

  if (suggestedSource === "rule") {
    return `Confidence - ${confidence}: existing rule match`;
  }

  if (suggestedSource === "plaid_default") {
    return `Confidence - ${confidence}: Plaid category fallback`;
  }

  if (suggestedSource === "manual_category") {
    return `Confidence - ${confidence}: existing manual category`;
  }

  return `Confidence - ${confidence}: ${
    sourceLabels[suggestedSource] || suggestedSource
  }`;
};

const getTransactionDate = (suggestion: CategorizationSuggestion) =>
  suggestion.transaction.manual_date || suggestion.transaction.date;

const getOverrideValue = (
  suggestion: CategorizationSuggestion,
  categoryOverrides: Record<number, string>,
) => categoryOverrides[suggestion.id] || suggestion.suggested_category;

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const CategorizationAssistantModal = ({
  month,
  onClose,
  onError,
}: CategorizationAssistantModalProps) => {
  const [scope, setScope] =
    useState<CategorizationScope>("user_and_starter_patterns");
  const [filter, setFilter] = useState<ReviewFilter>("needs_review");
  const [batchData, setBatchData] =
    useState<CategorizationBatchResponse | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [categoryOverrides, setCategoryOverrides] = useState<
    Record<number, string>
  >({});
  const queryClient = useQueryClient();

  const runMutation = useMutation({
    mutationFn: () => createCategorizationBatch({ month, scope }),
    onSuccess: (data) => {
      setBatchData(data);
      setSelectedGroupId(data.groups[0]?.id || null);
      setCategoryOverrides({});
    },
    onError: (error) =>
      onError(getErrorMessage(error, "Unable to run categorization assistant")),
  });
  const approveMutation = useMutation({
    mutationFn: ({
      suggestionIds,
    }: {
      suggestionIds: number[];
    }) =>
      approveCategorizationSuggestions({
        batchId: batchData?.batch.id || 0,
        suggestionIds,
        categoryOverrides: Object.fromEntries(
          suggestionIds
            .filter((suggestionId) => categoryOverrides[suggestionId])
            .map((suggestionId) => [
              suggestionId,
              categoryOverrides[suggestionId],
            ]),
        ),
      }),
    onSuccess: async (data) => {
      setBatchData(data);
      await queryClient.invalidateQueries({ queryKey: dashboardPayloadKeys.root });
    },
    onError: (error) =>
      onError(getErrorMessage(error, "Unable to approve suggestions")),
  });
  const dismissMutation = useMutation({
    mutationFn: dismissCategorizationSuggestion,
    onSuccess: (data) => setBatchData(data),
    onError: (error) =>
      onError(getErrorMessage(error, "Unable to dismiss suggestion")),
  });

  const visibleGroups = useMemo(() => {
    const groups = batchData?.groups || [];

    if (filter === "needs_review") {
      return groups
        .map((group) => ({
          ...group,
          suggestions: group.suggestions.filter(
            (suggestion) =>
              suggestion.status === "pending" && suggestion.review_required,
          ),
        }))
        .filter((group) => group.suggestions.length > 0);
    }

    if (filter === "pending") {
      return groups
        .map((group) => ({
          ...group,
          suggestions: group.suggestions.filter(
            (suggestion) => suggestion.status === "pending",
          ),
        }))
        .filter((group) => group.suggestions.length > 0);
    }

    return groups;
  }, [batchData, filter]);
  const selectedGroup =
    visibleGroups.find((group) => group.id === selectedGroupId) ||
    visibleGroups[0] ||
    null;
  const selectedGroupSuggestionIds =
    selectedGroup?.suggestions
      .filter((suggestion) => suggestion.status === "pending")
      .map((suggestion) => suggestion.id) || [];
  const isBusy =
    runMutation.isPending ||
    approveMutation.isPending ||
    dismissMutation.isPending;

  const setSuggestionCategory = (
    suggestion: CategorizationSuggestion,
    category: string,
  ) => {
    setCategoryOverrides((currentOverrides) => ({
      ...currentOverrides,
      [suggestion.id]: category,
    }));
  };

  const approveSuggestionIds = (suggestionIds: number[]) => {
    if (suggestionIds.length === 0 || !batchData) {
      return;
    }

    approveMutation.mutate({ suggestionIds });
  };

  const renderSuggestion = (suggestion: CategorizationSuggestion) => (
    <div className={styles.assistantTransactionRow} key={suggestion.id}>
      <div className={styles.assistantTransactionMain}>
        <strong>
          {suggestion.transaction.merchant_name || suggestion.transaction.name}
        </strong>
        {suggestion.transaction.merchant_name && (
          <span>{suggestion.transaction.name}</span>
        )}
        <span>
          {getTransactionDate(suggestion)} -{" "}
          {formatCurrency(suggestion.transaction.amount)}
        </span>
      </div>
      <div className={styles.assistantSuggestionControl}>
        <ChipSelect
          aria-label={`Category for ${suggestion.transaction.name}`}
          disabled={isBusy || suggestion.status !== "pending"}
          options={manualExpenseCategories.map((category) => ({
            value: category,
            label: category,
          }))}
          placeholder="Choose category"
          value={getOverrideValue(suggestion, categoryOverrides)}
          onChange={(category) => setSuggestionCategory(suggestion, category)}
        />
        <span>{getSuggestionReason(suggestion)}</span>
      </div>
      <div className={styles.assistantBadges}>
        {suggestion.review_reasons.map((reason) => (
          <span key={reason}>
            {reviewReasonLabels[reason] || reason.replaceAll("_", " ")}
          </span>
        ))}
      </div>
      <div className={styles.assistantRowActions}>
        <button
          disabled={isBusy || suggestion.status !== "pending"}
          type="button"
          onClick={() => approveSuggestionIds([suggestion.id])}
        >
          Approve
        </button>
        <button
          disabled={isBusy || suggestion.status !== "pending"}
          type="button"
          onClick={() => dismissMutation.mutate(suggestion.id)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );

  return (
    <ModalShell
      ariaLabel="Categorization assistant"
      className={styles.assistantModal}
      onClose={onClose}
    >
      <div className={styles.assistantHeader}>
        <div>
          <h2>Categorization assistant</h2>
          <p>{month}</p>
        </div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className={styles.assistantToolbar}>
        <div className={styles.assistantSegmentedControl}>
          {scopeOptions.map((option) => (
            <button
              className={scope === option.value ? styles.assistantActivePill : ""}
              disabled={isBusy}
              key={option.value}
              type="button"
              onClick={() => setScope(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className={styles.assistantSegmentedControl}>
          {filterOptions.map((option) => (
            <button
              className={filter === option.value ? styles.assistantActivePill : ""}
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          className={styles.categoryActionButton}
          disabled={isBusy}
          type="button"
          onClick={() => runMutation.mutate()}
        >
          {runMutation.isPending ? "Running" : "Run assistant"}
        </button>
      </div>
      {!batchData ? (
        <div className={styles.assistantEmptyState}>
          Run the assistant to prepare a review batch for this month.
        </div>
      ) : (
        <div className={styles.assistantLayout}>
          <div className={styles.assistantGroupList}>
            {visibleGroups.length === 0 ? (
              <p>No suggestions match this filter.</p>
            ) : (
              visibleGroups.map((group: CategorizationSuggestionGroup) => (
                <button
                  className={
                    selectedGroup?.id === group.id
                      ? `${styles.assistantGroupButton} ${styles.assistantGroupButtonActive}`
                      : styles.assistantGroupButton
                  }
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  <strong>
                    {group.original_category} to {group.suggested_category}
                  </strong>
                  <span>
                    {group.suggestions.length} -{" "}
                    {formatCurrency(group.total_amount)} -{" "}
                    {getConfidenceLabel(group.average_confidence)}
                  </span>
                </button>
              ))
            )}
          </div>
          <div className={styles.assistantDetail}>
            {selectedGroup ? (
              <>
                <div className={styles.assistantDetailHeader}>
                  <div>
                    <h3>
                      {selectedGroup.original_category} to{" "}
                      {selectedGroup.suggested_category}
                    </h3>
                    <p>
                      {selectedGroup.suggestions.length} transactions -{" "}
                      {formatCurrency(selectedGroup.total_amount)}
                    </p>
                  </div>
                  <div className={styles.assistantHeaderActions}>
                    <button
                      disabled={isBusy || selectedGroupSuggestionIds.length === 0}
                      type="button"
                      onClick={() =>
                        approveSuggestionIds(selectedGroupSuggestionIds)
                      }
                    >
                      Approve this group
                    </button>
                  </div>
                </div>
                <div className={styles.assistantTransactionList}>
                  {selectedGroup.suggestions.map(renderSuggestion)}
                </div>
              </>
            ) : (
              <div className={styles.assistantEmptyState}>
                Select a suggestion group.
              </div>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
};

export default CategorizationAssistantModal;
