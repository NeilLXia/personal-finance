import { useEffect } from "react";

import { transactionRangeOptions } from "../../shared/constants";
import { formatCurrency } from "../../shared/formatters";
import styles from "./index.module.css";
import shared from "../../dashboard.shared.module.css";
import table from "../index.module.css";
import CustomDateRangeInputs from "../../shared/CustomDateRangeInputs";
import RangeSelector from "../../shared/RangeSelector";
import TabRow from "../../shared/TabRow";
import LegendRows from "./LegendRows";
import PieChart from "./PieChart";
import type {
  BreakdownTab,
  DateRange,
  ExpenseCategorySummary,
  TransactionPieSlice,
  TransactionRange,
} from "../../shared/types";

type ExpenseBreakdownModuleProps = {
  activeTab: BreakdownTab;
  monthLabel: string;
  expenseTotal: number;
  expenseCategories: ExpenseCategorySummary[];
  pieSlices: TransactionPieSlice[];
  payslipGrossTotal: number;
  payslipCategories: ExpenseCategorySummary[];
  payslipPieSlices: TransactionPieSlice[];
  hoveredPayslipCategory: string | null;
  openPayslipGroups: Record<string, boolean>;
  transactionRange: TransactionRange;
  transactionCustomRange: DateRange;
  isLoading: boolean;
  selectedCategories: string[];
  openGroups: Record<string, boolean>;
  hoveredCategory: string | null;
  onHoveredCategoryChange: (category: string | null) => void;
  onHoveredPayslipCategoryChange: (category: string | null) => void;
  onTogglePayslipGroup: (category: string) => void;
  onToggleGroup: (category: string) => void;
  onToggleCategory: (category: string) => void;
  onToggleCategoryGroupSelection: (category: string) => void;
  onActiveTabChange: (tab: BreakdownTab) => void;
  onTransactionRangeChange: (range: TransactionRange) => void;
  onTransactionCustomRangeChange: (range: DateRange) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
};

const ExpenseBreakdownModule = ({
  activeTab,
  monthLabel,
  expenseTotal,
  expenseCategories,
  pieSlices,
  payslipGrossTotal,
  payslipCategories,
  payslipPieSlices,
  hoveredPayslipCategory,
  openPayslipGroups,
  transactionRange,
  transactionCustomRange,
  isLoading,
  selectedCategories,
  openGroups,
  hoveredCategory,
  onHoveredCategoryChange,
  onHoveredPayslipCategoryChange,
  onTogglePayslipGroup,
  onToggleGroup,
  onToggleCategory,
  onToggleCategoryGroupSelection,
  onActiveTabChange,
  onTransactionRangeChange,
  onTransactionCustomRangeChange,
  onSelectAll,
  onClearAll,
}: ExpenseBreakdownModuleProps) => {
  const activePieSlices =
    activeTab === "income" ? payslipPieSlices : pieSlices;
  const summaryTitle =
    activeTab === "income" ? "Income breakdown" : "Expenses by type";
  const summaryTotal =
    activeTab === "income" ? payslipGrossTotal : expenseTotal;
  useEffect(() => {
    onHoveredPayslipCategoryChange(null);
    onHoveredCategoryChange(null);
  }, [
    activePieSlices,
    onHoveredCategoryChange,
    onHoveredPayslipCategoryChange,
  ]);

  return (
    <section className={styles.chartSection}>
      {isLoading && (
        <span className={shared.loadingOverlay}>Updating transactions...</span>
      )}
      <PieChart
        activeTab={activeTab}
        expenseCategories={expenseCategories}
        hoveredCategory={hoveredCategory}
        hoveredPayslipCategory={hoveredPayslipCategory}
        pieSlices={activePieSlices}
        selectedCategories={selectedCategories}
        onHoveredCategoryChange={onHoveredCategoryChange}
        onHoveredPayslipCategoryChange={onHoveredPayslipCategoryChange}
        onToggleCategory={onToggleCategory}
        onToggleCategoryGroupSelection={onToggleCategoryGroupSelection}
      />
      <div className={styles.legend}>
        <div className={styles.summaryHeader}>
          <h2>{summaryTitle}</h2>
          <TabRow
            ariaLabel="Summary type"
            compact
            options={[
              { label: "Expenses", value: "expenses" },
              { label: "Income", value: "income" },
            ]}
            value={activeTab}
            onChange={onActiveTabChange}
          />
        </div>
        <p className={styles.monthLabel}>{monthLabel}</p>
        <strong className={styles.expenseTotal}>
          {formatCurrency(summaryTotal)}
        </strong>
        <RangeSelector
          label=""
          layout="inline"
          onChange={onTransactionRangeChange}
          options={transactionRangeOptions}
          value={transactionRange}
        />
        {transactionRange === "custom" && (
          <CustomDateRangeInputs
            value={transactionCustomRange}
            onChange={onTransactionCustomRangeChange}
          />
        )}
        {activeTab === "expenses" && (
          <div className={table.categoryActions}>
            <button
              type="button"
              className={table.categoryActionButton}
              onClick={onSelectAll}
            >
              Select all
            </button>
            <button
              type="button"
              className={table.categoryActionButton}
              onClick={onClearAll}
            >
              Clear all
            </button>
          </div>
        )}
        {activeTab === "income" && (
          <div
            className={`${table.categoryActions} ${table.categoryActionsPlaceholder}`}
            aria-hidden="true"
          />
        )}
        {activeTab === "expenses" && expenseCategories.length === 0 && (
          <p className={shared.emptyText}>
            No categorized expenses for this range.
          </p>
        )}
        {activeTab === "income" && payslipCategories.length === 0 && (
          <p className={shared.emptyText}>No income for this range.</p>
        )}
        <LegendRows
          activeTab={activeTab}
          expenseCategories={expenseCategories}
          expenseTotal={expenseTotal}
          hoveredCategory={hoveredCategory}
          hoveredPayslipCategory={hoveredPayslipCategory}
          openGroups={openGroups}
          openPayslipGroups={openPayslipGroups}
          payslipCategories={payslipCategories}
          payslipGrossTotal={payslipGrossTotal}
          selectedCategories={selectedCategories}
          onHoveredCategoryChange={onHoveredCategoryChange}
          onHoveredPayslipCategoryChange={onHoveredPayslipCategoryChange}
          onToggleCategory={onToggleCategory}
          onToggleGroup={onToggleGroup}
          onTogglePayslipGroup={onTogglePayslipGroup}
        />
      </div>
    </section>
  );
};

export default ExpenseBreakdownModule;
