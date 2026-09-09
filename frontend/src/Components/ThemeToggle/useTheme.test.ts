import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTheme } from "./useTheme";

const stubStorage = () => {
  const items = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    clear: vi.fn(() => items.clear()),
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    removeItem: vi.fn((key: string) => items.delete(key)),
    setItem: vi.fn((key: string, value: string) => items.set(key, value)),
  } satisfies Pick<Storage, "clear" | "getItem" | "removeItem" | "setItem">);
  return items;
};

describe("useTheme", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = stubStorage();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to light and persists it when nothing is stored", () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(storage.get("theme")).toBe("light");
  });

  it("uses the stored preference", () => {
    storage.set("theme", "dark");

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("seeds from prefers-color-scheme when nothing is stored", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("dark");
  });

  it("cycleTheme toggles between light and dark and persists", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.cycleTheme());
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(storage.get("theme")).toBe("dark");

    act(() => result.current.cycleTheme());
    expect(result.current.theme).toBe("light");
    expect(storage.get("theme")).toBe("light");
  });
});
