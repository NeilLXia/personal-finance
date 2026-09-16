import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CreditCardRewardsPage from "./index";

describe("CreditCardRewardsPage", () => {
  it("shows database fixed-scale reward percentages without trailing zeros", () => {
    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [],
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
        isLoading={false}
        isUpdating={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onPerkCompletionChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /card details/i }));

    expect(screen.queryByText("3%")).not.toBeNull();
    expect(screen.queryByText("2.75%")).not.toBeNull();
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
        isLoading={false}
        isUpdating={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onPerkCompletionChange={vi.fn()}
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
        isLoading={false}
        isUpdating={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onPerkCompletionChange={vi.fn()}
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
        isLoading={false}
        isUpdating={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onPerkCompletionChange={vi.fn()}
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
        isLoading={false}
        isUpdating={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onPerkCompletionChange={onPerkCompletionChange}
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
        isLoading={false}
        isUpdating={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onPerkCompletionChange={onPerkCompletionChange}
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

  it("shows a benefit cycle chip with month-only selection and snaps after changes", () => {
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
              effective_month: "11",
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
        isLoading={false}
        isUpdating={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={onAccountTypeChange}
        onBackToDashboard={vi.fn()}
        onPerkCompletionChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Card details for Travel Card" }),
    );

    expect(screen.getByText("Benefit cycle")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Benefit cycle for Rewards card" })
        .textContent,
    ).toBe("November 2025 - October 2026");

    fireEvent.click(
      screen.getByRole("button", { name: "Benefit cycle for Rewards card" }),
    );
    expect(
      screen.getByRole("listbox", { name: "Benefit cycle for Rewards card" }),
    ).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Benefit cycle" })).toBeNull();
    const selectedMonthOption = screen.getByRole("option", { name: "November" });
    expect(selectedMonthOption.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(selectedMonthOption);
    const julyOption = screen.getByRole("option", { name: "July" });
    expect(julyOption).toBeTruthy();

    fireEvent.click(julyOption);

    expect(
      screen.queryByRole("listbox", {
        name: "Benefit cycle for Rewards card",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Benefit cycle for Rewards card" })
        .textContent,
    ).toBe("July 2026 - June 2027");

    expect(onAccountTypeChange).toHaveBeenCalledWith({
      accountId: 7,
      creditCardTypeId: 11,
      effectiveMonth: "07",
    });
  });

  it("uses the searchable chip selector for assigning a card type on a tile", () => {
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
        isLoading={false}
        isUpdating={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={onAccountTypeChange}
        onBackToDashboard={vi.fn()}
        onPerkCompletionChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Card details for Rewards card" }),
    );

    const cardTypeInput = screen.getByRole("combobox", {
      name: "Card type for Rewards card",
    });

    fireEvent.focus(cardTypeInput);
    fireEvent.click(screen.getByRole("option", { name: "Travel Card" }));

    expect(onAccountTypeChange).toHaveBeenCalledWith({
      accountId: 7,
      creditCardTypeId: 11,
      effectiveMonth: expect.stringMatching(/^\d{2}$/),
    });
  });

  it("opens owned-card optimization from the summary button", () => {
    const onLoadOptimization = vi.fn();

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
        }}
        optimizationData={{
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
          card_recommendations: {
            period_start: "2025-09-01",
            period_end: "2026-08-31",
            best_overall: null,
            best_no_annual_fee: null,
            recommendations: [],
          },
        }}
        error={null}
        isLoading={false}
        isUpdating={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onLoadOptimization={onLoadOptimization}
        onPerkCompletionChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /optimize my earnings/i }));

    expect(onLoadOptimization).toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: /optimize my earnings/i }),
    ).toBeTruthy();
    expect(screen.getByText("Owned card optimization")).toBeTruthy();
    expect(screen.getByText("Dining")).toBeTruthy();
    expect(screen.getByText("Use Dining Card instead of Flat Card")).toBeTruthy();
  });

  it("keeps the optimization modal open while analysis is loading", () => {
    render(
      <CreditCardRewardsPage
        data={{
          selected_month: "2026-08",
          card_types: [],
          accounts: [],
        }}
        isOptimizationLoading
        error={null}
        isLoading={false}
        isUpdating={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onPerkCompletionChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /optimize my earnings/i }));

    expect(
      screen.getByRole("dialog", { name: /optimize my earnings/i }),
    ).toBeTruthy();
    expect(screen.getByText("Analyzing rewards activity.")).toBeTruthy();
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
        }}
        optimizationData={{
          optimization: {
            period_start: "2025-09-01",
            period_end: "2026-08-31",
            actual_reward_value: 0,
            optimized_reward_value: 0,
            missed_reward_value: 0,
            recommendation_groups: [],
          },
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
        isLoading={false}
        isUpdating={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onPerkCompletionChange={vi.fn()}
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
        }}
        optimizationData={{
          optimization: {
            period_start: "2025-09-01",
            period_end: "2026-08-31",
            actual_reward_value: 0,
            optimized_reward_value: 0,
            missed_reward_value: 0,
            recommendation_groups: [],
          },
          card_recommendations: {
            period_start: "2025-09-01",
            period_end: "2026-08-31",
            best_overall: null,
            best_no_annual_fee: null,
            recommendations: [],
          },
        }}
        error={null}
        isLoading={false}
        isUpdating={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onPerkCompletionChange={vi.fn()}
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
        isLoading={false}
        isUpdating={false}
        isUpdatingPerkCompletion={false}
        onAccountTypeChange={vi.fn()}
        onBackToDashboard={vi.fn()}
        onPerkCompletionChange={vi.fn()}
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
});
