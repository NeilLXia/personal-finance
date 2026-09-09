import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as ApiClient from "../../shared/apiClient";

import Login from "./index";
import { AppProvider } from "../../Context";
import { postJson } from "../../shared/apiClient";

vi.mock("../../shared/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();

  return { ...actual, postJson: vi.fn() };
});

const mockPostJson = vi.mocked(postJson);

const renderLogin = (
  onAuthenticated = vi.fn().mockResolvedValue(undefined),
) => {
  render(
    <AppProvider>
      <Login onAuthenticated={onAuthenticated} />
    </AppProvider>,
  );

  return { onAuthenticated };
};

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs in as the demo user and runs the onAuthenticated callback", async () => {
    mockPostJson.mockResolvedValue({
      user: {
        id: 9,
        email: "demo@example.com",
        name: "Demo",
        avatar_url: null,
        is_demo: true,
      },
    });
    const { onAuthenticated } = renderLogin();

    fireEvent.click(screen.getByRole("button", { name: /demo user/i }));

    await waitFor(() =>
      expect(mockPostJson).toHaveBeenCalledWith(
        "/api/login/demo",
        undefined,
        {},
        expect.any(String),
      ),
    );
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
  });

  it("surfaces the error and skips the callback when demo sign-in fails", async () => {
    mockPostJson.mockRejectedValue(new Error("Demo is unavailable"));
    const { onAuthenticated } = renderLogin();

    fireEvent.click(screen.getByRole("button", { name: /demo user/i }));

    expect(await screen.findByText("Demo is unavailable")).toBeTruthy();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });
});
