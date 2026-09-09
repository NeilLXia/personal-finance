import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardPayloadKeys } from "../dashboardQueryKeys";
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from "../../../test/queryClient";
import { useTransactions } from "./useTransactions";

const transactionsApi = vi.hoisted(() => ({
  updateTransactionManualDate: vi.fn(),
  updateTransactionsCategoryRules: vi.fn(),
}));

vi.mock("./transactionsApi", () => transactionsApi);

describe("useTransactions mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionsApi.updateTransactionManualDate.mockResolvedValue(undefined);
    transactionsApi.updateTransactionsCategoryRules.mockResolvedValue(
      undefined,
    );
  });

  it("invalidates dashboard queries after saving a manual category", async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () =>
        useTransactions({
          activeTransactionTab: "expenses",
          data: null,
          selectedTransactionCategories: [],
          transactionsInSelectedRange: [],
          setActiveTransactionTab: vi.fn(),
          onError: vi.fn(),
        }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    result.current.saveManualCategory(42, "Dining");

    await waitFor(() =>
      expect(
        transactionsApi.updateTransactionsCategoryRules,
      ).toHaveBeenCalledWith([42], "Dining"),
    );

    expect(result.current.savingCategoryTransactionId).toBe(null);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: dashboardPayloadKeys.root,
    });
  });

  it("invalidates dashboard queries after saving a manual transaction date", async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () =>
        useTransactions({
          activeTransactionTab: "expenses",
          data: null,
          selectedTransactionCategories: [],
          transactionsInSelectedRange: [],
          setActiveTransactionTab: vi.fn(),
          onError: vi.fn(),
        }),
      { wrapper: createQueryClientWrapper(queryClient) },
    );

    result.current.saveManualDate(42, "2026-08-12");

    await waitFor(() =>
      expect(transactionsApi.updateTransactionManualDate).toHaveBeenCalledWith(
        42,
        "2026-08-12",
      ),
    );

    expect(result.current.savingDateTransactionId).toBe(null);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: dashboardPayloadKeys.root,
    });
  });
});
