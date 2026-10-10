import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DashboardActionsMenu from "./DashboardActionsMenu";

const renderMenu = ({ canOpenRetirement = false } = {}) => {
  const props = {
    activePage: "dashboard" as const,
    isCreditCardRewardsAvailable: true,
    isRetirementProjectionAvailable: canOpenRetirement,
    onOpenConnections: vi.fn(),
    onShowCreditCardRewards: vi.fn(),
    onShowDashboard: vi.fn(),
    onShowRetirementProjection: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenRealEstate: vi.fn(),
    onOpenPayslips: vi.fn(),
    onLogout: vi.fn(),
  };

  render(<DashboardActionsMenu {...props} />);
  fireEvent.click(
    screen.getByRole("button", { name: /open dashboard actions/i }),
  );

  return props;
};

describe("DashboardActionsMenu", () => {
  it("does not show a standalone VectorMint comparison action", () => {
    renderMenu();

    expect(
      screen.queryByRole("button", { name: /vectormint card comparison/i }),
    ).toBeNull();
  });

  it("only shows retirement projection when it is available", () => {
    renderMenu();

    expect(
      screen.queryByRole("button", { name: /retirement projection/i }),
    ).toBeNull();

    cleanup();
    renderMenu({ canOpenRetirement: true });

    expect(
      screen.queryByRole("button", { name: /retirement projection/i }),
    ).not.toBeNull();
  });
});
