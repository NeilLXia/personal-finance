import { describe, expect, it } from "vitest";

import {
  buildIncomeAllocationSegments,
  getIncomeAllocationIncomeTotal,
  getIncomeAllocationOffsetPercent,
  resolveSegmentTargetPercent,
} from "./incomeAllocationUtils";
import type { CategoryTotal, Payslip, Transaction } from "../shared/types";

const payslip = (overrides: Partial<Payslip> = {}): Payslip =>
  ({ id: 1, gross_pay: 5000, net_pay: 3800, ...overrides }) as Payslip;

const incomeTransaction = (
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id: 1,
  name: "Paycheck",
  amount: -1000,
  date: "2026-03-15",
  merchant_name: null,
  category: null,
  cash_flow_type: "income",
  pending: false,
  account_name: "Checking",
  account_mask: null,
  ...overrides,
});

describe("getIncomeAllocationIncomeTotal", () => {
  it("returns the raw income figure when there are no payslips", () => {
    expect(
      getIncomeAllocationIncomeTotal({
        income: 5000,
        payslips: [],
        transactions: [],
      }),
    ).toBe(5000);
  });

  it("uses net vs gross payslip totals based on mode", () => {
    expect(
      getIncomeAllocationIncomeTotal({
        income: 0,
        mode: "net",
        payslips: [payslip()],
        transactions: [],
      }),
    ).toBe(3800);
    expect(
      getIncomeAllocationIncomeTotal({
        income: 0,
        mode: "gross",
        payslips: [payslip()],
        transactions: [],
      }),
    ).toBe(5000);
  });

  it("adds income transactions that are not linked to a payslip", () => {
    expect(
      getIncomeAllocationIncomeTotal({
        income: 0,
        mode: "net",
        payslips: [payslip({ income_transaction_id: 99 })],
        transactions: [
          incomeTransaction({ id: 99, amount: -4000 }), // linked -> ignored
          incomeTransaction({ id: 7, amount: -250 }), // unlinked -> counted
        ],
      }),
    ).toBe(3800 + 250);
  });
});

describe("resolveSegmentTargetPercent", () => {
  const housingSegment = { key: "housing", label: "Housing" };
  const savingsSegment = { key: "savings", label: "Effective savings" };

  it("returns the matching category target for a normal segment", () => {
    expect(
      resolveSegmentTargetPercent(housingSegment, new Map([["housing", 28]])),
    ).toBe(28);
  });

  it("returns undefined when no target is set for the segment", () => {
    expect(
      resolveSegmentTargetPercent(housingSegment, new Map()),
    ).toBeUndefined();
  });

  it("ignores a zero / negative target", () => {
    expect(
      resolveSegmentTargetPercent(housingSegment, new Map([["housing", 0]])),
    ).toBeUndefined();
  });

  it("prefers an explicit 'Effective savings' target for the savings bar", () => {
    expect(
      resolveSegmentTargetPercent(
        savingsSegment,
        new Map([
          ["effective savings", 30],
          ["savings", 25],
        ]),
      ),
    ).toBe(30);
  });

  it("falls back to a 'Savings' target for the savings bar", () => {
    expect(
      resolveSegmentTargetPercent(savingsSegment, new Map([["savings", 25]])),
    ).toBe(25);
  });
});

describe("getIncomeAllocationOffsetPercent", () => {
  const [housing] = buildIncomeAllocationSegments({
    income: 10000,
    savings: 0,
    realEstateEquity: 0,
    categories: [{ category: "Housing", amount: -2000, count: 1 }],
    mode: "net",
  });
  const chart = {
    zeroLinePercent: housing.zeroLinePercent,
    chartMinPercent: housing.chartMinPercent,
    chartRangePercent: housing.chartRangePercent,
  };

  it("places a target at the same offset a segment bar of that percent ends at", () => {
    expect(
      getIncomeAllocationOffsetPercent({ value: housing.percent, ...chart }),
    ).toBeCloseTo(housing.barLeftPercent + housing.barWidthPercent, 5);
  });

  it("clamps a target above the chart maximum to the right edge", () => {
    expect(
      getIncomeAllocationOffsetPercent({ value: 500, ...chart }),
    ).toBeCloseTo(100, 5);
  });

  it("grows the chart so a large target (e.g. effective savings) stays inside the track", () => {
    const [segment] = buildIncomeAllocationSegments({
      income: 10000,
      savings: 0,
      realEstateEquity: 0,
      categories: [{ category: "Housing", amount: -2000, count: 1 }],
      mode: "net",
      targetPercents: [55],
    });
    const offset = getIncomeAllocationOffsetPercent({
      value: 55,
      zeroLinePercent: segment.zeroLinePercent,
      chartMinPercent: segment.chartMinPercent,
      chartRangePercent: segment.chartRangePercent,
    });

    expect(
      segment.chartMinPercent + segment.chartRangePercent,
    ).toBeGreaterThanOrEqual(55);
    expect(offset).toBeLessThan(100);
  });
});

describe("buildIncomeAllocationSegments", () => {
  it("returns an empty list when the denominator is not positive", () => {
    expect(
      buildIncomeAllocationSegments({
        income: 0,
        savings: 0,
        realEstateEquity: 0,
        categories: [],
      }),
    ).toEqual([]);
  });

  it("splits income into housing / essentials / discretionary / savings that sum back to income", () => {
    const categories: CategoryTotal[] = [
      { category: "Housing", amount: -2000, count: 1 },
      { category: "Groceries", amount: -1000, count: 4 },
      { category: "Shopping", amount: -500, count: 3 },
    ];
    const segments = buildIncomeAllocationSegments({
      income: 10000,
      savings: 0,
      realEstateEquity: 0,
      categories,
      mode: "net",
    });

    expect(segments.map((s) => s.key)).toEqual([
      "housing",
      "essentials",
      "discretionary",
      "real_estate_equity",
      "savings",
    ]);

    const byKey = Object.fromEntries(segments.map((s) => [s.key, s]));
    expect(byKey.housing.amount).toBe(2000);
    expect(byKey.essentials.amount).toBe(1000);
    expect(byKey.discretionary.amount).toBe(500);
    expect(byKey.savings.amount).toBe(6500);

    const total = segments.reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBeCloseTo(10000, 2);
    expect(byKey.housing.percent).toBeCloseTo(20, 5);
    expect(byKey.savings.percent).toBeCloseTo(65, 5);
  });

  it("labels a negative savings segment as a shortfall", () => {
    const [shortfall] = buildIncomeAllocationSegments({
      income: 1000,
      savings: 0,
      realEstateEquity: 0,
      categories: [{ category: "Housing", amount: -5000, count: 1 }],
      mode: "net",
    }).slice(-1);

    expect(shortfall.label).toBe("Shortfall");
    expect(shortfall.amount).toBeLessThan(0);
  });

  it("adds a taxes segment only in gross mode", () => {
    const grossSegments = buildIncomeAllocationSegments({
      income: 0,
      savings: 0,
      realEstateEquity: 0,
      categories: [],
      mode: "gross",
      payslips: [payslip({ gross_pay: 6000, federal_withholding_tax: 900 })],
    });
    expect(grossSegments.some((s) => s.key === "taxes")).toBe(true);
  });
});
