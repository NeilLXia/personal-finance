import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteRequest } from "../../../shared/apiClient";
import { dashboardPayloadKeys } from "../dashboardQueryKeys";
import styles from "./index.module.css";
import type { InstitutionStatus } from "../shared/types";

type ConnectionTileProps = {
  institution: InstitutionStatus;
  onError: (message: string) => void;
  onReconnect: (plaidItemId: string) => void;
};

const ConnectionTile = ({
  institution,
  onError,
  onReconnect,
}: ConnectionTileProps) => {
  const queryClient = useQueryClient();
  const removeConnectionMutation = useMutation({
    mutationFn: (plaidItemId: string) =>
      deleteRequest(
        `/api/plaid-items/${encodeURIComponent(plaidItemId)}`,
        {},
        "Remove connection failed",
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardPayloadKeys.root,
      });
    },
    onError: (requestError) => {
      onError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove connection",
      );
    },
  });
  const canReconnect =
    Boolean(institution.plaid_item_id) &&
    (!institution.has_active_access_token || institution.has_stale_access_token);
  const canRemove = Boolean(institution.plaid_item_id);
  const isRemoving = removeConnectionMutation.isPending;
  const statusLabel =
    institution.has_stale_access_token || !institution.has_active_access_token
      ? "Reconnect"
      : "Active";

  const reconnect = () => {
    if (!canReconnect || !institution.plaid_item_id) {
      return;
    }

    onReconnect(institution.plaid_item_id);
  };

  const removeConnection = async () => {
    if (!canRemove || !institution.plaid_item_id) {
      return;
    }

    const shouldRemove = window.confirm(
      `Remove ${institution.institution_name}? This will delete its local accounts and transactions from the dashboard.`,
    );

    if (!shouldRemove) {
      return;
    }

    removeConnectionMutation.mutate(institution.plaid_item_id);
  };

  return (
    <article
      className={`${styles.connectionTile} ${
        institution.has_stale_access_token ? styles.staleConnectionTile : ""
      }`}
    >
      <div className={styles.connectionTileHeader}>
        <div>
          <h3>{institution.institution_name}</h3>
          <p>
            {institution.account_count} account
            {institution.account_count === 1 ? "" : "s"}
          </p>
        </div>
        <span className={styles.connectionStatusBadge}>
          {isRemoving ? "Removing" : statusLabel}
        </span>
      </div>

      <div className={styles.connectionTileMeta}>
        <span>{institution.plaid_environment}</span>
      </div>

      <div className={styles.connectionTileActions}>
        {canReconnect && (
          <button type="button" onClick={reconnect}>
            Reconnect
          </button>
        )}
        <button
          type="button"
          className={styles.connectionDangerButton}
          disabled={!canRemove || isRemoving}
          onClick={removeConnection}
        >
          Remove connection
        </button>
      </div>
    </article>
  );
};

export default ConnectionTile;
