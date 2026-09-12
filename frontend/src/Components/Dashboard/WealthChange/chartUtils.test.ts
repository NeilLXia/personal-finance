import { describe, expect, it } from "vitest";

import { addAssetAppreciation, buildWealthChangeChart } from "./chartUtils";
import { defaultWealthChangeCategories } from "../shared/constants";
import type { NetWorthPoint, WealthChangeMonth } from "../shared/types";

const month = (overrides: Partial<WealthChangeMonth>): WealthChangeMonth => ({
  month: "2026-02",
  label: "Feb 26",
  income: 0,
  expenses: 0,
  savings: 0,
  real_estate_equity: 0,
  total: 0,
  ...overrides,
});

const nwPoint = (
  date: string,
  total: number,
  balanceChange?: number,
  balanceChanges?: NetWorthPoint["balance_changes"],
): NetWorthPoint => ({
  date,
  cash: total,
  personal_equity: 0,
  tax_advantaged: 0,
  real_estate: 0,
  other_assets: 0,
  balance_change: balanceChange,
  balance_changes: balanceChanges,
  total,
});

describe("addAssetAppreciation", () => {
  it("derives asset appreciation as net-worth change minus the shown wealth-change impact", () => {
    const [result] = addAssetAppreciation({
      months: [
        month({ month: "2026-02", expenses: -100, savings: 200, total: 100 }),
      ],
      netWorthHistory: [
        nwPoint("2026-01-01", 1000, 0),
        nwPoint("2026-02-01", 1400, 400),
      ],
    });

    // net-worth change = 400, shown impact = -100 + 200 + 0 = 100 -> appreciation 300
    expect(result.asset_appreciation).toBe(300);
    expect(result.total).toBe(400);
  });

  it("uses matched account balance changes so newly added accounts do not inflate appreciation", () => {
    const [result] = addAssetAppreciation({
      months: [
        month({ month: "2026-02", expenses: -100, savings: 200, total: 100 }),
      ],
      netWorthHistory: [
        nwPoint("2026-01-01", 1000, 0),
        nwPoint("2026-02-01", 6400, 400),
      ],
    });

    expect(result.asset_appreciation).toBe(300);
    expect(result.total).toBe(400);
  });

  it("prefers balance_change over aggregate net-worth movement when a newly included account raises total net worth", () => {
    const [result] = addAssetAppreciation({
      months: [
        month({
          month: "2026-09",
          expenses: -5684.53,
          savings: 0,
          real_estate_equity: 1093.33,
          total: -4591.2,
        }),
      ],
      netWorthHistory: [
        nwPoint("2026-08-01", 786092.47, -12211.89),
        nwPoint("2026-09-12", 828610.18, -63109.29, {
          cash: 0,
          personal_equity: 0,
          tax_advantaged: 0,
          real_estate: -63109.29,
          other_assets: 0,
        }),
      ],
    });

    expect(result.asset_appreciation).toBe(-58518.09);
    expect(result.total).toBe(-63109.29);
  });

  it("does not treat a missing account balance as a monthly loss", () => {
    const [result] = addAssetAppreciation({
      months: [month({ month: "2026-02", savings: 200, total: 200 })],
      netWorthHistory: [
        nwPoint("2026-01-01", 6000, 0),
        nwPoint("2026-02-01", 1100, 300),
      ],
    });

    expect(result.asset_appreciation).toBe(100);
    expect(result.total).toBe(300);
  });

  it("falls back to aggregate net-worth changes for legacy history points", () => {
    const [result] = addAssetAppreciation({
      months: [
        month({ month: "2026-02", expenses: -100, savings: 200, total: 100 }),
      ],
      netWorthHistory: [
        nwPoint("2026-01-01", 1000),
        nwPoint("2026-02-01", 1400),
      ],
    });

    expect(result.asset_appreciation).toBe(300);
    expect(result.total).toBe(400);
  });

  it("is zero when a bordering net-worth point is missing", () => {
    const [result] = addAssetAppreciation({
      months: [month({ month: "2026-02", total: 100 })],
      netWorthHistory: [nwPoint("2026-02-01", 1400)],
    });
    expect(result.asset_appreciation).toBe(0);
  });

  it("breaks asset appreciation down by net-worth category", () => {
    const [result] = addAssetAppreciation({
      months: [
        month({
          month: "2026-02",
          expenses: -100,
          savings: 200,
          real_estate_equity: 50,
          total: 150,
        }),
      ],
      netWorthHistory: [
        nwPoint("2026-01-01", 1000, 0),
        nwPoint("2026-02-01", 1450, 450, {
          cash: -100,
          personal_equity: 300,
          tax_advantaged: 100,
          real_estate: 150,
          other_assets: 0,
        }),
      ],
    });

    expect(result.asset_appreciation).toBe(300);
    expect(result.asset_appreciation_breakdown).toEqual([
      { key: "cash", label: "Cash", value: 0 },
      { key: "personal_equity", label: "Personal equity", value: 150 },
      { key: "tax_advantaged", label: "Tax-advantaged equity", value: 50 },
      { key: "real_estate", label: "Real estate", value: 100 },
      { key: "other_assets", label: "Other assets", value: 0 },
    ]);
  });
});

describe("buildWealthChangeChart", () => {
  it("returns an empty chart when there are no months", () => {
    const chart = buildWealthChangeChart([], defaultWealthChangeCategories);
    expect(chart.bars).toEqual([]);
    expect(chart.xTicks).toEqual([]);
  });

  it("emits one bar per non-zero category with a stable id", () => {
    const chart = buildWealthChangeChart(
      [
        month({
          month: "2026-02",
          expenses: -100,
          savings: 200,
          asset_appreciation: 300,
          total: 400,
        }),
      ],
      defaultWealthChangeCategories,
    );

    expect(chart.bars).toHaveLength(3);
    expect(chart.bars.map((b) => b.id)).toContain("2026-02-savings");
    for (const bar of chart.bars) {
      expect(Number.isFinite(bar.x)).toBe(true);
      expect(Number.isFinite(bar.y)).toBe(true);
      expect(bar.height).toBeGreaterThanOrEqual(0);
    }
  });

  it("labels negative asset appreciation as asset depreciation", () => {
    const chart = buildWealthChangeChart(
      [
        month({
          month: "2026-02",
          asset_appreciation: -300,
          total: -300,
        }),
      ],
      defaultWealthChangeCategories,
    );

    expect(chart.bars).toEqual([
      expect.objectContaining({
        category: "asset_appreciation",
        label: "Asset depreciation",
        value: -300,
      }),
    ]);
  });

  it("attaches the asset appreciation breakdown to the asset movement bar", () => {
    const [monthWithAppreciation] = addAssetAppreciation({
      months: [month({ month: "2026-02" })],
      netWorthHistory: [
        nwPoint("2026-01-01", 1000, 0),
        nwPoint("2026-02-01", 1100, 100, {
          cash: 25,
          personal_equity: 75,
        }),
      ],
    });
    const chart = buildWealthChangeChart(
      [monthWithAppreciation],
      defaultWealthChangeCategories,
    );

    expect(chart.bars).toEqual([
      expect.objectContaining({
        category: "asset_appreciation",
        breakdown: expect.arrayContaining([
          expect.objectContaining({ key: "cash", value: 25 }),
          expect.objectContaining({ key: "personal_equity", value: 75 }),
        ]),
        value: 100,
      }),
    ]);
  });
});
