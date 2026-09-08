import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardPayloadKeys } from "./dashboardQueryKeys";
import { useDashboardLogout } from "./useDashboardLogout";
import { LINK_TOKEN_STORAGE_KEY } from "./shared/constants";
import { createDashboardData } from "../../test/dashboardData";
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from "../../test/queryClient";

const dashboardApi = vi.hoisted(() => ({
  logoutUser: vi.fn(),
}));

vi.mock("./dashboardApi", () => dashboardApi);

describe("useDashboardLogout", () => {
  let localStorageItems: Map<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageItems = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: vi.fn(() => localStorageItems.clear()),
      getItem: vi.fn((key: string) => localStorageItems.get(key) ?? null),
      removeItem: vi.fn((key: string) => localStorageItems.delete(key)),
      setItem: vi.fn((key: string, value: string) =>
        localStorageItems.set(key, value),
      ),
    } satisfies Pick<
      Storage,
      "clear" | "getItem" | "removeItem" | "setItem"
    >);
    dashboardApi.logoutUser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears React Query cache and local link token after logout", async () => {
    const queryClient = createTestQueryClient();
    const dispatch = vi.fn();

    queryClient.setQueryData(
      dashboardPayloadKeys.base("2026-08"),
      createDashboardData(),
    );
    localStorage.setItem(LINK_TOKEN_STORAGE_KEY, "stale-link-token");

    const { result } = renderHook(() => useDashboardLogout(dispatch), {
      wrapper: createQueryClientWrapper(queryClient),
    });

    await result.current();

    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
    expect(localStorage.getItem(LINK_TOKEN_STORAGE_KEY)).toBeNull();
    expect(dispatch).toHaveBeenCalledWith({ type: "AUTH_EXPIRED" });
  });
});
