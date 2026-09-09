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

const nwPoint = (date: string, total: number): NetWorthPoint => ({
  date,
  cash: total,
  personal_equity: 0,
  tax_advantaged: 0,
  real_estate: 0,
  other_assets: 0,
  total,
});

describe("addAssetAppreciation", () => {
  it("derives asset appreciation as net-worth change minus the shown wealth-change impact", () => {
    const [result] = addAssetAppreciation({
      months: [
        month({ month: "2026-02", expenses: -100, savings: 200, total: 100 }),
      ],
      netWorthHistory: [
        nwPoint("2026-01-01", 1000),
        nwPoint("2026-02-01", 1400),
      ],
    });

    // net-worth change = 400, shown impact = -100 + 200 + 0 = 100 -> appreciation 300
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
});
