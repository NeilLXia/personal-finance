import { useState } from "react";

import BudgetTargetsModal from "./Modals/BudgetTargetsModal";
import WealthChangeModule from "./WealthChange";
import { useWealthChange } from "./WealthChange/useWealthChange";
import IncomeAllocationModule from "./IncomeAllocation";
import {
  useIncomeAllocation,
  useIncomeAllocationControls,
} from "./IncomeAllocation/useIncomeAllocation";
import CategoryRulesModal from "./Modals/CategoryRulesModal";
import DashboardToolbar from "./DashboardToolbar";
import { logoutUser } from "./dashboardApi";
import ExpenseBreakdownModule from "./Transactions/Breakdown";
import { useExpenseBreakdown } from "./Transactions/useExpenseBreakdown";
import NetWorthModule from "./NetWorth";
import { useNetWorth } from "./NetWorth/useNetWorth";
import PayslipUploadModal from "./Modals/PayslipUploadModal";
import RealEstateModal from "./Modals/RealEstateModal";
import TransactionsModule from "./Transactions";
import { useAppContext } from "../../Context";
import { getDefaultDashboardMonth } from "./shared/formatters";
import { useIncomeBreakdown } from "./Transactions/useIncomeBreakdown";
import styles from "./index.module.css";
import { useDashboardData } from "./useDashboardData";
import { useTransactions } from "./Transactions/useTransactions";
import type { TransactionTableTab } from "./shared/types";

const Dashboard = () => {
  const { dispatch } = useAppContext();
  const [selectedMonth, setSelectedMonth] = useState(getDefaultDashboardMonth);
  const incomeAllocationControls = useIncomeAllocationControls();
  const [isCategoryRulesModalOpen, setIsCategoryRulesModalOpen] =
    useState(false);
  const [isBudgetTargetsModalOpen, setIsBudgetTargetsModalOpen] =
    useState(false);
  const [isRealEstateModalOpen, setIsRealEstateModalOpen] = useState(false);
  const [isPayslipUploadModalOpen, setIsPayslipUploadModalOpen] =
    useState(false);
  const [activeTransactionTab, setActiveTransactionTab] =
    useState<TransactionTableTab>("expenses");

  const {
    data,
    isLoading,
    error,
    setError,
    loadDashboard,
    loadIncomeAllocation,
    changeTransactionCustomRange,
    changeTransactionRange,
    manuallyRefreshData,
    transactionCustomRange,
    transactionRange,
    isTransactionRangeLoading,
    isIncomeAllocationLoading,
    isManualRefreshLoading,
  } = useDashboardData({
    selectedMonth,
    incomeAllocationRange: incomeAllocationControls.incomeAllocationRange,
    incomeAllocationCustomRange:
      incomeAllocationControls.incomeAllocationCustomRange,
  });
  const netWorth = useNetWorth({
    data,
    selectedMonth,
  });
  const wealthChange = useWealthChange({ data });
  const incomeAllocation = useIncomeAllocation({
    data,
    loadIncomeAllocation,
    ...incomeAllocationControls,
  });
  const expenseBreakdown = useExpenseBreakdown({
    data,
    selectedMonth,
    transactionCustomRange,
    transactionRange,
    changeTransactionCustomRange,
    changeTransactionRange,
    setActiveTransactionTab,
  });

  const logout = async () => {
    await logoutUser();
    localStorage.removeItem("link_token");
    dispatch({
      type: "AUTH_EXPIRED",
    });
  };

  const transactionsInSelectedRange =
    expenseBreakdown.transactionsInSelectedRange;
  const transactions = useTransactions({
    activeTransactionTab,
    data,
    reloadDashboard: () => loadDashboard({ preserveScroll: true }),
    selectedTransactionCategories: expenseBreakdown.selectedTransactionCategories,
    setActiveTransactionTab,
    setError,
    transactionsInSelectedRange,
  });
  const incomeBreakdown = useIncomeBreakdown({
    data,
    otherIncomeCount: transactions.otherIncomeTransactions.length,
    otherIncomeTotal: transactions.otherIncomeTotal,
  });

  const changeSelectedMonth = (month: string) => {
    setSelectedMonth(month);
    expenseBreakdown.resetTransactionCategorySelections();
    transactions.resetExcludedCategorySelections();
    transactions.setIsShowingExpenseReviewOnly(false);
  };

  if (isLoading) {
    return <main className={styles.dashboard}>Loading dashboard</main>;
  }

  if (error) {
    return <main className={styles.dashboardError}>{error}</main>;
  }

  if (!data) {
    return null;
  }

  return (
    <main className={styles.dashboard}>
      <DashboardToolbar
        institutions={data.institutions}
        selectedMonth={selectedMonth}
        areBalancesHidden={netWorth.areBalancesHidden}
        isManualRefreshLoading={isManualRefreshLoading}
        onSelectedMonthChange={changeSelectedMonth}
        onReconnectComplete={loadDashboard}
        onError={setError}
        onToggleBalanceVisibility={() =>
          netWorth.setAreBalancesHidden((areHidden) => !areHidden)
        }
        onManualRefresh={manuallyRefreshData}
        onOpenCategoryRules={() => setIsCategoryRulesModalOpen(true)}
        onOpenBudgetTargets={() => setIsBudgetTargetsModalOpen(true)}
        onOpenRealEstate={() => setIsRealEstateModalOpen(true)}
        onOpenPayslips={() => setIsPayslipUploadModalOpen(true)}
        onLogout={logout}
      />

      <div className={styles.summaryGrid}>
        <NetWorthModule
          currentNetWorth={netWorth.currentNetWorth}
          chart={netWorth.chart}
          breakdown={netWorth.breakdown}
          breakdownDates={netWorth.breakdownDates}
          tableColumns={netWorth.tableColumns}
          trailingMonths={netWorth.trailingMonths}
          areBalancesHidden={netWorth.areBalancesHidden}
          openCategories={netWorth.openCategories}
          onTrailingMonthsChange={netWorth.setTrailingMonths}
          onToggleCategory={netWorth.toggleCategory}
        />
        <div className={styles.rightColumn}>
          <WealthChangeModule
            wealthChangeChart={wealthChange.wealthChangeChart}
            categories={data.monthly_cash_flow.categories}
            hoveredBarId={wealthChange.hoveredWealthChangeBarId}
            onHoveredBarChange={wealthChange.setHoveredWealthChangeBarId}
          />
          <IncomeAllocationModule
            areBalancesHidden={netWorth.areBalancesHidden}
            incomeLabel={data.income_allocation.label}
            income={incomeAllocation.income}
            mode={incomeAllocation.incomeAllocationMode}
            range={incomeAllocation.incomeAllocationRange}
            customRange={incomeAllocation.incomeAllocationCustomRange}
            segments={incomeAllocation.incomeAllocationSegments}
            isLoading={isIncomeAllocationLoading}
            onModeChange={incomeAllocation.setIncomeAllocationMode}
            onRangeChange={incomeAllocation.changeIncomeAllocationRange}
            onCustomRangeChange={
              incomeAllocation.changeIncomeAllocationCustomRange
            }
          />
        </div>
      </div>

      <ExpenseBreakdownModule
        activeTab={expenseBreakdown.activeBreakdownTab}
        monthLabel={expenseBreakdown.transactionRangeLabel}
        expenseTotal={expenseBreakdown.transactionExpenseTotal}
        expenseCategories={expenseBreakdown.expenseCategorySummaries}
        pieSlices={expenseBreakdown.transactionPieSlices}
        payslipGrossTotal={incomeBreakdown.payslipGrossTotal}
        payslipCategories={incomeBreakdown.payslipCategories}
        payslipPieSlices={incomeBreakdown.payslipPieSlices}
        hoveredPayslipCategory={incomeBreakdown.hoveredPayslipCategory}
        openPayslipGroups={incomeBreakdown.openPayslipGroups}
        transactionRange={expenseBreakdown.transactionRange}
        transactionCustomRange={expenseBreakdown.transactionCustomRange}
        isLoading={isTransactionRangeLoading}
        selectedCategories={expenseBreakdown.selectedTransactionCategories}
        openGroups={expenseBreakdown.openExpenseCategoryGroups}
        hoveredCategory={expenseBreakdown.hoveredTransactionCategory}
        onHoveredCategoryChange={expenseBreakdown.setHoveredTransactionCategory}
        onHoveredPayslipCategoryChange={
          incomeBreakdown.setHoveredPayslipCategory
        }
        onTogglePayslipGroup={incomeBreakdown.togglePayslipGroup}
        onToggleGroup={expenseBreakdown.toggleExpenseCategoryGroup}
        onToggleCategory={expenseBreakdown.toggleTransactionCategory}
        onToggleCategoryGroupSelection={
          expenseBreakdown.toggleTransactionCategoryGroupSelection
        }
        onActiveTabChange={expenseBreakdown.changeBreakdownTab}
        onTransactionRangeChange={expenseBreakdown.changeTransactionRange}
        onTransactionCustomRangeChange={
          expenseBreakdown.changeTransactionCustomRange
        }
        onSelectAll={() =>
          expenseBreakdown.setSelectedTransactionCategories(
            expenseBreakdown.transactionCategoryNames,
          )
        }
        onClearAll={() => expenseBreakdown.setSelectedTransactionCategories([])}
      />

      <TransactionsModule
        monthLabel={expenseBreakdown.transactionRangeLabel}
        breakdownTab={expenseBreakdown.activeBreakdownTab}
        activeTab={activeTransactionTab}
        transactions={transactions.filteredTransactions}
        payslips={data.payslips}
        isLoading={isTransactionRangeLoading}
        excludedCategories={transactions.excludedCategories}
        selectedExcludedCategories={transactions.selectedExcludedCategories}
        isShowingExpenseReviewOnly={transactions.isShowingExpenseReviewOnly}
        savingCategoryTransactionId={transactions.savingCategoryTransactionId}
        savingDateTransactionId={transactions.savingDateTransactionId}
        onActiveTabChange={transactions.setActiveTransactionTab}
        onToggleExcludedCategory={transactions.toggleExcludedCategory}
        onSelectAllExcluded={() =>
          transactions.setSelectedExcludedCategories(
            transactions.excludedCategoryNames,
          )
        }
        onClearAllExcluded={() => transactions.setSelectedExcludedCategories([])}
        onToggleExpenseReviewOnly={() =>
          transactions.setIsShowingExpenseReviewOnly(
            (isShowingReviewOnly) => !isShowingReviewOnly,
          )
        }
        onSaveManualCategory={transactions.saveManualCategory}
        onBulkSaveManualCategory={transactions.saveBulkManualCategory}
        onSaveManualDate={transactions.saveManualDate}
      />
      {isCategoryRulesModalOpen && (
        <CategoryRulesModal
          onClose={() => setIsCategoryRulesModalOpen(false)}
          onError={setError}
        />
      )}
      {isBudgetTargetsModalOpen && (
        <BudgetTargetsModal
          onClose={() => setIsBudgetTargetsModalOpen(false)}
          onChanged={() => loadDashboard({ preserveScroll: true })}
          onError={setError}
        />
      )}
      {isRealEstateModalOpen && (
        <RealEstateModal
          onClose={() => setIsRealEstateModalOpen(false)}
          onChanged={() => loadDashboard({ preserveScroll: true })}
          onError={setError}
        />
      )}
      {isPayslipUploadModalOpen && (
        <PayslipUploadModal
          onClose={() => setIsPayslipUploadModalOpen(false)}
          onError={setError}
        />
      )}
    </main>
  );
};

export default Dashboard;
