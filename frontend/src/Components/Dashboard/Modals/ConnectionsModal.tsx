import styles from "./index.module.css";
import shared from "../dashboard.shared.module.css";
import type { InstitutionStatus } from "../shared/types";
import ConnectionTile from "./ConnectionTile";
import ModalShell from "./ModalShell";

type ConnectionsModalProps = {
  institutions: InstitutionStatus[];
  canConnectAccount: boolean;
  onClose: () => void;
  onConnectAccount: () => void;
  onError: (message: string) => void;
  onReconnect: (plaidItemId: string) => void;
};

const ConnectionsModal = ({
  institutions,
  canConnectAccount,
  onClose,
  onConnectAccount,
  onError,
  onReconnect,
}: ConnectionsModalProps) => {
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
      </div>

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
