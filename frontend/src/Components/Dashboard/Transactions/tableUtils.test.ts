import { describe, expect, it } from "vitest";

import {
  buildSortedPayslips,
  buildSortedTransactions,
  getPayslipSelectionSummary,
  getSignedTransactionAmount,
  getTransactionSearchName,
  getTransactionSelectionSummary,
  isDateWithinPayPeriod,
} from "./tableUtils";
import type { Payslip, Transaction } from "../shared/types";

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

const payslip = (overrides: Partial<Payslip> = {}): Payslip =>
  ({
    id: 1,
    pay_period_begin: "2026-03-01",
    pay_period_end: "2026-03-15",
    check_date: "2026-03-20",
    gross_pay: 5000,
    ...overrides,
  }) as Payslip;

describe("getSignedTransactionAmount", () => {
  it("flips Plaid's sign convention", () => {
    expect(getSignedTransactionAmount(transaction({ amount: 50 }))).toBe(-50);
    expect(getSignedTransactionAmount(transaction({ amount: -50 }))).toBe(50);
    expect(getSignedTransactionAmount(transaction({ amount: 0 }))).toBe(0);
  });
});

describe("getTransactionSearchName", () => {
  it("concatenates identity fields lowercased", () => {
    expect(
      getTransactionSearchName(
        transaction({
          merchant_name: "Blue Bottle",
          name: "BLUEBOTTLE SF",
          account_mask: "1234",
        }),
      ),
    ).toBe("blue bottle bluebottle sf checking 1234");
  });
});

describe("getTransactionSelectionSummary", () => {
  it("summarizes count, date range and signed total", () => {
    const summary = getTransactionSelectionSummary([
      transaction({ id: 1, amount: 20, date: "2026-03-01" }),
      transaction({ id: 2, amount: 30, date: "2026-03-10" }),
    ]);

    expect(summary.count).toBe("2 transactions");
    expect(summary.amountTotal).toBe("-$50.00 total");
    expect(summary.dateRange).toContain(" - ");
  });

  it("handles the single-transaction case", () => {
    const summary = getTransactionSelectionSummary([
      transaction({ amount: 20 }),
    ]);
    expect(summary.count).toBe("1 transaction");
    expect(summary.dateRange).not.toContain(" - ");
  });
});

describe("isDateWithinPayPeriod", () => {
  it("is true only for an ISO date inside the pay period", () => {
    const slip = payslip();
    expect(isDateWithinPayPeriod("2026-03-10", slip)).toBe(true);
    expect(isDateWithinPayPeriod("2026-03-20", slip)).toBe(false);
    expect(isDateWithinPayPeriod("march", slip)).toBe(false);
  });
});

describe("getPayslipSelectionSummary", () => {
  it("sums gross pay and reports the pay-period span", () => {
    const summary = getPayslipSelectionSummary([
      payslip({ id: 1, gross_pay: 5000 }),
      payslip({ id: 2, gross_pay: 2500, pay_period_end: "2026-03-31" }),
    ]);
    expect(summary.count).toBe("2 payslips");
    expect(summary.amountTotal).toBe("$7,500.00 gross");
  });
});

describe("buildSortedTransactions", () => {
  const rows = [
    transaction({ id: 1, name: "Alpha", amount: 30, date: "2026-03-01" }),
    transaction({ id: 2, name: "Bravo", amount: 10, date: "2026-03-03" }),
    transaction({ id: 3, name: "Charlie", amount: 20, date: "2026-03-02" }),
  ];

  it("sorts by date descending by default direction arg", () => {
    const sorted = buildSortedTransactions({
      transactions: rows,
      searchTerms: { name: "", date: "", amount: "" },
      sortColumn: "date",
      sortDirection: "desc",
    });
    expect(sorted.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("sorts by signed amount ascending", () => {
    const sorted = buildSortedTransactions({
      transactions: rows,
      searchTerms: { name: "", date: "", amount: "" },
      sortColumn: "amount",
      sortDirection: "asc",
    });
    // signed amounts are -30, -10, -20 -> ascending is -30, -20, -10
    expect(sorted.map((r) => r.id)).toEqual([1, 3, 2]);
  });

  it("filters by the name search term", () => {
    const sorted = buildSortedTransactions({
      transactions: rows,
      searchTerms: { name: "brav", date: "", amount: "" },
      sortColumn: "date",
      sortDirection: "desc",
    });
    expect(sorted.map((r) => r.id)).toEqual([2]);
  });
});

describe("buildSortedPayslips", () => {
  const rows = [
    payslip({
      id: 1,
      employer_name: "Bravo Co",
      check_date: "2026-03-03",
      gross_pay: 1000,
    }),
    payslip({
      id: 2,
      employer_name: "Alpha Co",
      check_date: "2026-03-01",
      gross_pay: 3000,
    }),
    payslip({
      id: 3,
      employer_name: "Charlie Co",
      check_date: "2026-03-02",
      gross_pay: 2000,
    }),
  ];

  it("sorts by company ascending", () => {
    const sorted = buildSortedPayslips({
      payslips: rows,
      searchTerms: { amount: "", company: "", date: "" },
      sortColumn: "company",
      sortDirection: "asc",
    });

    expect(sorted.map((row) => row.id)).toEqual([2, 1, 3]);
  });

  it("filters by a date inside the pay period", () => {
    const sorted = buildSortedPayslips({
      payslips: rows,
      searchTerms: { amount: "", company: "", date: "2026-03-10" },
      sortColumn: "date",
      sortDirection: "desc",
    });

    expect(sorted.map((row) => row.id)).toEqual([1, 3, 2]);
  });
});
