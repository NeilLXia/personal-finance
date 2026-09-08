import { useEffect, useMemo, useState } from "react";

import { getJson, postJson } from "../../../shared/apiClient";
import { incomeAllocationBudgetTargetCategories } from "../shared/constants";
import styles from "./index.module.css";
import shared from "../dashboard.shared.module.css";
import type { BudgetTarget } from "../shared/types";
import ModalShell from "./ModalShell";

type BudgetTargetDraft = {
  category: string;
  net_target_percent: string;
  gross_target_percent: string;
};

type BudgetTargetsModalProps = {
  onClose: () => void;
  onChanged: () => void;
  onError: (message: string) => void;
};

type BudgetTargetsResponse = {
  targets?: BudgetTarget[];
};

const createEmptyDrafts = () =>
  incomeAllocationBudgetTargetCategories.map((category) => ({
    category,
    net_target_percent: "",
    gross_target_percent: category === "Taxes" ? "" : "",
  }));

const normalizeCategoryKey = (category: string) =>
  category.trim().toLowerCase();
const parseTargetPercent = (value: string) => Number(value === "" ? 0 : value);
const calculatedTargetCategory = "Effective savings";

const isValidTargetPercent = (value: string) => {
  const percent = parseTargetPercent(value);

  return !Number.isNaN(percent) && percent >= 0 && percent <= 100;
};

const formatCalculatedTarget = (value: number) =>
  Number.isFinite(value) ? value.toFixed(2) : "0.00";

const getCalculatedEffectiveSavingsTarget = (
  drafts: BudgetTargetDraft[],
  field: "net_target_percent" | "gross_target_percent",
) => {
  const usedTargetPercent = drafts.reduce((total, draft) => {
    if (draft.category === calculatedTargetCategory) {
      return total;
    }

    if (field === "net_target_percent" && draft.category === "Taxes") {
      return total;
    }

    return total + parseTargetPercent(draft[field]);
  }, 0);

  return Number((100 - usedTargetPercent).toFixed(2));
};

const BudgetTargetsModal = ({
  onClose,
  onChanged,
  onError,
}: BudgetTargetsModalProps) => {
  const [drafts, setDrafts] = useState<BudgetTargetDraft[]>(createEmptyDrafts);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const calculatedNetTarget = useMemo(
    () => getCalculatedEffectiveSavingsTarget(drafts, "net_target_percent"),
    [drafts],
  );
  const calculatedGrossTarget = useMemo(
    () => getCalculatedEffectiveSavingsTarget(drafts, "gross_target_percent"),
    [drafts],
  );

  const canSave =
    !isSaving &&
    calculatedNetTarget >= 0 &&
    calculatedNetTarget <= 100 &&
    calculatedGrossTarget >= 0 &&
    calculatedGrossTarget <= 100 &&
    drafts.every(
      (draft) =>
        (draft.category === calculatedTargetCategory ||
          draft.category === "Taxes" ||
          isValidTargetPercent(draft.net_target_percent)) &&
        (draft.category === calculatedTargetCategory ||
          isValidTargetPercent(draft.gross_target_percent)),
    );

  useEffect(() => {
    let isMounted = true;

    const loadTargets = async () => {
      setIsLoading(true);

      try {
        const data = await getJson<BudgetTargetsResponse>(
          "/api/budget-targets",
          {},
          "Budget target request failed",
        );
        const targetsByCategory = new Map<string, BudgetTarget>(
          (data.targets || []).map((target: BudgetTarget) => [
            normalizeCategoryKey(target.category),
            target,
          ]),
        );

        if (isMounted) {
          setDrafts(
            incomeAllocationBudgetTargetCategories.map((category) => {
              const target = targetsByCategory.get(
                normalizeCategoryKey(category),
              );

              return {
                category,
                net_target_percent:
                  category === "Taxes"
                    ? ""
                    : String(
                        target?.net_target_percent ??
                          target?.target_percent ??
                          "",
                      ),
                gross_target_percent: String(
                  target?.gross_target_percent ?? "",
                ),
              };
            }),
          );
        }
      } catch (requestError) {
        onError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load budget targets",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadTargets();

    return () => {
      isMounted = false;
    };
  }, [onError]);

  const updateDraft = (
    category: string,
    field: "net_target_percent" | "gross_target_percent",
    value: string,
  ) => {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.category === category
          ? {
              ...draft,
              [field]: value,
            }
          : draft,
      ),
    );
  };

  const saveTargets = async () => {
    if (!canSave) {
      return;
    }

    setIsSaving(true);

    try {
      await Promise.all(
        drafts.map((draft) => {
          const isCalculatedTarget =
            draft.category === calculatedTargetCategory;

          return postJson(
            "/api/budget-targets",
            {
              category: draft.category,
              net_target_percent:
                draft.category === "Taxes"
                  ? 0
                  : isCalculatedTarget
                    ? calculatedNetTarget
                    : parseTargetPercent(draft.net_target_percent),
              gross_target_percent: isCalculatedTarget
                ? calculatedGrossTarget
                : parseTargetPercent(draft.gross_target_percent),
            },
            {},
            "Budget target save failed",
          );
        }),
      );

      onChanged();
      onClose();
    } catch (requestError) {
      onError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save budget targets",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell ariaLabel="Budget targets" onClose={onClose}>
      <div className={styles.modalHeader}>
        <div>
          <h2>Budget targets</h2>
          <p>Set income allocation target percentages.</p>
        </div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <form
        className={styles.budgetTargetFixedForm}
        onSubmit={(event) => {
          event.preventDefault();
          void saveTargets();
        }}
      >
        <div className={styles.budgetTargetHeaderRow}>
          <span>Category</span>
          <span>Net (%)</span>
          <span>Gross (%)</span>
        </div>
        {isLoading ? (
          <p className={shared.emptyText}>Loading budget targets...</p>
        ) : (
          drafts.map((draft) => {
            const isCalculatedTarget =
              draft.category === calculatedTargetCategory;

            return (
              <div className={styles.budgetTargetFixedRow} key={draft.category}>
                <strong>{draft.category}</strong>
                <input
                  disabled={draft.category === "Taxes" || isCalculatedTarget}
                  min="0"
                  max="100"
                  onChange={(event) =>
                    updateDraft(
                      draft.category,
                      "net_target_percent",
                      event.target.value,
                    )
                  }
                  placeholder={draft.category === "Taxes" ? "-" : "0"}
                  step="0.01"
                  type="number"
                  value={
                    isCalculatedTarget
                      ? formatCalculatedTarget(calculatedNetTarget)
                      : draft.net_target_percent
                  }
                />
                <input
                  disabled={isCalculatedTarget}
                  min="0"
                  max="100"
                  onChange={(event) =>
                    updateDraft(
                      draft.category,
                      "gross_target_percent",
                      event.target.value,
                    )
                  }
                  placeholder="0"
                  step="0.01"
                  type="number"
                  value={
                    isCalculatedTarget
                      ? formatCalculatedTarget(calculatedGrossTarget)
                      : draft.gross_target_percent
                  }
                />
              </div>
            );
          })
        )}
        <button type="submit" disabled={!canSave || isLoading}>
          {isSaving ? "Saving" : "Save targets"}
        </button>
      </form>
    </ModalShell>
  );
};

export default BudgetTargetsModal;
