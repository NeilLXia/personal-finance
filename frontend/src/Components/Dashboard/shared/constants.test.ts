import { describe, expect, it } from "vitest";

import { chartColors, getCategoryColor } from "./constants";

describe("getCategoryColor", () => {
  it("looks up known categories case- and whitespace-insensitively", () => {
    expect(getCategoryColor("Housing")).toBe(getCategoryColor("  housing "));
    expect(getCategoryColor("Dining")).toMatch(/^var\(--chart-[\w-]+\)$/);
  });

  it("falls back to a deterministic palette color for unknown categories", () => {
    const first = getCategoryColor("Totally Unknown Category");
    const second = getCategoryColor("Totally Unknown Category");
    expect(first).toBe(second);
    expect(chartColors).toContain(first);
  });
});
