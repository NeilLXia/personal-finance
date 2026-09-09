import { describe, expect, it } from "vitest";

import {
  appendCustomDateRangeParams,
  getBudgetTargetPercent,
  getCalculatedEffectiveSavingsTarget,
  getMonthDateRange,
  isValidDateRange,
} from "./dashboardStateUtils";
import type { BudgetTarget } from "./types";

const budgetTarget = (overrides: Partial<BudgetTarget>): BudgetTarget => ({
  id: 1,
  category: "Housing",
  category_key: "housing",
  target_percent: 0,
  net_target_percent: 0,
  gross_target_percent: 0,
  created_at: "",
  updated_at: "",
  ...overrides,
});

describe("getMonthDateRange", () => {
  it("returns the first and last day spanning the trailing months", () => {
    expect(getMonthDateRange("2026-03", 1)).toEqual({
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    });
  });

  it("walks back across a year boundary", () => {
    expect(getMonthDateRange("2026-02", 3)).toEqual({
      startDate: "2025-12-01",
      endDate: "2026-02-28",
    });
  });
});

describe("appendCustomDateRangeParams", () => {
  it("writes prefixed start/end params", () => {
    const params = new URLSearchParams();
    appendCustomDateRangeParams(params, "transaction", {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    expect(params.get("transaction_start_date")).toBe("2026-01-01");
    expect(params.get("transaction_end_date")).toBe("2026-01-31");
  });
});

describe("isValidDateRange", () => {
  it("accepts an ordered, fully populated range", () => {
    expect(
      isValidDateRange({ startDate: "2026-01-01", endDate: "2026-01-31" }),
    ).toBe(true);
  });

  it("rejects an inverted or partial range", () => {
    expect(
      isValidDateRange({ startDate: "2026-02-01", endDate: "2026-01-01" }),
    ).toBe(false);
    expect(isValidDateRange({ startDate: "", endDate: "2026-01-01" })).toBe(
      false,
    );
  });
});

describe("getBudgetTargetPercent", () => {
  it("net mode prefers net_target_percent then target_percent", () => {
    expect(
      getBudgetTargetPercent(
        budgetTarget({ net_target_percent: 30, target_percent: 25 }),
        "net",
      ),
    ).toBe(30);
    expect(
      getBudgetTargetPercent(
        budgetTarget({ net_target_percent: 0, target_percent: 25 }),
        "net",
      ),
    ).toBe(25);
  });

  it("gross mode prefers gross_target_percent", () => {
    expect(
      getBudgetTargetPercent(
        budgetTarget({ gross_target_percent: 18, net_target_percent: 30 }),
        "gross",
      ),
    ).toBe(18);
  });
});

describe("getCalculatedEffectiveSavingsTarget", () => {
  it("is 100 minus the sum of non-savings targets", () => {
    const targets = [
      budgetTarget({ category: "Housing", net_target_percent: 30 }),
      budgetTarget({ category: "Essential expenses", net_target_percent: 20 }),
      budgetTarget({ category: "Effective savings", net_target_percent: 99 }),
    ];
    expect(getCalculatedEffectiveSavingsTarget(targets, "net")).toBe(50);
  });

  it("excludes taxes in net mode but includes them in gross mode", () => {
    const targets = [
      budgetTarget({
        category: "Housing",
        net_target_percent: 30,
        gross_target_percent: 25,
      }),
      budgetTarget({
        category: "Taxes",
        net_target_percent: 0,
        gross_target_percent: 15,
      }),
    ];
    expect(getCalculatedEffectiveSavingsTarget(targets, "net")).toBe(70);
    expect(getCalculatedEffectiveSavingsTarget(targets, "gross")).toBe(60);
  });
});
