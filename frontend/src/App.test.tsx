import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as ApiClient from "./shared/apiClient";

import App from "./App";
import { AppProvider } from "./Context";
import { getJson, notifyAuthExpired, postJson } from "./shared/apiClient";

vi.mock("./Components/Dashboard", () => ({
  default: () => <div>dashboard-stub</div>,
}));

vi.mock("./shared/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();

  return { ...actual, getJson: vi.fn(), postJson: vi.fn() };
});

const mockGetJson = vi.mocked(getJson);
const mockPostJson = vi.mocked(postJson);

const authUser = {
  id: 1,
  email: "user@example.com",
  name: null,
  avatar_url: null,
  is_demo: false,
};

const renderApp = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppProvider>
        <App />
      </AppProvider>
    </QueryClientProvider>,
  );

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the login screen when the session is unauthenticated", async () => {
    mockGetJson.mockResolvedValue({
      authenticated: false,
      google_client_id: null,
      user: null,
    });

    renderApp();

    expect(
      await screen.findByRole("button", { name: /demo user/i }),
    ).toBeTruthy();
    expect(mockPostJson).not.toHaveBeenCalled();
  });

  it("mounts the dashboard and requests a Plaid link token when authenticated", async () => {
    mockGetJson.mockResolvedValue({
      authenticated: true,
      google_client_id: null,
      user: authUser,
    });
    mockPostJson.mockResolvedValue({ link_token: "link-token-123" });

    renderApp();

    expect(await screen.findByText("dashboard-stub")).toBeTruthy();
    await waitFor(() =>
      expect(mockPostJson).toHaveBeenCalledWith(
        "/api/create_link_token",
        undefined,
        {},
        expect.any(String),
      ),
    );
  });

  it("returns to the login screen when auth expires", async () => {
    mockGetJson.mockResolvedValue({
      authenticated: true,
      google_client_id: null,
      user: authUser,
    });
    mockPostJson.mockResolvedValue({ link_token: "link-token-123" });

    renderApp();
    await screen.findByText("dashboard-stub");

    act(() => {
      notifyAuthExpired();
    });

    expect(
      await screen.findByRole("button", { name: /demo user/i }),
    ).toBeTruthy();
  });
});
