import { getJson, postJson } from "../../../shared/apiClient";

export type CategorizationScope =
  | "user_only"
  | "user_and_starter_patterns";

export type CategorizationSuggestion = {
  id: number;
  batch_id: number;
  transaction_id: number;
  assigned_category: string | null;
  assigned_source: string;
  suggested_category: string;
  confidence: number;
  review_required: boolean;
  review_reasons: string[];
  evidence: {
    original_category?: string;
    vendor_name?: string;
    suggested_source?: string;
    [key: string]: unknown;
  };
  status: "pending" | "approved" | "edited" | "dismissed";
  approved_category: string | null;
  transaction: {
    id: number;
    amount: number;
    date: string;
    manual_date?: string | null;
    name: string;
    merchant_name: string | null;
    category: string | null;
    manual_category?: string | null;
    account_name: string;
    account_mask: string | null;
    institution_name?: string | null;
  };
};

export type CategorizationSuggestionGroup = {
  id: string;
  original_category: string;
  suggested_category: string;
  status: string;
  review_required: boolean;
  count: number;
  average_confidence: number;
  total_amount: number;
  review_reasons: string[];
  suggestions: CategorizationSuggestion[];
};

export type CategorizationBatchResponse = {
  batch: {
    id: number;
    user_id: number;
    month: string;
    scope: CategorizationScope;
    status: string;
    model_version: string;
    created_at: string;
    updated_at: string;
  };
  groups: CategorizationSuggestionGroup[];
  suggestions: CategorizationSuggestion[];
};

export const createCategorizationBatch = ({
  month,
  scope,
}: {
  month: string;
  scope: CategorizationScope;
}) =>
  postJson<CategorizationBatchResponse>(
    "/api/categorization-suggestions/batches",
    { month, scope },
    {},
    "Categorization assistant failed",
  );

export const getCategorizationBatch = (batchId: number) =>
  getJson<CategorizationBatchResponse>(
    `/api/categorization-suggestions/batches/${encodeURIComponent(batchId)}`,
    {},
    "Categorization batch failed",
  );

export const approveCategorizationSuggestions = ({
  batchId,
  suggestionIds,
  categoryOverrides,
}: {
  batchId: number;
  suggestionIds: number[];
  categoryOverrides?: Record<number, string>;
}) =>
  postJson<CategorizationBatchResponse>(
    `/api/categorization-suggestions/batches/${encodeURIComponent(
      batchId,
    )}/approve`,
    {
      suggestion_ids: suggestionIds,
      category_overrides: categoryOverrides || {},
    },
    {},
    "Categorization approval failed",
  );

export const dismissCategorizationSuggestion = (suggestionId: number) =>
  postJson<CategorizationBatchResponse>(
    `/api/categorization-suggestions/${encodeURIComponent(
      suggestionId,
    )}/dismiss`,
    undefined,
    {},
    "Categorization dismissal failed",
  );
