import { describe, expect, it } from "vitest";

import {
  buildExpenseCategorySummaries,
  getExcludedTransactionCategory,
  getTransactionDisplayCategory,
  getVenmoDetails,
  normalizeDashboardData,
  summarizeExcludedTransactions,
  summarizeTransactionsByDisplayCategory,
} from "./dashboardDataUtils";
import type { CategoryTotal, Payslip, Transaction } from "./types";

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 1,
  name: "Store",
  amount: 10,
  date: "2026-03-15",
  merchant_name: null,
  category: null,
  pending: false,
  account_name: "Checking",
  account_mask: null,
  ...overrides,
});

describe("getTransactionDisplayCategory", () => {
  it("prefers display over manual over raw category", () => {
    expect(
      getTransactionDisplayCategory(
        transaction({
          display_category: "Groceries",
          manual_category: "Dining",
          category: "Food",
        }),
      ),
    ).toBe("Groceries");
  });

  it("falls back to Uncategorized", () => {
    expect(getTransactionDisplayCategory(transaction())).toBe("Uncategorized");
  });
});

describe("getExcludedTransactionCategory", () => {
  it("uses the manual category or Unassigned", () => {
    expect(
      getExcludedTransactionCategory(transaction({ manual_category: "Transfers" })),
    ).toBe("Transfers");
    expect(getExcludedTransactionCategory(transaction())).toBe("Unassigned");
  });
});

describe("summarizeTransactionsByDisplayCategory", () => {
  it("groups by category, flips the sign, and sorts by magnitude", () => {
    const result = summarizeTransactionsByDisplayCategory([
      transaction({ id: 1, amount: 10, category: "Dining" }),
      transaction({ id: 2, amount: 30, category: "Dining" }),
      transaction({ id: 3, amount: 100, category: "Housing" }),
    ]);

    expect(result).toEqual([
      { category: "Housing", amount: -100, count: 1 },
      { category: "Dining", amount: -40, count: 2 },
    ]);
  });

  it("treats negative Plaid amounts (inflows) as positive", () => {
    const [row] = summarizeTransactionsByDisplayCategory([
      transaction({ amount: -25, category: "Refunds" }),
    ]);
    expect(row).toMatchObject({ category: "Refunds", amount: 25 });
  });
});

describe("summarizeExcludedTransactions", () => {
  it("returns null when nothing is excluded", () => {
    expect(
      summarizeExcludedTransactions([transaction({ is_expense: true })]),
    ).toBeNull();
  });

  it("rolls non-expense rows into an Excluded group with Unassigned first", () => {
    const summary = summarizeExcludedTransactions([
      transaction({ id: 1, amount: 50, is_expense: false }),
      transaction({ id: 2, amount: 20, is_expense: false, manual_category: "Transfers" }),
    ]);

    expect(summary).not.toBeNull();
    expect(summary?.kind).toBe("excluded");
    expect(summary?.count).toBe(2);
    expect(summary?.children[0].category).toBe("Unassigned");
  });
});

describe("buildExpenseCategorySummaries", () => {
  it("folds known categories into their display group", () => {
    const categories: CategoryTotal[] = [
      { category: "Groceries", amount: -200, count: 3 },
      { category: "Dining", amount: -100, count: 5 },
      { category: "Rent", amount: -1500, count: 1 },
    ];
    const summaries = buildExpenseCategorySummaries(categories);

    const foodGroup = summaries.find((s) => s.category === "Food & dining");
    expect(foodGroup?.kind).toBe("group");
    expect(foodGroup?.amount).toBe(-300);
    expect(foodGroup?.children).toHaveLength(2);

    const rent = summaries.find((s) => s.category === "Rent");
    expect(rent?.kind).toBe("category");
    expect(rent?.children).toHaveLength(0);
  });
});

describe("getVenmoDetails", () => {
  it("returns null for non-Venmo transactions", () => {
    expect(getVenmoDetails(transaction({ name: "Grocery Store" }))).toBeNull();
  });

  it("extracts the quoted note and counterparty", () => {
    const details = getVenmoDetails(
      transaction({
        name: 'Venmo payment to Jane Doe "dinner split"',
        category: "Venmo",
        merchant_name: "Jane Doe",
      }),
    );
    expect(details).toEqual({ counterparty: "Jane Doe", note: "dinner split" });
  });
});

describe("normalizeDashboardData", () => {
  it("fills every section with safe defaults for an empty response", () => {
    const normalized = normalizeDashboardData({});

    expect(normalized.institutions).toEqual([]);
    expect(normalized.accounts).toEqual([]);
    expect(normalized.net_worth.current).toBe(0);
    expect(normalized.net_worth.history).toEqual([]);
    expect(normalized.net_worth.categories.length).toBeGreaterThan(0);
    expect(normalized.monthly_cash_flow.months).toEqual([]);
    expect(normalized.income_allocation.income).toBe(0);
    expect(normalized.income_allocation.transactions).toEqual([]);
    expect(normalized.transaction_range.range).toBe(1);
    expect(normalized.latest_transactions).toEqual([]);
    expect(normalized.payslips).toEqual([]);
  });

  it("passes provided values through untouched", () => {
    const normalized = normalizeDashboardData({
      net_worth: { current: 42, history: [] },
      payslips: [],
      latest_transactions: [transaction({ id: 7 })],
    });

    expect(normalized.net_worth.current).toBe(42);
    expect(normalized.latest_transactions[0].id).toBe(7);
  });

  it("falls back to top-level payslips for income allocation payslips", () => {
    const payslip = { id: 3 } as unknown as Payslip;
    const normalized = normalizeDashboardData({ payslips: [payslip] });
    expect(normalized.income_allocation.payslips).toEqual([payslip]);
  });
});
