import { useEffect, useMemo, useState } from "react";

import { manualExpenseCategories } from "../shared/constants";
import { formatCurrency } from "../shared/formatters";
import styles from "./index.module.css";
import shared from "../dashboard.shared.module.css";
import { getCategorySelectionKey } from "../shared/dashboardDataUtils";
import TabRow from "../shared/TabRow";
import ColumnControls from "./ColumnControls";
import PayslipRows from "./PayslipRows";
import TransactionRows from "./TransactionRows";
import {
  buildSortedPayslips,
  buildSortedTransactions,
  getPayslipSelectionSummary,
  getTransactionSelectionSummary,
} from "./tableUtils";
import type {
  PayslipSortColumn,
  TransactionSortColumn,
  TransactionSortDirection,
} from "./tableUtils";
import type {
  CategoryTotal,
  Payslip,
  Transaction,
  TransactionTableTab,
  BreakdownTab,
} from "../shared/types";

type TransactionsModuleProps = {
  monthLabel: string;
  breakdownTab: BreakdownTab;
  activeTab: TransactionTableTab;
  transactions: Transaction[];
  payslips: Payslip[];
  isLoading: boolean;
  excludedCategories: CategoryTotal[];
  selectedExcludedCategories: string[];
  isShowingExpenseReviewOnly: boolean;
  savingCategoryTransactionId: number | null;
  savingDateTransactionId: number | null;
  onActiveTabChange: (tab: TransactionTableTab) => void;
  onToggleExcludedCategory: (category: string) => void;
  onSelectAllExcluded: () => void;
  onClearAllExcluded: () => void;
  onToggleExpenseReviewOnly: () => void;
  onSaveManualCategory: (transactionId: number, manualCategory: string) => void;
  onBulkSaveManualCategory: (
    transactionIds: number[],
    manualCategory: string,
  ) => Promise<void>;
  onSaveManualDate: (transactionId: number, manualDate: string) => void;
};


const TransactionsModule = ({
  monthLabel,
  breakdownTab,
  activeTab,
  transactions,
  payslips,
  isLoading,
  excludedCategories,
  selectedExcludedCategories,
  isShowingExpenseReviewOnly,
  savingCategoryTransactionId,
  savingDateTransactionId,
  onActiveTabChange,
  onToggleExcludedCategory,
  onSelectAllExcluded,
  onClearAllExcluded,
  onToggleExpenseReviewOnly,
  onSaveManualCategory,
  onBulkSaveManualCategory,
  onSaveManualDate,
}: TransactionsModuleProps) => {
  const [sortColumn, setSortColumn] = useState<TransactionSortColumn>("date");
  const [sortDirection, setSortDirection] =
    useState<TransactionSortDirection>("desc");
  const [payslipSortColumn, setPayslipSortColumn] =
    useState<PayslipSortColumn>("date");
  const [payslipSortDirection, setPayslipSortDirection] =
    useState<TransactionSortDirection>("desc");
  const [searchTerms, setSearchTerms] = useState({
    name: "",
    date: "",
    amount: "",
  });
  const [payslipSearchTerms, setPayslipSearchTerms] = useState({
    company: "",
    date: "",
    amount: "",
  });
  const [expandedPayslipId, setExpandedPayslipId] = useState<number | null>(null);
  const [editingCategoryTransactionId, setEditingCategoryTransactionId] =
    useState<number | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<number[]>(
    [],
  );
  const [bulkCategory, setBulkCategory] = useState("");
  const [isBulkSavingCategory, setIsBulkSavingCategory] = useState(false);

  const visibleTransactions = useMemo(
    () =>
      buildSortedTransactions({
        transactions,
        searchTerms,
        sortColumn,
        sortDirection,
      }),
    [searchTerms, sortColumn, sortDirection, transactions],
  );
  const transactionSelectionSummary = useMemo(
    () => getTransactionSelectionSummary(visibleTransactions),
    [visibleTransactions],
  );
  const visibleTransactionIds = useMemo(
    () => visibleTransactions.map((transaction) => transaction.id),
    [visibleTransactions],
  );
  const selectedVisibleTransactionIds = useMemo(
    () =>
      selectedTransactionIds.filter((transactionId) =>
        visibleTransactionIds.includes(transactionId),
      ),
    [selectedTransactionIds, visibleTransactionIds],
  );
  const areAllVisibleTransactionsSelected =
    visibleTransactionIds.length > 0 &&
    selectedVisibleTransactionIds.length === visibleTransactionIds.length;
  const visiblePayslips = useMemo(
    () =>
      buildSortedPayslips({
        payslips,
        searchTerms: payslipSearchTerms,
        sortColumn: payslipSortColumn,
        sortDirection: payslipSortDirection,
      }),
    [payslips, payslipSearchTerms, payslipSortColumn, payslipSortDirection],
  );
  const payslipSelectionSummary = useMemo(
    () => getPayslipSelectionSummary(visiblePayslips),
    [visiblePayslips],
  );
  const transactionTabOptions =
    breakdownTab === "income"
      ? [
          { label: "Income", value: "income" as const },
          { label: "Other income", value: "other_income" as const },
        ]
      : [
          { label: "Expenses", value: "expenses" as const },
          { label: "Excluded", value: "excluded" as const },
        ];

  const toggleSort = (column: TransactionSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortColumn(column);
    setSortDirection(column === "name" ? "asc" : "desc");
  };

  const togglePayslipSort = (column: PayslipSortColumn) => {
    if (payslipSortColumn === column) {
      setPayslipSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setPayslipSortColumn(column);
    setPayslipSortDirection(column === "company" ? "asc" : "desc");
  };

  useEffect(() => {
    setSelectedTransactionIds((currentTransactionIds) =>
      currentTransactionIds.filter((transactionId) =>
        visibleTransactionIds.includes(transactionId),
      ),
    );
  }, [visibleTransactionIds]);

  const toggleTransactionSelection = (transactionId: number) => {
    setSelectedTransactionIds((currentTransactionIds) =>
      currentTransactionIds.includes(transactionId)
        ? currentTransactionIds.filter(
            (currentTransactionId) => currentTransactionId !== transactionId,
          )
        : [...currentTransactionIds, transactionId],
    );
  };

  const toggleSelectAllVisibleTransactions = () => {
    setSelectedTransactionIds((currentTransactionIds) => {
      if (areAllVisibleTransactionsSelected) {
        return currentTransactionIds.filter(
          (transactionId) => !visibleTransactionIds.includes(transactionId),
        );
      }

      return Array.from(
        new Set([...currentTransactionIds, ...visibleTransactionIds]),
      );
    });
  };

  const saveBulkCategory = async () => {
    if (selectedVisibleTransactionIds.length === 0 || !bulkCategory) {
      return;
    }

    setIsBulkSavingCategory(true);

    try {
      await onBulkSaveManualCategory(selectedVisibleTransactionIds, bulkCategory);
      setSelectedTransactionIds((currentTransactionIds) =>
        currentTransactionIds.filter(
          (transactionId) =>
            !selectedVisibleTransactionIds.includes(transactionId),
        ),
      );
      setBulkCategory("");
    } finally {
      setIsBulkSavingCategory(false);
    }
  };

  return (
    <section className={styles.transactionsSection}>
      {isLoading && (
        <span className={shared.loadingOverlay}>
          Updating{" "}
          {activeTab === "income"
            ? "income"
            : activeTab === "other_income"
              ? "other income"
              : "transactions"}
          ...
        </span>
      )}
      <div className={styles.transactionsHeader}>
        <div>
          <h2 className={shared.dashboardSectionTitle}>
            {monthLabel}{" "}
            {activeTab === "income"
              ? "income"
              : activeTab === "other_income"
                ? "other income"
                : "transactions"}
          </h2>
        </div>
        <div className={styles.transactionsHeaderControls}>
          <TabRow
            ariaLabel="Transaction type"
            options={transactionTabOptions}
            value={activeTab}
            onChange={onActiveTabChange}
          />
        </div>
      </div>
      {activeTab === "excluded" && (
        <div className={styles.excludedFilterPanel}>
          <div className={styles.categoryActions}>
            <button
              type="button"
              className={styles.categoryActionButton}
              onClick={onSelectAllExcluded}
            >
              Select all
            </button>
            <button
              type="button"
              className={styles.categoryActionButton}
              onClick={onClearAllExcluded}
            >
              Clear all
            </button>
          </div>
          <div className={styles.excludedCategoryChips}>
            {excludedCategories.map((category) => {
              const selectionKey = getCategorySelectionKey(category);
              const isSelected = selectedExcludedCategories.includes(selectionKey);

              return (
                <button
                  type="button"
                  className={
                    isSelected
                      ? styles.excludedCategoryChipActive
                      : styles.excludedCategoryChip
                  }
                  key={selectionKey}
                  onClick={() => onToggleExcludedCategory(selectionKey)}
                >
                  <span>{category.category}</span>
                  <strong>{formatCurrency(category.amount)}</strong>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {activeTab === "expenses" && (
        <div className={styles.categoryActions}>
          <button
            type="button"
            className={
              isShowingExpenseReviewOnly
                ? `${styles.categoryActionButton} ${styles.categoryActionButtonActive}`
                : styles.categoryActionButton
            }
            onClick={onToggleExpenseReviewOnly}
          >
            Needs review
          </button>
        </div>
      )}
      {activeTab !== "income" && (
        <div className={styles.bulkTransactionActions}>
          <label className={styles.transactionSelectAll}>
            <input
              checked={areAllVisibleTransactionsSelected}
              disabled={visibleTransactions.length === 0 || isBulkSavingCategory}
              onChange={toggleSelectAllVisibleTransactions}
              type="checkbox"
            />
            Select all
          </label>
          <span>
            {selectedVisibleTransactionIds.length === 1
              ? "1 selected"
              : `${selectedVisibleTransactionIds.length} selected`}
          </span>
          <select
            className={`${styles.transactionCategorySelect} ${styles.bulkCategorySelect}`}
            disabled={
              selectedVisibleTransactionIds.length === 0 || isBulkSavingCategory
            }
            onChange={(event) => setBulkCategory(event.target.value)}
            value={bulkCategory}
          >
            <option value="">Move selected to</option>
            {manualExpenseCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <button
            className={styles.categoryActionButton}
            disabled={
              selectedVisibleTransactionIds.length === 0 ||
              !bulkCategory ||
              isBulkSavingCategory
            }
            onClick={() => void saveBulkCategory()}
            type="button"
          >
            {isBulkSavingCategory ? "Saving" : "Apply"}
          </button>
        </div>
      )}
      {activeTab === "income" ? (
        <ColumnControls
          className={styles.payslipTableControls}
          columns={["date", "company", "amount"]}
          getInputType={(column) => (column === "date" ? "date" : "search")}
          searchTerms={payslipSearchTerms}
          sortColumn={payslipSortColumn}
          sortDirection={payslipSortDirection}
          summary={{
            amount: payslipSelectionSummary.amountTotal,
            company: payslipSelectionSummary.count,
            date: payslipSelectionSummary.dateRange,
          }}
          onSearchTermsChange={setPayslipSearchTerms}
          onSortColumnChange={togglePayslipSort}
        />
      ) : (
        <ColumnControls
          columns={["name", "date", "amount"]}
          searchTerms={searchTerms}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          summary={{
            amount: transactionSelectionSummary.amountTotal,
            date: transactionSelectionSummary.dateRange,
            name: transactionSelectionSummary.count,
          }}
          onSearchTermsChange={setSearchTerms}
          onSortColumnChange={toggleSort}
        />
      )}
      <div className={styles.transactionList}>
        {activeTab === "income" ? (
          <PayslipRows
            expandedPayslipId={expandedPayslipId}
            payslipSearchTerms={payslipSearchTerms}
            payslipSortColumn={payslipSortColumn}
            payslipSortDirection={payslipSortDirection}
            visiblePayslips={visiblePayslips}
            onExpandedPayslipChange={setExpandedPayslipId}
          />
        ) : (
          <TransactionRows
            activeTab={activeTab}
            editingCategoryTransactionId={editingCategoryTransactionId}
            isBulkSavingCategory={isBulkSavingCategory}
            savingCategoryTransactionId={savingCategoryTransactionId}
            savingDateTransactionId={savingDateTransactionId}
            searchTerms={searchTerms}
            selectedTransactionIds={selectedTransactionIds}
            sortColumn={sortColumn}
            visibleTransactions={visibleTransactions}
            onEditingCategoryTransactionIdChange={setEditingCategoryTransactionId}
            onSaveManualCategory={onSaveManualCategory}
            onSaveManualDate={onSaveManualDate}
            onToggleTransactionSelection={toggleTransactionSelection}
          />
        )}
      </div>
    </section>
  );
};

export default TransactionsModule;
