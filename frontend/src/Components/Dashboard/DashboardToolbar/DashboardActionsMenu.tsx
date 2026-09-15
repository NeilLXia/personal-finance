import { useEffect, useRef, useState } from "react";

import styles from "./index.module.css";

type DashboardActionsMenuProps = {
  activePage: "dashboard" | "credit-card-rewards";
  isCreditCardRewardsAvailable: boolean;
  onOpenConnections: () => void;
  onShowCreditCardRewards: () => void;
  onShowDashboard: () => void;
  onOpenSettings: () => void;
  onOpenRealEstate: () => void;
  onOpenPayslips: () => void;
  onLogout: () => void;
};

const DashboardActionsMenu = ({
  activePage,
  isCreditCardRewardsAvailable,
  onOpenConnections,
  onShowCreditCardRewards,
  onShowDashboard,
  onOpenSettings,
  onOpenRealEstate,
  onOpenPayslips,
  onLogout,
}: DashboardActionsMenuProps) => {
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isActionsMenuOpen) {
      return;
    }

    const closeActionsMenu = (event: MouseEvent) => {
      if (
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(event.target as Node)
      ) {
        setIsActionsMenuOpen(false);
      }
    };
    const closeActionsMenuWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsActionsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeActionsMenu);
    document.addEventListener("keydown", closeActionsMenuWithEscape);

    return () => {
      document.removeEventListener("mousedown", closeActionsMenu);
      document.removeEventListener("keydown", closeActionsMenuWithEscape);
    };
  }, [isActionsMenuOpen]);

  const runMenuAction = (action: () => void) => {
    setIsActionsMenuOpen(false);
    action();
  };

  return (
    <div className={styles.actionsMenuWrapper} ref={actionsMenuRef}>
      <button
        type="button"
        className={styles.hamburgerButton}
        onClick={() => setIsActionsMenuOpen((isOpen) => !isOpen)}
        aria-label="Open dashboard actions"
        aria-expanded={isActionsMenuOpen}
      >
        <span />
        <span />
        <span />
      </button>
      {isActionsMenuOpen && (
        <div className={styles.actionsMenu}>
          <button
            type="button"
            onClick={() => runMenuAction(onOpenConnections)}
          >
            Connections
          </button>
          <button
            type="button"
            onClick={() =>
              runMenuAction(
                activePage === "credit-card-rewards"
                  ? onShowDashboard
                  : onShowCreditCardRewards,
              )
            }
            disabled={!isCreditCardRewardsAvailable}
          >
            {activePage === "credit-card-rewards"
              ? "Dashboard"
              : "Credit card rewards"}
          </button>
          <button type="button" onClick={() => runMenuAction(onOpenSettings)}>
            Settings
          </button>
          <button type="button" onClick={() => runMenuAction(onOpenRealEstate)}>
            Real estate
          </button>
          <button type="button" onClick={() => runMenuAction(onOpenPayslips)}>
            Upload payslips (Workday)
          </button>
          <button type="button" onClick={() => runMenuAction(onLogout)}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default DashboardActionsMenu;
