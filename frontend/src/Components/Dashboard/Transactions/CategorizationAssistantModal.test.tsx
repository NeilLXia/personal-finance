import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createQueryClientWrapper,
  createTestQueryClient,
} from "../../../test/queryClient";
import CategorizationAssistantModal from "./CategorizationAssistantModal";
import type * as categorizationAssistantApi from "./categorizationAssistantApi";
import type {
  CategorizationBatchResponse,
} from "./categorizationAssistantApi";

const api = vi.hoisted(() => ({
  approveCategorizationSuggestions: vi.fn(),
  createCategorizationBatch: vi.fn(),
  dismissCategorizationSuggestion: vi.fn(),
}));

vi.mock("./categorizationAssistantApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof categorizationAssistantApi>();

  return {
    ...actual,
    ...api,
  };
});

const batchResponse: CategorizationBatchResponse = {
  batch: {
    id: 9,
    user_id: 1,
    month: "2026-08",
    scope: "user_and_starter_patterns",
    status: "pending",
    model_version: "categorization-scorer-v1",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  },
  groups: [
    {
      id: "Shops::Shopping::pending::review",
      original_category: "Shops",
      suggested_category: "Shopping",
      status: "pending",
      review_required: true,
      count: 1,
      average_confidence: 0.78,
      total_amount: 25,
      review_reasons: ["ambiguous_vendor"],
      suggestions: [
        {
          id: 11,
          batch_id: 9,
          transaction_id: 100,
          assigned_category: "Shops",
          assigned_source: "plaid_default",
          suggested_category: "Shopping",
          confidence: 0.78,
          review_required: true,
          review_reasons: ["ambiguous_vendor"],
          evidence: {
            original_category: "Shops",
            vendor_name: "Amazon",
            suggested_source: "starter_pattern",
            starter_vendor_matches: 12,
          },
          status: "pending",
          approved_category: null,
          transaction: {
            id: 100,
            amount: 25,
            date: "2026-08-12",
            manual_date: null,
            name: "Amazon Marketplace",
            merchant_name: "Amazon",
            category: "Shops",
            manual_category: null,
            account_name: "Rewards Card",
            account_mask: "1234",
            institution_name: "Bank",
          },
        },
      ],
    },
  ],
  suggestions: [],
};

const renderModal = () =>
  render(
    <CategorizationAssistantModal
      month="2026-08"
      onClose={vi.fn()}
      onError={vi.fn()}
    />,
    { wrapper: createQueryClientWrapper(createTestQueryClient()) },
  );

describe("CategorizationAssistantModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.createCategorizationBatch.mockResolvedValue(batchResponse);
    api.approveCategorizationSuggestions.mockResolvedValue({
      ...batchResponse,
      groups: [],
    });
    api.dismissCategorizationSuggestion.mockResolvedValue({
      ...batchResponse,
      groups: [],
    });
  });

  it("runs a batch and approves the selected group by explicit id", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /run assistant/i }));

    await screen.findByRole("heading", { name: "Shops to Shopping" });
    expect(
      screen.getByText(
        "Confidence - 78%: matched 12 starter transactions for this vendor",
      ),
    ).toBeTruthy();
    expect(api.createCategorizationBatch).toHaveBeenCalledWith({
      month: "2026-08",
      scope: "user_and_starter_patterns",
    });

    expect(
      screen.queryByRole("button", { name: /approve all visible/i }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /approve this group/i }));

    await waitFor(() =>
      expect(api.approveCategorizationSuggestions).toHaveBeenCalledWith({
        batchId: 9,
        suggestionIds: [11],
        categoryOverrides: {},
      }),
    );
  });
});
