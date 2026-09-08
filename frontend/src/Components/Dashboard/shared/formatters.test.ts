import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatDateRange,
  formatShortDate,
  formatTransactionAmount,
  getDateInputValue,
  getDefaultDashboardMonth,
  getTransactionEffectiveDate,
} from "./formatters";
import type { Transaction } from "./types";

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 1,
  name: "Coffee",
  amount: 4.5,
  date: "2026-03-15",
  merchant_name: null,
  category: null,
  pending: false,
  account_name: "Checking",
  account_mask: null,
  ...overrides,
});

describe("formatCurrency", () => {
  it("formats numbers as USD", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatCurrency("2000")).toBe("$2,000.00");
  });

  it("treats null/undefined/empty as zero", () => {
    expect(formatCurrency(null)).toBe("$0.00");
    expect(formatCurrency(undefined)).toBe("$0.00");
    expect(formatCurrency("")).toBe("$0.00");
  });
});

describe("formatCompactCurrency", () => {
  it("uses compact notation", () => {
    expect(formatCompactCurrency(1_500_000)).toBe("$1.5M");
    expect(formatCompactCurrency(2_000)).toBe("$2K");
  });
});

describe("formatTransactionAmount", () => {
  it("flips Plaid sign: positive spend becomes negative", () => {
    expect(formatTransactionAmount(50)).toBe("-$50.00");
  });

  it("flips Plaid sign: negative inflow becomes positive", () => {
    expect(formatTransactionAmount(-50)).toBe("+$50.00");
  });
});

describe("formatDate", () => {
  it("returns the original string when it is not a parseable date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("renders a parseable date as a locale date string", () => {
    expect(formatDate("2026-03-15")).toMatch(/\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/);
  });

  it("ignores a trailing time component", () => {
    expect(formatDate("2026-03-15T09:30:00")).toBe(formatDate("2026-03-15"));
  });
});

describe("formatShortDate", () => {
  it("renders month + day in en-US", () => {
    expect(formatShortDate("2026-03-05")).toBe("Mar 5");
  });
});

describe("getDateInputValue", () => {
  it("strips the time component", () => {
    expect(getDateInputValue("2026-03-15T09:30:00")).toBe("2026-03-15");
  });

  it("returns an empty string for nullish values", () => {
    expect(getDateInputValue(null)).toBe("");
    expect(getDateInputValue(undefined)).toBe("");
  });
});

describe("getTransactionEffectiveDate", () => {
  it("prefers the manual date over the imported date", () => {
    expect(
      getTransactionEffectiveDate(
        transaction({ date: "2026-03-15", manual_date: "2026-04-01" }),
      ),
    ).toBe("2026-04-01");
  });

  it("falls back to the imported date", () => {
    expect(
      getTransactionEffectiveDate(
        transaction({ date: "2026-03-15", manual_date: null }),
      ),
    ).toBe("2026-03-15");
  });
});

describe("formatDateRange", () => {
  it("returns a placeholder when either end is missing", () => {
    expect(formatDateRange("", "2026-03-15")).toBe("Selected range");
    expect(formatDateRange("2026-03-15", "")).toBe("Selected range");
  });

  it("joins both formatted ends with a dash", () => {
    expect(formatDateRange("2026-03-01", "2026-03-31")).toBe(
      `${formatDate("2026-03-01")} - ${formatDate("2026-03-31")}`,
    );
  });
});

describe("getDefaultDashboardMonth", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the previous calendar month as YYYY-MM", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15));
    expect(getDefaultDashboardMonth()).toBe("2025-12");
  });

  it("zero-pads single digit months", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 10));
    expect(getDefaultDashboardMonth()).toBe("2026-08");
  });
});
