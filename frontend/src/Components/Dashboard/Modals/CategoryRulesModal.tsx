import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteRequest,
  getJson,
  postJson,
  putJson,
} from "../../../shared/apiClient";
import { dashboardPayloadKeys, resourceKeys } from "../dashboardQueryKeys";
import { manualExpenseCategories } from "../shared/constants";
import { removeById, upsertById } from "../shared/queryCache";
import { useReportedQueryError } from "../shared/useReportedQueryError";
import styles from "./index.module.css";
import shared from "../dashboard.shared.module.css";
import type { TransactionCategoryRule } from "../shared/types";
import ModalActionButton from "./ModalActionButton";
import ModalShell from "./ModalShell";

type CategoryRuleForm = {
  id?: number;
  original_category: string;
  vendor_name: string;
  match_type: TransactionCategoryRule["match_type"];
  manual_category: string;
};

type CategoryRulesModalProps = {
  onClose: () => void;
  onError: (message: string) => void;
};

type CategoryRulesResponse = {
  rules?: TransactionCategoryRule[];
};

type CategoryRuleResponse = {
  rule: TransactionCategoryRule;
};

const emptyRuleForm: CategoryRuleForm = {
  original_category: "",
  vendor_name: "",
  match_type: "contains",
  manual_category: "",
};

const ruleMatchTypeOptions: Array<{
  label: string;
  value: TransactionCategoryRule["match_type"];
}> = [
  { label: "Contains", value: "contains" },
  { label: "Begins with", value: "starts_with" },
  { label: "Exact", value: "exact" },
];

const CategoryRulesModal = ({ onClose, onError }: CategoryRulesModalProps) => {
  const [form, setForm] = useState<CategoryRuleForm>(emptyRuleForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const rulesQuery = useQuery({
    queryKey: resourceKeys.categoryRules,
    queryFn: async () => {
      const data = await getJson<CategoryRulesResponse>(
        "/api/transaction-category-rules",
        {},
        "Rules request failed",
      );

      return data.rules || [];
    },
  });
  const saveRuleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        original_category: form.original_category,
        vendor_name: form.vendor_name,
        match_type: form.match_type,
        manual_category: form.manual_category,
      };

      return form.id
        ? putJson<CategoryRuleResponse>(
            `/api/transaction-category-rules/${encodeURIComponent(form.id)}`,
            payload,
            {},
            "Rule save failed",
          )
        : postJson<CategoryRuleResponse>(
            "/api/transaction-category-rules",
            payload,
            {},
            "Rule save failed",
          );
    },
    onSuccess: async (data) => {
      queryClient.setQueryData<TransactionCategoryRule[]>(
        resourceKeys.categoryRules,
        (currentRules) =>
          upsertById(currentRules, data.rule, (a, b) =>
            a.vendor_name.localeCompare(b.vendor_name),
          ),
      );
      await queryClient.invalidateQueries({
        queryKey: dashboardPayloadKeys.root,
      });
      setForm(emptyRuleForm);
    },
    onError: (requestError) => {
      onError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save transaction rule",
      );
    },
  });
  const deleteRuleMutation = useMutation({
    mutationFn: (rule: TransactionCategoryRule) =>
      deleteRequest(
        `/api/transaction-category-rules/${encodeURIComponent(rule.id)}`,
        {},
        "Rule delete failed",
      ),
    onSuccess: async (_data, rule) => {
      queryClient.setQueryData<TransactionCategoryRule[]>(
        resourceKeys.categoryRules,
        (currentRules) => removeById(currentRules, rule.id),
      );
      await queryClient.invalidateQueries({
        queryKey: dashboardPayloadKeys.root,
      });
      if (form.id === rule.id) {
        setForm(emptyRuleForm);
      }
    },
    onError: (requestError) => {
      onError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete transaction rule",
      );
    },
    onSettled: () => setDeletingRuleId(null),
  });
  useReportedQueryError(
    rulesQuery.error,
    "Unable to load transaction rules",
    onError,
  );

  const filteredRules = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const rules = rulesQuery.data || [];

    if (!normalizedSearchTerm) {
      return rules;
    }

    return rules.filter((rule) =>
      [
        rule.vendor_name,
        rule.original_category,
        rule.manual_category,
        rule.match_type,
        rule.vendor_name_key,
        rule.original_category_key,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchTerm),
    );
  }, [rulesQuery.data, searchTerm]);

  const canSaveRule =
    !saveRuleMutation.isPending &&
    Boolean(form.original_category.trim()) &&
    Boolean(form.vendor_name.trim()) &&
    Boolean(form.manual_category.trim());

  const saveRule = async () => {
    if (!canSaveRule) {
      return;
    }

    saveRuleMutation.mutate();
  };

  const deleteRule = async (rule: TransactionCategoryRule) => {
    const shouldDelete = window.confirm(
      `Remove the rule for ${rule.vendor_name}?`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingRuleId(rule.id);
    deleteRuleMutation.mutate(rule);
  };

  return (
    <ModalShell ariaLabel="Transaction category rules" onClose={onClose}>
      <div className={styles.modalHeader}>
        <div>
          <h2>Category rules</h2>
          <p>Match Plaid category and vendor to a manual category.</p>
        </div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <form
        className={styles.ruleForm}
        onSubmit={(event) => {
          event.preventDefault();
          void saveRule();
        }}
      >
        <label>
          <span>Original category</span>
          <input
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                original_category: event.target.value,
              }))
            }
            value={form.original_category}
          />
        </label>
        <label>
          <span>Vendor/name</span>
          <input
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                vendor_name: event.target.value,
              }))
            }
            value={form.vendor_name}
          />
        </label>
        <label>
          <span>Manual category</span>
          <select
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                manual_category: event.target.value,
              }))
            }
            value={form.manual_category}
          >
            <option value="">Choose category</option>
            {manualExpenseCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Match</span>
          <select
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                match_type: event.target
                  .value as TransactionCategoryRule["match_type"],
              }))
            }
            value={form.match_type}
          >
            {ruleMatchTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={!canSaveRule}>
          {form.id ? "Update rule" : "Add rule"}
        </button>
      </form>

      <input
        className={styles.ruleSearch}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search rules"
        type="search"
        value={searchTerm}
      />

      <div className={styles.ruleList}>
        {rulesQuery.isLoading ? (
          <p className={shared.emptyText}>Loading rules...</p>
        ) : filteredRules.length === 0 ? (
          <p className={shared.emptyText}>No matching rules.</p>
        ) : (
          filteredRules.map((rule) => (
            <div className={styles.ruleRow} key={rule.id}>
              <span>
                <strong>{rule.vendor_name}</strong>
                <small>
                  {rule.original_category} ·{" "}
                  {ruleMatchTypeOptions.find(
                    (option) => option.value === rule.match_type,
                  )?.label || "Exact"}
                </small>
              </span>
              <strong>{rule.manual_category}</strong>
              <div className={styles.modalRowActions}>
                <ModalActionButton
                  onClick={() =>
                    setForm({
                      id: rule.id,
                      original_category: rule.original_category,
                      vendor_name: rule.vendor_name,
                      match_type: rule.match_type || "contains",
                      manual_category: rule.manual_category,
                    })
                  }
                >
                  Edit
                </ModalActionButton>
                <ModalActionButton
                  variant="danger"
                  disabled={deletingRuleId === rule.id}
                  onClick={() => deleteRule(rule)}
                >
                  {deletingRuleId === rule.id ? "Removing" : "Remove"}
                </ModalActionButton>
              </div>
            </div>
          ))
        )}
      </div>
    </ModalShell>
  );
};

export default CategoryRulesModal;
