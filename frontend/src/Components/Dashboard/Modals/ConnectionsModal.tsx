import { useState } from "react";

import { checkHealth } from "../../../shared/diagnosticsApi";
import styles from "./index.module.css";
import shared from "../dashboard.shared.module.css";
import type { InstitutionStatus } from "../shared/types";
import ConnectionTile from "./ConnectionTile";
import ModalShell from "./ModalShell";

type ConnectionsModalProps = {
  institutions: InstitutionStatus[];
  canConnectAccount: boolean;
  isManualRefreshLoading: boolean;
  isOwner: boolean;
  onClose: () => void;
  onConnectAccount: () => void;
  onError: (message: string) => void;
  onManualRefresh: () => void;
  onReconnect: (plaidItemId: string) => void;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Connection check failed.";

const ConnectionsModal = ({
  institutions,
  canConnectAccount,
  isManualRefreshLoading,
  isOwner,
  onClose,
  onConnectAccount,
  onError,
  onManualRefresh,
  onReconnect,
}: ConnectionsModalProps) => {
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);

  const handleCheckConnection = async () => {
    setIsCheckingConnection(true);
    setConnectionStatus(null);

    try {
      const result = await checkHealth();

      setConnectionStatus({
        message: `Backend: ${result.backend.status} · Database: ${result.database.status} (${result.database.latency_ms}ms)`,
        isError: result.database.status !== "ok",
      });
    } catch (error) {
      setConnectionStatus({ message: getErrorMessage(error), isError: true });
    } finally {
      setIsCheckingConnection(false);
    }
  };

  return (
    <ModalShell
      ariaLabel="Connections"
      className={styles.connectionsModal}
      onClose={onClose}
    >
      <header className={styles.modalHeader}>
        <div>
          <h2>Connections</h2>
          <p>Manage linked financial institutions.</p>
        </div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </header>

      <div className={styles.connectionModalActions}>
        <button
          type="button"
          className={styles.primaryActionButton}
          disabled={!canConnectAccount}
          onClick={onConnectAccount}
        >
          New connection
        </button>
        <button
          type="button"
          className={styles.secondaryActionButton}
          disabled={isManualRefreshLoading}
          onClick={onManualRefresh}
        >
          {isManualRefreshLoading ? "Refreshing data" : "Manually refresh data"}
        </button>
        {isOwner && (
          <button
            type="button"
            className={styles.secondaryActionButton}
            disabled={isCheckingConnection}
            onClick={handleCheckConnection}
          >
            {isCheckingConnection
              ? "Pinging server/database connection"
              : "Ping server/database connection"}
          </button>
        )}
      </div>
      {connectionStatus && (
        <p
          className={`${styles.connectionStatus} ${
            connectionStatus.isError ? styles.connectionStatusError : ""
          }`}
        >
          {connectionStatus.message}
        </p>
      )}

      <div className={styles.connectionTileGrid}>
        {institutions.length === 0 ? (
          <p className={shared.emptyText}>
            No active institution connections yet.
          </p>
        ) : (
          institutions.map((institution) => (
            <ConnectionTile
              key={`${institution.plaid_environment}-${institution.institution_id || institution.institution_name}`}
              institution={institution}
              onError={onError}
              onReconnect={onReconnect}
            />
          ))
        )}
      </div>
    </ModalShell>
  );
};

export default ConnectionsModal;
