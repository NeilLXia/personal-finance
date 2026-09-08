import { useEffect, useRef, useState } from "react";

import styles from "./index.module.css";

type DashboardActionsMenuProps = {
  isManualRefreshLoading: boolean;
  onOpenConnections: () => void;
  onManualRefresh: () => void;
  onOpenCategoryRules: () => void;
  onOpenBudgetTargets: () => void;
  onOpenRealEstate: () => void;
  onOpenPayslips: () => void;
  onLogout: () => void;
};

const DashboardActionsMenu = ({
  isManualRefreshLoading,
  onOpenConnections,
  onManualRefresh,
  onOpenCategoryRules,
  onOpenBudgetTargets,
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
            onClick={() => runMenuAction(onManualRefresh)}
            disabled={isManualRefreshLoading}
          >
            {isManualRefreshLoading
              ? "Refreshing data"
              : "Manually refresh data"}
          </button>
          <button
            type="button"
            onClick={() => runMenuAction(onOpenCategoryRules)}
          >
            Category rules
          </button>
          <button
            type="button"
            onClick={() => runMenuAction(onOpenBudgetTargets)}
          >
            Budget targets
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
