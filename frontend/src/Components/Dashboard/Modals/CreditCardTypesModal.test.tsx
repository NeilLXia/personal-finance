import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreditCardTypesPanel } from "./CreditCardTypesModal";
import type { CreditCardType } from "../../CreditCardRewards/types";

const renderPanel = ({
  cardTypes = [] as CreditCardType[],
  isDeleting = false,
  isImportingVectorMintCards = false,
  isSaving = false,
  onCreateCardType = vi.fn().mockResolvedValue(undefined),
  onUpdateCardType = vi.fn().mockResolvedValue(undefined),
  onDeleteCardType = vi.fn().mockResolvedValue(undefined),
  onImportVectorMintCards = vi.fn().mockResolvedValue({
    import_summary: {
      fetched_count: 2,
      matched_count: 1,
      created_review_count: 1,
      updated_count: 1,
      unchanged_count: 0,
      benefits_added_count: 3,
      benefits_updated_count: 0,
      benefits_preserved_count: 0,
      review_required_count: 1,
      warnings: [],
    },
    rewards: { selected_month: "2026-09", accounts: [], card_types: [] },
  }),
} = {}) => {
  render(
    <CreditCardTypesPanel
      cardTypes={cardTypes}
      isDeleting={isDeleting}
      isImportingVectorMintCards={isImportingVectorMintCards}
      isSaving={isSaving}
      onCreateCardType={onCreateCardType}
      onUpdateCardType={onUpdateCardType}
      onDeleteCardType={onDeleteCardType}
      onImportVectorMintCards={onImportVectorMintCards}
    />,
  );

  return {
    onCreateCardType,
    onUpdateCardType,
    onDeleteCardType,
    onImportVectorMintCards,
  };
};

const selectCardTypeToEdit = (cardTypeName: string) => {
  const input = screen.getByRole("combobox", { name: /card type to edit/i });

  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: cardTypeName } });
  fireEvent.click(screen.getByRole("option", { name: cardTypeName }));
};

describe("CreditCardTypesPanel", () => {
  it("creates a credit card type with earning rates and perks", async () => {
    const { onCreateCardType } = renderPanel();

    fireEvent.change(screen.getByLabelText("Credit card type"), {
      target: { value: "Chase Sapphire Preferred" },
    });
    fireEvent.change(screen.getByLabelText("Annual fee"), {
      target: { value: "1,095" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add earning rate/i }));
    fireEvent.change(screen.getAllByLabelText("Category")[1], {
      target: { value: "Dining" },
    });
    fireEvent.change(screen.getAllByLabelText("Rate")[1], {
      target: { value: "3" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add perk/i }));
    fireEvent.change(screen.getByLabelText("Perk"), {
      target: { value: "Travel credit" },
    });
    fireEvent.change(screen.getByLabelText("Value"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText("Times"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Frequency"), {
      target: { value: "per_month" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save card type/i }));

    await waitFor(() =>
      expect(onCreateCardType).toHaveBeenCalledWith({
        name: "Chase Sapphire Preferred",
        annual_fee: 1095,
        earning_rewards: [
          {
            id: undefined,
            category: "Base rate",
            keywords: null,
            reward_percent: 0,
            status: "included",
            source: undefined,
            source_description: null,
            status_reason: null,
            match_strategy: null,
          },
          {
            id: undefined,
            category: "Dining",
            keywords: null,
            reward_percent: 3,
            status: "included",
            source: undefined,
            source_description: null,
            status_reason: null,
            match_strategy: null,
          },
        ],
        perk_awards: [
          {
            id: undefined,
            name: "Travel credit",
            dollar_value: 50,
            frequency_count: 2,
            frequency_period: "per_month",
            auto_complete: false,
            status: "included",
            source: undefined,
            source_description: null,
            status_reason: null,
            match_strategy: null,
          },
        ],
      }),
    );
  });

  it("creates a custom keyword category earning rate with a display name and comma-separated keywords", async () => {
    const { onCreateCardType } = renderPanel();

    fireEvent.change(screen.getByLabelText("Credit card type"), {
      target: { value: "Coffee Card" },
    });
    fireEvent.change(screen.getByLabelText("Annual fee"), {
      target: { value: "0" },
    });

    fireEvent.change(screen.getAllByLabelText("Category")[0], {
      target: { value: "__custom_category__" },
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Coffee shops" },
    });
    fireEvent.change(screen.getByLabelText("Keywords (comma-separated)"), {
      target: { value: "starbucks, blue bottle" },
    });
    fireEvent.change(screen.getAllByLabelText("Rate")[0], {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save card type/i }));

    await waitFor(() =>
      expect(onCreateCardType).toHaveBeenCalledWith(
        expect.objectContaining({
          earning_rewards: [
            {
              id: undefined,
              category: "Coffee shops",
              keywords: "starbucks, blue bottle",
              reward_percent: 5,
              status: "included",
              source: undefined,
              source_description: null,
              status_reason: null,
              match_strategy: null,
            },
          ],
        }),
      ),
    );
  });

  it("selecting an existing card type populates the form for editing, preserving reward/perk ids on save", async () => {
    const { onUpdateCardType } = renderPanel({
      cardTypes: [
        {
          id: 11,
          name: "Travel Card",
          annual_fee: 100,
          earning_rewards: [
            {
              id: 21,
              category: "Base rate",
              reward_percent: 1,
              keywords: null,
            },
          ],
          perk_awards: [
            {
              id: 31,
              name: "Travel credit",
              dollar_value: 50,
              completion_amount: 0,
              frequency_count: 1,
              frequency_period: "per_year",
              auto_complete: false,
            },
          ],
        },
      ],
    });

    selectCardTypeToEdit("Travel Card");

    expect((screen.getByLabelText("Credit card type") as HTMLInputElement).value).toBe(
      "Travel Card",
    );
    expect((screen.getAllByLabelText("Category")[0] as HTMLSelectElement).value).toBe(
      "Base rate",
    );

    fireEvent.change(screen.getAllByLabelText("Rate")[0], {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add earning rate/i }));
    fireEvent.change(screen.getAllByLabelText("Category")[1], {
      target: { value: "Dining" },
    });
    fireEvent.change(screen.getAllByLabelText("Rate")[1], {
      target: { value: "3" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(onUpdateCardType).toHaveBeenCalledWith({
        cardTypeId: 11,
        input: {
          name: "Travel Card",
          annual_fee: 100,
          earning_rewards: [
            {
              id: 21,
              category: "Base rate",
              keywords: null,
              reward_percent: 2,
              status: "included",
              source: undefined,
              source_description: null,
              status_reason: null,
              match_strategy: null,
            },
            {
              id: undefined,
              category: "Dining",
              keywords: null,
              reward_percent: 3,
              status: "included",
              source: undefined,
              source_description: null,
              status_reason: null,
              match_strategy: null,
            },
          ],
          perk_awards: [
            {
              id: 31,
              name: "Travel credit",
              dollar_value: 50,
              frequency_count: 1,
              frequency_period: "per_year",
              auto_complete: false,
              status: "included",
              source: undefined,
              source_description: null,
              status_reason: null,
              match_strategy: null,
            },
          ],
        },
      }),
    );
  });

  it("filters card types in the selector by typed text", () => {
    renderPanel({
      cardTypes: [
        {
          id: 11,
          name: "Chase Sapphire Preferred",
          annual_fee: 95,
          earning_rewards: [],
          perk_awards: [],
        },
        {
          id: 12,
          name: "Chase Freedom Unlimited",
          annual_fee: 0,
          earning_rewards: [],
          perk_awards: [],
        },
      ],
    });

    const input = screen.getByRole("combobox", { name: /card type to edit/i });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "sapp" } });

    expect(
      screen.queryByRole("option", { name: "Chase Freedom Unlimited" }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("option", { name: "Chase Sapphire Preferred" }),
    );

    expect((screen.getByLabelText("Credit card type") as HTMLInputElement).value).toBe(
      "Chase Sapphire Preferred",
    );
  });

  it("shows database fixed-scale reward percentages without trailing zeros", () => {
    renderPanel({
      cardTypes: [
        {
          id: 11,
          name: "Rewards Card",
          annual_fee: 0,
          earning_rewards: [
            {
              id: 21,
              category: "Drug Stores",
              reward_percent: "3.0000" as unknown as number,
              keywords: "Pharmacy",
            },
            {
              id: 22,
              category: "Base rate",
              reward_percent: "2.7500" as unknown as number,
              keywords: null,
            },
          ],
          perk_awards: [],
        },
      ],
    });

    selectCardTypeToEdit("Rewards Card");

    expect((screen.getAllByLabelText("Rate")[0] as HTMLInputElement).value).toBe(
      "3",
    );
    expect((screen.getAllByLabelText("Rate")[1] as HTMLInputElement).value).toBe(
      "2.75",
    );
  });

  it("shows a Delete card type button only when editing an existing type, and confirms before deleting", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onDeleteCardType } = renderPanel({
      cardTypes: [
        {
          id: 11,
          name: "Travel Card",
          annual_fee: 100,
          earning_rewards: [],
          perk_awards: [],
        },
      ],
    });

    expect(
      screen.queryByRole("button", { name: /delete card type/i }),
    ).toBeNull();

    selectCardTypeToEdit("Travel Card");
    fireEvent.click(screen.getByRole("button", { name: /delete card type/i }));

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(onDeleteCardType).toHaveBeenCalledWith(11));

    confirmSpy.mockRestore();
  });

  it("imports VectorMint data and opens the review queue", async () => {
    const { onImportVectorMintCards } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /update from vectormint/i }));

    await waitFor(() =>
      expect(onImportVectorMintCards).toHaveBeenCalledTimes(1),
    );
    expect(screen.getByText(/vectormint checked 2 cards/i)).toBeTruthy();
    expect(
      screen.getByText(/no imported cards or benefits need review/i),
    ).toBeTruthy();
  });

  it("loads an imported review card into the management form", () => {
    renderPanel({
      cardTypes: [
        {
          id: 40,
          name: "Imported Card",
          annual_fee: 95,
          status: "in_review",
          review_reason: "New VectorMint card import needs admin review.",
          earning_rewards: [
            {
              id: 41,
              category: "Amex Travel Hotels",
              reward_percent: 5,
              keywords: "Amex Travel",
              status: "needs_review",
              source_description: "5x hotels booked through Amex Travel",
              status_reason: "Review transaction labels before including.",
            },
          ],
          perk_awards: [],
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /review imports/i }));
    fireEvent.click(screen.getByRole("button", { name: /imported card/i }));

    expect((screen.getByLabelText("Credit card type") as HTMLInputElement).value).toBe(
      "Imported Card",
    );
    expect(screen.getByText(/review transaction labels/i)).toBeTruthy();
  });

  it("does not keep a fully-reviewed card in the review list just because it has an excluded benefit", () => {
    renderPanel({
      cardTypes: [
        {
          id: 41,
          name: "Resolved Card",
          annual_fee: 0,
          status: "active",
          review_reason: null,
          earning_rewards: [
            {
              id: 42,
              category: "Unmapped earning",
              reward_percent: 0,
              keywords: null,
              status: "excluded",
              status_reason: "Reward category does not map to a tracked transaction category.",
            },
          ],
          perk_awards: [],
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /review imports/i }));

    expect(
      screen.getByText(/no imported cards or benefits need review/i),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /resolved card/i })).toBeNull();
  });
});
