import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClientWrapper } from "../../test/queryClient";
import { useCreditCardRewards } from "./useCreditCardRewards";
import type { CreditCardRewardsData } from "./types";

const creditCardRewardsApi = vi.hoisted(() => ({
  createCreditCardType: vi.fn(),
  fetchCreditCardRewards: vi.fn(),
  updateCreditCardAccountType: vi.fn(),
  updateCreditCardPerkCompletion: vi.fn(),
  updateCreditCardType: vi.fn(),
}));

vi.mock("./creditCardRewardsApi", () => creditCardRewardsApi);

const rewardsData: CreditCardRewardsData = {
  selected_month: "2026-09",
  accounts: [],
  card_types: [],
};

describe("useCreditCardRewards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    creditCardRewardsApi.fetchCreditCardRewards.mockResolvedValue(rewardsData);
    creditCardRewardsApi.createCreditCardType.mockResolvedValue(rewardsData);
    creditCardRewardsApi.updateCreditCardAccountType.mockResolvedValue(
      rewardsData,
    );
    creditCardRewardsApi.updateCreditCardPerkCompletion.mockResolvedValue(
      rewardsData,
    );
    creditCardRewardsApi.updateCreditCardType.mockResolvedValue(rewardsData);
  });

  it("fetches rewards for the selected dashboard month", async () => {
    renderHook(() => useCreditCardRewards({ selectedMonth: "2026-09" }), {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() =>
      expect(creditCardRewardsApi.fetchCreditCardRewards).toHaveBeenCalledWith(
        "2026-09",
      ),
    );
  });

  it("ties perk completion updates to the selected dashboard month", async () => {
    const { result } = renderHook(
      () => useCreditCardRewards({ selectedMonth: "2026-09" }),
      {
        wrapper: createQueryClientWrapper(),
      },
    );

    await waitFor(() =>
      expect(creditCardRewardsApi.fetchCreditCardRewards).toHaveBeenCalled(),
    );

    result.current.updatePerkCompletion({
      accountId: 7,
      perkAwardId: 31,
      occurrenceIndex: 0,
      completed: true,
    });

    await waitFor(() =>
      expect(
        creditCardRewardsApi.updateCreditCardPerkCompletion,
      ).toHaveBeenCalledWith({
        accountId: 7,
        perkAwardId: 31,
        occurrenceIndex: 0,
        completed: true,
        selectedMonth: "2026-09",
      }),
    );
  });

  it("does not expose mismatched month data but keeps the page available", async () => {
    creditCardRewardsApi.fetchCreditCardRewards.mockResolvedValueOnce({
      ...rewardsData,
      selected_month: "2026-08",
    });

    const { result } = renderHook(
      () => useCreditCardRewards({ selectedMonth: "2025-08" }),
      {
        wrapper: createQueryClientWrapper(),
      },
    );

    await waitFor(() =>
      expect(creditCardRewardsApi.fetchCreditCardRewards).toHaveBeenCalledWith(
        "2025-08",
      ),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.isAvailable).toBe(true);
  });
});
