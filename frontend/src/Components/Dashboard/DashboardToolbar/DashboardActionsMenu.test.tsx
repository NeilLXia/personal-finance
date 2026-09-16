import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DashboardActionsMenu from "./DashboardActionsMenu";

const renderMenu = () => {
  const props = {
    activePage: "dashboard" as const,
    isCreditCardRewardsAvailable: true,
    onOpenConnections: vi.fn(),
    onShowCreditCardRewards: vi.fn(),
    onShowDashboard: vi.fn(),
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
});
