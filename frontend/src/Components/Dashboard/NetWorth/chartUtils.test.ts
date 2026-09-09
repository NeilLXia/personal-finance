import { describe, expect, it } from "vitest";

import { buildNetWorthChart } from "./chartUtils";
import { defaultNetWorthCategories } from "../shared/constants";
import type { NetWorthPoint } from "../shared/types";

const point = (overrides: Partial<NetWorthPoint>): NetWorthPoint => ({
  date: "2026-01-01",
  cash: 0,
  personal_equity: 0,
  tax_advantaged: 0,
  real_estate: 0,
  other_assets: 0,
  total: 0,
  ...overrides,
});

describe("buildNetWorthChart", () => {
  it("returns an empty chart shape when there is no history", () => {
    const chart = buildNetWorthChart(
      [],
      defaultNetWorthCategories,
      0,
      "all",
      "2026-02",
    );
    expect(chart.areas).toEqual([]);
    expect(chart.lines).toEqual([]);
    expect(chart.hoverPoints).toEqual([]);
  });

  it("builds areas, lines, hover points and 3 y ticks from history", () => {
    const history = [
      point({ date: "2026-01-01", cash: 1000, total: 1000 }),
      point({ date: "2026-02-01", cash: 2000, total: 2000 }),
    ];
    const chart = buildNetWorthChart(
      history,
      defaultNetWorthCategories,
      2000,
      "all",
      "2026-02",
    );

    expect(chart.areas.map((a) => a.key)).toEqual(["cash"]);
    expect(chart.areas[0].path.startsWith("M ")).toBe(true);
    expect(chart.lines).toHaveLength(1);
    expect(chart.hoverPoints).toHaveLength(2);
    expect(chart.yTicks).toHaveLength(3);
  });

  it("filters history to the trailing window", () => {
    const history = [
      point({ date: "2024-01-01", cash: 500, total: 500 }),
      point({ date: "2026-01-01", cash: 1000, total: 1000 }),
      point({ date: "2026-02-01", cash: 2000, total: 2000 }),
    ];
    const chart = buildNetWorthChart(
      history,
      defaultNetWorthCategories,
      2000,
      12,
      "2026-02",
    );
    expect(chart.hoverPoints).toHaveLength(2);
  });
});
