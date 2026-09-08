import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  PlaidLinkError,
  PlaidLinkOnExitMetadata,
  PlaidLinkOptionsWithLinkToken,
} from "react-plaid-link";
import { usePlaidLink } from "react-plaid-link";

import { useAppContext } from "../../../Context";
import { createLinkToken, exchangePublicToken } from "../dashboardApi";
import { dashboardPayloadKeys } from "../dashboardQueryKeys";
import { LINK_TOKEN_STORAGE_KEY } from "../shared/constants";
import styles from "./index.module.css";
import type { InstitutionStatus } from "../shared/types";
import ConnectionsModal from "../Modals/ConnectionsModal";
import ThemeToggle from "../../ThemeToggle";
import DashboardActionsMenu from "./DashboardActionsMenu";

type DashboardToolbarProps = {
  institutions: InstitutionStatus[];
  selectedMonth: string;
  areBalancesHidden: boolean;
  isManualRefreshLoading: boolean;
  onSelectedMonthChange: (month: string) => void;
  onError: (message: string) => void;
  onToggleBalanceVisibility: () => void;
  onManualRefresh: () => void;
  onOpenCategoryRules: () => void;
  onOpenBudgetTargets: () => void;
  onOpenRealEstate: () => void;
  onOpenPayslips: () => void;
  onLogout: () => void;
};

const DashboardToolbar = ({
  institutions,
  selectedMonth,
  areBalancesHidden,
  isManualRefreshLoading,
  onSelectedMonthChange,
  onError,
  onToggleBalanceVisibility,
  onManualRefresh,
  onOpenCategoryRules,
  onOpenBudgetTargets,
  onOpenRealEstate,
  onOpenPayslips,
  onLogout,
}: DashboardToolbarProps) => {
  const { linkToken, dispatch } = useAppContext();
  const [activeLinkMode, setActiveLinkMode] = useState<
    "connect" | "reconnect" | null
  >(null);
  const [reconnectLinkToken, setReconnectLinkToken] = useState<string | null>(
    null,
  );
  const [shouldOpenPlaidLink, setShouldOpenPlaidLink] = useState(false);
  const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false);
  const hasOpenedOauthRef = useRef(false);
  const activeLinkToken = reconnectLinkToken || linkToken;
  const queryClient = useQueryClient();
  const invalidateDashboard = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: dashboardPayloadKeys.root }),
    [queryClient],
  );

  const resetPlaidLink = useCallback(() => {
    setActiveLinkMode(null);
    setReconnectLinkToken(null);
    setShouldOpenPlaidLink(false);
  }, []);

  const onPlaidLinkExit = useCallback(
    (error: PlaidLinkError | null, metadata: PlaidLinkOnExitMetadata) => {
      resetPlaidLink();

      if (error != null) {
        console.warn("Plaid Link exited", {
          error_type: error.error_type || "",
          error_code: error.error_code || "",
          error_message: error.error_message || "",
          display_message: error.display_message || "",
          institution_name: metadata?.institution?.name || "",
        });
      }
    },
    [resetPlaidLink],
  );

  const onPlaidLinkSuccess = useCallback(
    async (publicToken: string | null) => {
      if (activeLinkMode === "reconnect") {
        resetPlaidLink();
        await invalidateDashboard();
        return;
      }

      if (!publicToken) {
        resetPlaidLink();
        onError("Plaid did not return a public token.");
        return;
      }

      try {
        await exchangePublicToken(publicToken);
        localStorage.removeItem(LINK_TOKEN_STORAGE_KEY);
        window.history.replaceState("", "", "/");
        const data = await createLinkToken();
        dispatch({
          type: "SET_LINK_TOKEN",
          linkToken: typeof data.link_token === "string" ? data.link_token : null,
        });
        await invalidateDashboard();
        resetPlaidLink();
      } catch (requestError) {
        resetPlaidLink();
        onError(
          requestError instanceof Error
            ? requestError.message
            : "Plaid token exchange failed",
        );
      }
    },
    [activeLinkMode, dispatch, invalidateDashboard, onError, resetPlaidLink],
  );

  const config: PlaidLinkOptionsWithLinkToken = {
    token: activeLinkToken,
    onSuccess: onPlaidLinkSuccess,
    onExit: onPlaidLinkExit,
  };

  if (window.location.href.includes("?oauth_state_id=")) {
    config.receivedRedirectUri = window.location.href;
  }

  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    if (shouldOpenPlaidLink && ready) {
      open();
    }
  }, [open, ready, shouldOpenPlaidLink]);

  useEffect(() => {
    if (
      !hasOpenedOauthRef.current &&
      window.location.href.includes("?oauth_state_id=") &&
      activeLinkToken &&
      ready
    ) {
      hasOpenedOauthRef.current = true;
      setActiveLinkMode("connect");
      open();
    }
  }, [activeLinkToken, open, ready]);

  const connectAccount = () => {
    setActiveLinkMode("connect");
    setReconnectLinkToken(null);
    setShouldOpenPlaidLink(true);
  };

  const reconnectAccount = async (plaidItemId: string) => {
    setActiveLinkMode("reconnect");
    setShouldOpenPlaidLink(false);

    try {
      const data = await createLinkToken(plaidItemId);
      if (typeof data.link_token !== "string") {
        throw new Error("Reconnect did not return a link token.");
      }

      setReconnectLinkToken(data.link_token);
      setShouldOpenPlaidLink(true);
    } catch (requestError) {
      resetPlaidLink();
      onError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to reconnect account",
      );
    }
  };

  return (
    <>
      <section className={styles.connectionSection}>
        <div className={styles.toolbarLeft}>
          <label className={styles.monthSelector}>
            <span>Month</span>
            <input
              onChange={(event) => onSelectedMonthChange(event.target.value)}
              type="month"
              value={selectedMonth}
            />
          </label>
        </div>
        <div className={styles.connectAction}>
          <ThemeToggle />
          <button
            type="button"
            className={styles.privacyToggle}
            onClick={onToggleBalanceVisibility}
          >
            {areBalancesHidden ? "Show values" : "Hide values"}
          </button>
          <DashboardActionsMenu
            isManualRefreshLoading={isManualRefreshLoading}
            onOpenConnections={() => setIsConnectionsModalOpen(true)}
            onManualRefresh={onManualRefresh}
            onOpenCategoryRules={onOpenCategoryRules}
            onOpenBudgetTargets={onOpenBudgetTargets}
            onOpenRealEstate={onOpenRealEstate}
            onOpenPayslips={onOpenPayslips}
            onLogout={onLogout}
          />
        </div>
      </section>

      {isConnectionsModalOpen && (
        <ConnectionsModal
          institutions={institutions}
          canConnectAccount={Boolean(activeLinkToken && ready)}
          onClose={() => setIsConnectionsModalOpen(false)}
          onConnectAccount={connectAccount}
          onError={onError}
          onReconnect={(plaidItemId) => void reconnectAccount(plaidItemId)}
        />
      )}
    </>
  );
};

export default DashboardToolbar;
