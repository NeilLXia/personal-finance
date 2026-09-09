import { describe, expect, it } from "vitest";

import { buildTransactionPieSlices } from "./chartUtils";
import type { CategoryTotal } from "../../shared/types";

describe("buildTransactionPieSlices", () => {
  it("returns nothing when there is no spend", () => {
    expect(buildTransactionPieSlices([])).toEqual([]);
    expect(
      buildTransactionPieSlices([{ category: "A", amount: 0, count: 0 }]),
    ).toEqual([]);
  });

  it("emits one slice per category with a color and an SVG path", () => {
    const categories: CategoryTotal[] = [
      { category: "Housing", amount: -750, count: 1 },
      { category: "Dining", amount: -250, count: 8 },
    ];
    const slices = buildTransactionPieSlices(categories);

    expect(slices).toHaveLength(2);
    expect(slices[0]).toMatchObject({
      category: "Housing",
      amount: -750,
      count: 1,
    });
    expect(slices[0].color).toMatch(/^var\(--chart-/);
    expect(slices[0].path.startsWith("M ")).toBe(true);
    expect(slices[1].path).toContain("A ");
  });

  it("uses the magnitude of the amount for the slice angle", () => {
    const slices = buildTransactionPieSlices([
      { category: "Big", amount: -900, count: 1 },
      { category: "Small", amount: -100, count: 1 },
    ]);
    // The larger-magnitude slice sweeps past 180 degrees -> large-arc flag 1.
    expect(slices[0].path).toMatch(/A 44 44 0 1 1/);
    expect(slices[1].path).toMatch(/A 44 44 0 0 1/);
  });
});
