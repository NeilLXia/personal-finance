import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CreditCardRewardsPage from "./index";
import type { CreditCardRewardsData } from "./types";

const rewardsData: CreditCardRewardsData = {
  selected_month: "2026-08",
  accounts: [],
  card_types: [],
};

const renderRewardsPage = ({
  onCreateCardType = vi.fn().mockResolvedValue(undefined),
} = {}) => {
  render(
    <CreditCardRewardsPage
      data={rewardsData}
      error={null}
      isCreatingCardType={false}
      isDeletingCardType={false}
        isCardTypeManager={true}
      isLoading={false}
      isUpdating={false}
      isUpdatingCardType={false}
      isUpdatingPerkCompletion={false}
      onAccountTypeChange={vi.fn()}
      onBackToDashboard={vi.fn()}
      onCreateCardType={onCreateCardType}
      onDeleteCardType={vi.fn()}
      onPerkCompletionChange={vi.fn()}
      onUpdateCardType={vi.fn()}
    />,
  );

  return { onCreateCardType };
};

const selectCardTypeToEdit = (cardTypeName: string) => {
  const input = screen.getByRole("combobox", { name: /card type to edit/i });

  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: cardTypeName } });
  fireEvent.click(screen.getByRole("option", { name: cardTypeName }));
};

describe("CreditCardRewardsPage", () => {
  it("creates a credit card type with earning rates and perks", async () => {
    const { onCreateCardType } = renderRewardsPage();

    fireEvent.click(screen.getByRole("button", { name: /manage card types/i }));
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
          },
          {
            id: undefined,
            category: "Dining",
            keywords: null,
            reward_percent: 3,
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
          },
        ],
      }),
    );
  });

  it("creates a custom keyword category earning rate with a display name and comma-separated keywords", async () => {
    const { onCreateCardType } = renderRewardsPage();

    fireEvent.click(screen.getByRole("button", { name: /manage card types/i }));
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
            },
          ],
        }),
      ),
    );
  });

  it("selecting an existing card type in Manage card types populates the form for editing, preserving reward/perk ids on save", async () => {
    const onUpdateCardType = vi.fn().mockResolvedValue(undefined);

    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [
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
          accounts: [],
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={vi.fn()}
        onUpdateCardType={onUpdateCardType}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /manage card types/i }));
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
            { id: 21, category: "Base rate", keywords: null, reward_percent: 2 },
            {
              id: undefined,
              category: "Dining",
              keywords: null,
              reward_percent: 3,
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
            },
          ],
        },
      }),
    );
  });

  it("filters card types in the management selector by typed text", () => {
    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [
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
          accounts: [],
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={vi.fn()}
        onUpdateCardType={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /manage card types/i }));

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
    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [
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
          accounts: [
            {
              id: 1,
              name: "Rewards Card",
              mask: "1234",
              official_name: null,
              subtype: "credit card",
              type: "credit",
              institution_name: "Test Bank",
              credit_card_type_id: 11,
              credit_card_type: {
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
              effective_month: "01",
              perk_completions: [],
              earning_reward_totals: [],
            },
          ],
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={vi.fn()}
        onUpdateCardType={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /manage card types/i }));
    selectCardTypeToEdit("Rewards Card");

    expect((screen.getAllByLabelText("Rate")[0] as HTMLInputElement).value).toBe(
      "3",
    );
    expect((screen.getAllByLabelText("Rate")[1] as HTMLInputElement).value).toBe(
      "2.75",
    );

    fireEvent.click(screen.getByRole("button", { name: /card details/i }));

    expect(screen.queryByText("3%")).not.toBeNull();
    expect(screen.queryByText("2.75%")).not.toBeNull();
  });

  it("shows a Delete card type button only when editing an existing type, and confirms before deleting", async () => {
    const onDeleteCardType = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [
            {
              id: 11,
              name: "Travel Card",
              annual_fee: 100,
              earning_rewards: [],
              perk_awards: [],
            },
          ],
          accounts: [],
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={onDeleteCardType}
        onPerkCompletionChange={vi.fn()}
        onUpdateCardType={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /manage card types/i }));
    expect(
      screen.queryByRole("button", { name: /delete card type/i }),
    ).toBeNull();

    selectCardTypeToEdit("Travel Card");
    fireEvent.click(screen.getByRole("button", { name: /delete card type/i }));

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(onDeleteCardType).toHaveBeenCalledWith(11));

    confirmSpy.mockRestore();
  });

  it("shows earning reward amounts computed by the server instead of a flat $0", () => {
    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [],
          accounts: [
            {
              id: 7,
              name: "Rewards card",
              mask: "1234",
              official_name: null,
              subtype: "credit card",
              type: "credit",
              institution_name: "Test Bank",
              credit_card_type_id: 11,
              effective_month: "01",
              perk_completions: [],
              earning_reward_totals: [
                { earning_reward_id: 41, amount: 12.5 },
              ],
              credit_card_type: {
                id: 11,
                name: "Travel Card",
                annual_fee: 100,
                earning_rewards: [
                  {
                    id: 41,
                    category: "Dining",
                    reward_percent: 3,
                    keywords: null,
                  },
                ],
                perk_awards: [],
              },
            },
          ],
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={vi.fn()}
        onUpdateCardType={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Card details for Travel Card" }),
    );

    expect(screen.getAllByText("$12.50").length).toBeGreaterThan(0);
    expect(screen.getByText("$13/$100")).toBeTruthy();
  });

  it("opens a transaction modal for an earning reward category", () => {
    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [],
          accounts: [
            {
              id: 7,
              name: "Rewards card",
              mask: "1234",
              official_name: null,
              subtype: "credit card",
              type: "credit",
              institution_name: "Test Bank",
              credit_card_type_id: 11,
              effective_month: "01",
              perk_completions: [],
              earning_reward_totals: [
                { earning_reward_id: 41, amount: 3 },
              ],
              earning_reward_breakdowns: [
                {
                  earning_reward_id: 41,
                  amount: 3,
                  transactions: [
                    {
                      id: 101,
                      amount: 100,
                      date: "2026-08-10",
                      manual_date: null,
                      name: "CAFE CARD PURCHASE",
                      merchant_name: "Neighborhood Cafe",
                      category: "Restaurants",
                      manual_category: null,
                      display_category: "Dining",
                    },
                  ],
                },
              ],
              credit_card_type: {
                id: 11,
                name: "Travel Card",
                annual_fee: 100,
                earning_rewards: [
                  {
                    id: 41,
                    category: "Dining",
                    reward_percent: 3,
                    keywords: null,
                  },
                ],
                perk_awards: [],
              },
            },
          ],
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={vi.fn()}
        onUpdateCardType={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Card details for Travel Card" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /dining/i }));

    const dialog = screen.getByRole("dialog", { name: "Dining" });

    expect(dialog).toBeTruthy();
    expect(screen.getByText("Neighborhood Cafe")).toBeTruthy();
    expect(screen.getByText("CAFE CARD PURCHASE")).toBeTruthy();
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$3.00").length).toBeGreaterThan(0);

    fireEvent.mouseDown(dialog);
    expect(screen.queryByRole("dialog", { name: "Dining" })).not.toBeNull();

    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(screen.queryByRole("dialog", { name: "Dining" })).toBeNull();
  });

  it("renders the annual fee bar and checkboxes from persisted perk completions", () => {
    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [],
          accounts: [
            {
              id: 7,
              name: "Rewards card",
              mask: "1234",
              official_name: null,
              subtype: "credit card",
              type: "credit",
              institution_name: "Test Bank",
              credit_card_type_id: 11,
              effective_month: "01",
              perk_completions: [
                { perk_award_id: 31, occurrence_index: 0 },
                { perk_award_id: 31, occurrence_index: 1 },
              ],
              earning_reward_totals: [],
              credit_card_type: {
                id: 11,
                name: "Travel Card",
                annual_fee: 100,
                earning_rewards: [],
                perk_awards: [
                  {
                    id: 31,
                    name: "Monthly credit",
                    dollar_value: 10,
                    completion_amount: 0,
                    frequency_count: 1,
                    frequency_period: "per_month",
                    auto_complete: false,
                  },
                ],
              },
            },
          ],
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={vi.fn()}
        onUpdateCardType={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Card details for Travel Card" }),
    );

    expect(screen.getByText("$20/$100")).toBeTruthy();
    expect(
      (screen.getByLabelText("Jan") as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Feb") as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Mar") as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("reports checking and unchecking a perk to the parent instead of tracking it locally", () => {
    const onPerkCompletionChange = vi.fn();

    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [],
          accounts: [
            {
              id: 7,
              name: "Rewards card",
              mask: "1234",
              official_name: null,
              subtype: "credit card",
              type: "credit",
              institution_name: "Test Bank",
              credit_card_type_id: 11,
              effective_month: "01",
              perk_completions: [{ perk_award_id: 31, occurrence_index: 0 }],
              earning_reward_totals: [],
              credit_card_type: {
                id: 11,
                name: "Travel Card",
                annual_fee: 100,
                earning_rewards: [],
                perk_awards: [
                  {
                    id: 31,
                    name: "Monthly credit",
                    dollar_value: 120,
                    completion_amount: 0,
                    frequency_count: 1,
                    frequency_period: "per_month",
                    auto_complete: false,
                  },
                ],
              },
            },
          ],
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={onPerkCompletionChange}
        onUpdateCardType={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Card details for Travel Card" }),
    );

    fireEvent.click(screen.getByLabelText("Jan"));
    expect(onPerkCompletionChange).toHaveBeenCalledWith({
      accountId: 7,
      perkAwardId: 31,
      occurrenceIndex: 0,
      completed: false,
    });

    fireEvent.click(screen.getByLabelText("Feb"));
    expect(onPerkCompletionChange).toHaveBeenCalledWith({
      accountId: 7,
      perkAwardId: 31,
      occurrenceIndex: 1,
      completed: true,
    });
  });

  it("shows monthly perk checkboxes in calendar order while keeping cycle occurrence indexes", () => {
    const onPerkCompletionChange = vi.fn();

    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [],
          accounts: [
            {
              id: 7,
              name: "Rewards card",
              mask: "1234",
              official_name: null,
              subtype: "credit card",
              type: "credit",
              institution_name: "Test Bank",
              credit_card_type_id: 11,
              effective_month: "09",
              perk_completions: [],
              earning_reward_totals: [],
              credit_card_type: {
                id: 11,
                name: "Travel Card",
                annual_fee: 100,
                earning_rewards: [],
                perk_awards: [
                  {
                    id: 31,
                    name: "Monthly credit",
                    dollar_value: 10,
                    completion_amount: 0,
                    frequency_count: 1,
                    frequency_period: "per_month",
                    auto_complete: false,
                  },
                ],
              },
            },
          ],
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={onPerkCompletionChange}
        onUpdateCardType={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Card details for Travel Card" }),
    );

    const monthLabels = screen
      .getAllByText(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/)
      .map((element) => element.textContent);

    expect(monthLabels).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]);

    fireEvent.click(screen.getByLabelText("Jan"));

    expect(onPerkCompletionChange).toHaveBeenCalledWith({
      accountId: 7,
      perkAwardId: 31,
      occurrenceIndex: 4,
      completed: true,
    });
  });

  it("shows an effective month dropdown on the tile once a card type is assigned, and reports changes to it", () => {
    const onAccountTypeChange = vi.fn();

    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [
            {
              id: 11,
              name: "Travel Card",
              annual_fee: 100,
              earning_rewards: [],
              perk_awards: [],
            },
          ],
          accounts: [
            {
              id: 7,
              name: "Rewards card",
              mask: "1234",
              official_name: null,
              subtype: "credit card",
              type: "credit",
              institution_name: "Test Bank",
              credit_card_type_id: 11,
              effective_month: "03",
              perk_completions: [],
              earning_reward_totals: [],
              credit_card_type: {
                id: 11,
                name: "Travel Card",
                annual_fee: 100,
                earning_rewards: [],
                perk_awards: [],
              },
            },
          ],
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={onAccountTypeChange}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={vi.fn()}
        onUpdateCardType={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Card details for Travel Card" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Effective month for Rewards card" }),
    );
    const effectiveMonthSelect = screen.getByLabelText(
      "Effective month for Rewards card",
    );
    expect((effectiveMonthSelect as HTMLSelectElement).value).toBe("03");

    fireEvent.change(effectiveMonthSelect, { target: { value: "07" } });

    expect(onAccountTypeChange).toHaveBeenCalledWith({
      accountId: 7,
      creditCardTypeId: 11,
      effectiveMonth: "07",
    });
  });

  it("uses the editable chip selector for assigning a card type on a tile", () => {
    const onAccountTypeChange = vi.fn();

    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [
            {
              id: 11,
              name: "Travel Card",
              annual_fee: 100,
              earning_rewards: [],
              perk_awards: [],
            },
          ],
          accounts: [
            {
              id: 7,
              name: "Rewards card",
              mask: "1234",
              official_name: null,
              subtype: "credit card",
              type: "credit",
              institution_name: "Test Bank",
              credit_card_type_id: null,
              effective_month: null,
              perk_completions: [],
              earning_reward_totals: [],
              credit_card_type: null,
            },
          ],
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={onAccountTypeChange}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={vi.fn()}
        onUpdateCardType={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Card details for Rewards card" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Card type for Rewards card" }),
    );
    fireEvent.change(screen.getByLabelText("Card type for Rewards card"), {
      target: { value: "11" },
    });

    expect(onAccountTypeChange).toHaveBeenCalledWith({
      accountId: 7,
      creditCardTypeId: 11,
      effectiveMonth: expect.stringMatching(/^\d{2}$/),
    });
  });

  it("opens owned-card optimization from the summary button", () => {
    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [],
          accounts: [
            {
              id: 7,
              name: "Rewards card",
              mask: "1234",
              official_name: null,
              subtype: "credit card",
              type: "credit",
              institution_name: "Test Bank",
              credit_card_type_id: null,
              effective_month: null,
              perk_completions: [],
              earning_reward_totals: [],
              credit_card_type: null,
            },
          ],
          optimization: {
            period_start: "2025-09-01",
            period_end: "2026-08-31",
            actual_reward_value: 10,
            optimized_reward_value: 20,
            missed_reward_value: 10,
            recommendation_groups: [
              {
                group_type: "category",
                group_label: "Dining",
                actual_card_type_id: 1,
                actual_card_name: "Flat Card",
                recommended_card_type_id: 2,
                recommended_card_name: "Dining Card",
                transaction_count: 3,
                total_spend: 300,
                actual_reward_value: 3,
                optimized_reward_value: 12,
                missed_reward_value: 9,
                largest_missed_reward_value: 3,
                priority_score: 10,
                transactions: [],
              },
            ],
          },
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={vi.fn()}
        onUpdateCardType={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /optimize my earnings/i }));

    expect(
      screen.getByRole("dialog", { name: /optimize my earnings/i }),
    ).toBeTruthy();
    expect(screen.getByText("Owned card optimization")).toBeTruthy();
    expect(screen.getByText("Dining")).toBeTruthy();
    expect(screen.getByText("Use Dining Card instead of Flat Card")).toBeTruthy();
  });

  it("shows new-card recommendations and drills into the transactions behind one", () => {
    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [],
          accounts: [
            {
              id: 5,
              name: "Checking",
              mask: "5555",
              official_name: null,
              subtype: "checking",
              type: "depository",
              institution_name: "Test Bank",
              credit_card_type_id: null,
              effective_month: null,
              perk_completions: [],
              earning_reward_totals: [],
              credit_card_type: null,
            },
          ],
          card_recommendations: {
            period_start: "2025-09-01",
            period_end: "2026-08-31",
            best_overall: null,
            best_no_annual_fee: null,
            recommendations: [
              {
                card_type_id: 21,
                card_type_name: "Grocery Rewards Card",
                annual_fee: 0,
                transaction_count: 1,
                total_spend: 200,
                projected_reward_value: 12,
                additional_reward_value: 10,
                net_annual_value: 10,
                top_categories: [
                  {
                    category: "Groceries",
                    candidate_reward_category: "Groceries",
                    candidate_reward_percent: 6,
                    total_spend: 200,
                    current_reward_value: 2,
                    expected_reward_value: 12,
                    additional_reward_value: 10,
                    transaction_count: 1,
                  },
                ],
                category_breakdown: [
                  {
                    category: "Groceries",
                    candidate_reward_category: "Groceries",
                    candidate_reward_percent: 6,
                    total_spend: 200,
                    current_reward_value: 2,
                    expected_reward_value: 12,
                    additional_reward_value: 10,
                    transaction_count: 1,
                  },
                ],
                transactions: [
                  {
                    transaction: {
                      id: 99,
                      amount: 200,
                      date: "2026-08-05",
                      manual_date: null,
                      name: "WHOLE FOODS",
                      merchant_name: "Whole Foods",
                      category: null,
                      manual_category: null,
                      display_category: "Groceries",
                      account_id: 5,
                      account_label: "Checking **** 5555",
                    },
                    baseline_card_type_id: null,
                    baseline_card_name: null,
                    baseline_reward_value: 0,
                    candidate_reward_category: "Groceries",
                    candidate_reward_percent: 6,
                    candidate_reward_value: 12,
                    additional_reward_value: 10,
                  },
                ],
              },
            ],
          },
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={vi.fn()}
        onUpdateCardType={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /optimize my earnings/i }));
    fireEvent.click(screen.getByRole("tab", { name: /new cards/i }));

    expect(screen.getByText("Card to consider")).toBeTruthy();
    expect(screen.getByText("Grocery Rewards Card")).toBeTruthy();
    expect(screen.getByText("No annual fee")).toBeTruthy();
    expect(screen.getByText("Groceries - multiplier 6x")).toBeTruthy();
    expect(
      screen.getByText("+$10.00 (earning $2.00, expected $12.00)"),
    ).toBeTruthy();
    expect(screen.queryByText(/mostly on/i)).toBeNull();

    fireEvent.click(screen.getByText("Grocery Rewards Card"));

    expect(screen.getByText("Whole Foods")).toBeTruthy();
    expect(screen.getByText("No card earns on this today")).toBeTruthy();
    expect(
      screen.getByText("Use Grocery Rewards Card (Groceries, 6%)"),
    ).toBeTruthy();
  });

  it("shows an empty state when the new-card recommendations tab has no matches", () => {
    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [],
          accounts: [],
          card_recommendations: {
            period_start: "2025-09-01",
            period_end: "2026-08-31",
            best_overall: null,
            best_no_annual_fee: null,
            recommendations: [],
          },
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={vi.fn()}
        onUpdateCardType={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /optimize my earnings/i }));
    fireEvent.click(screen.getByRole("tab", { name: /new cards/i }));

    expect(screen.getByText("Card to consider")).toBeTruthy();
    expect(screen.getByText("No higher-earning cards found.")).toBeTruthy();
  });

  it("shows the rewards summary and optimization entry point", () => {
    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [],
          accounts: [
            {
              id: 7,
              name: "Rewards card",
              mask: "1234",
              official_name: null,
              subtype: "credit card",
              type: "credit",
              institution_name: "Test Bank",
              credit_card_type_id: 11,
              effective_month: "01",
              perk_completions: [],
              earning_reward_totals: [
                { earning_reward_id: 41, amount: 12 },
              ],
              earning_reward_breakdowns: [
                {
                  earning_reward_id: 41,
                  amount: 12,
                  transactions: [
                    {
                      id: 101,
                      amount: 400,
                      date: "2026-08-10",
                      manual_date: null,
                      name: "CAFE CARD PURCHASE",
                      merchant_name: "Neighborhood Cafe",
                      category: "Restaurants",
                      manual_category: null,
                      display_category: "Dining",
                    },
                  ],
                },
              ],
              credit_card_type: {
                id: 11,
                name: "Travel Card",
                annual_fee: 100,
                earning_rewards: [
                  {
                    id: 41,
                    category: "Dining",
                    reward_percent: 3,
                    keywords: null,
                  },
                ],
                perk_awards: [],
              },
            },
          ],
        }}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={true}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={vi.fn()}
        onUpdateCardType={vi.fn()}
      />,
    );

    expect(screen.getByText("Credit Card Expenses")).toBeTruthy();
    expect(screen.getByText("$400.00")).toBeTruthy();
    expect(screen.getByText("Earnings rewards")).toBeTruthy();
    expect(screen.getByText("Perks")).toBeTruthy();
    expect(screen.getByText("Annual fees")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /optimize my earnings/i }),
    ).toBeTruthy();
  });

  it("does not show card type management to non-managers", () => {
    render(
      <CreditCardRewardsPage
        data={rewardsData}
        error={null}
        isCreatingCardType={false}
        isDeletingCardType={false}
        isCardTypeManager={false}
        isLoading={false}
        isUpdating={false}
        isUpdatingCardType={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onCreateCardType={vi.fn()}
        onDeleteCardType={vi.fn()}
        onPerkCompletionChange={vi.fn()}
        onUpdateCardType={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /manage card types/i }),
    ).toBeNull();
  });
});
