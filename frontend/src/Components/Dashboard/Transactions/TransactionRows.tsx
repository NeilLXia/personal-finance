import { manualExpenseCategories } from "../shared/constants";
import {
  formatDate,
  formatTransactionAmount,
  getTransactionEffectiveDate,
} from "../shared/formatters";
import { getVenmoDetails } from "../shared/dashboardDataUtils";
import shared from "../dashboard.shared.module.css";
import styles from "./index.module.css";
import type { Transaction } from "../shared/types";
import type { TransactionSortColumn } from "./tableUtils";

type TransactionRowsProps = {
  activeTab: "expenses" | "excluded" | "other_income";
  editingCategoryTransactionId: number | null;
  isBulkSavingCategory: boolean;
  savingCategoryTransactionId: number | null;
  savingDateTransactionId: number | null;
  searchTerms: Record<TransactionSortColumn, string>;
  selectedTransactionIds: number[];
  sortColumn: TransactionSortColumn;
  visibleTransactions: Transaction[];
  onEditingCategoryTransactionIdChange: (transactionId: number | null) => void;
  onSaveManualCategory: (transactionId: number, manualCategory: string) => void;
  onSaveManualDate: (transactionId: number, manualDate: string) => void;
  onToggleTransactionSelection: (transactionId: number) => void;
};

const TransactionRows = ({
  activeTab,
  editingCategoryTransactionId,
  isBulkSavingCategory,
  savingCategoryTransactionId,
  savingDateTransactionId,
  searchTerms,
  selectedTransactionIds,
  sortColumn,
  visibleTransactions,
  onEditingCategoryTransactionIdChange,
  onSaveManualCategory,
  onSaveManualDate,
  onToggleTransactionSelection,
}: TransactionRowsProps) => {
  if (visibleTransactions.length === 0) {
    return (
      <p className={shared.emptyText}>
        No matching{" "}
        {activeTab === "excluded"
          ? "excluded"
          : activeTab === "other_income"
            ? "other income"
            : "expense"}{" "}
        transactions.
      </p>
    );
  }

  return visibleTransactions.map((transaction) => {
    const venmoDetails = getVenmoDetails(transaction);
    const isEditingCategory = editingCategoryTransactionId === transaction.id;
    const isSavingCategory = savingCategoryTransactionId === transaction.id;

    return (
      <article className={styles.transactionRow} key={transaction.id}>
        <label className={styles.transactionSelectCell}>
          <input
            checked={selectedTransactionIds.includes(transaction.id)}
            disabled={isBulkSavingCategory}
            onChange={() => onToggleTransactionSelection(transaction.id)}
            type="checkbox"
          />
          <span className={shared.visuallyHidden}>Select transaction</span>
        </label>
        <div
          className={`${styles.transactionNameCell} ${
            sortColumn === "name" || searchTerms.name
              ? styles.transactionActiveColumn
              : ""
          }`}
        >
          <strong>{transaction.merchant_name || transaction.name}</strong>
          {venmoDetails?.counterparty && (
            <p className={styles.transactionName}>
              Venmo with {venmoDetails.counterparty}
            </p>
          )}
          {venmoDetails?.note && (
            <p className={styles.transactionName}>Note: {venmoDetails.note}</p>
          )}
          {!venmoDetails &&
            transaction.merchant_name &&
            transaction.name &&
            transaction.merchant_name !== transaction.name && (
              <p className={styles.transactionName}>Name: {transaction.name}</p>
            )}
          <p>
            {transaction.account_name}
            {transaction.account_mask ? ` **${transaction.account_mask}` : ""}
          </p>
          <div className={styles.transactionCategories}>
            {isEditingCategory ? (
              <select
                autoFocus
                className={styles.transactionCategorySelect}
                disabled={isSavingCategory}
                onBlur={() => onEditingCategoryTransactionIdChange(null)}
                onChange={(event) => {
                  onEditingCategoryTransactionIdChange(null);
                  onSaveManualCategory(transaction.id, event.target.value);
                }}
                value={transaction.manual_category || ""}
              >
                <option value="">Assign category</option>
                {manualExpenseCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            ) : (
              <button
                className={styles.transactionType}
                disabled={isSavingCategory}
                onClick={() =>
                  onEditingCategoryTransactionIdChange(transaction.id)
                }
                type="button"
              >
                Manual:{" "}
                {isSavingCategory
                  ? "Saving..."
                  : transaction.manual_category || "Assign category"}
              </button>
            )}
            <span className={styles.transactionOriginalType}>
              Plaid:{" "}
              {transaction.original_category ||
                transaction.category ||
                "Uncategorized"}
            </span>
          </div>
        </div>
        <div
          className={`${styles.transactionDateControls} ${
            sortColumn === "date" || searchTerms.date
              ? styles.transactionActiveColumn
              : ""
          }`}
        >
          <input
            className={styles.transactionDateInput}
            disabled={savingDateTransactionId === transaction.id}
            onChange={(event) =>
              onSaveManualDate(transaction.id, event.target.value)
            }
            type="date"
            value={getTransactionEffectiveDate(transaction)}
          />
          {transaction.manual_date && (
            <span>Plaid: {formatDate(transaction.date)}</span>
          )}
        </div>
        <strong
          className={`${styles.transactionAmountCell} ${
            Number(transaction.amount) > 0 ? styles.debit : styles.credit
          } ${
            sortColumn === "amount" || searchTerms.amount
              ? styles.transactionActiveColumn
              : ""
          }`}
        >
          {formatTransactionAmount(transaction.amount)}
        </strong>
      </article>
    );
  });
};

export default TransactionRows;
