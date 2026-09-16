import { useState } from "react";

import CreditCardRewardsPage from "../CreditCardRewards";
import { useCreditCardRewards } from "../CreditCardRewards/useCreditCardRewards";
import WealthChangeModule from "./WealthChange";
import { useWealthChange } from "./WealthChange/useWealthChange";
import IncomeAllocationModule from "./IncomeAllocation";
import { useIncomeAllocation } from "./IncomeAllocation/useIncomeAllocation";
import DashboardToolbar from "./DashboardToolbar";
import ExpenseBreakdownModule from "./Transactions/Breakdown";
import { useExpenseBreakdown } from "./Transactions/useExpenseBreakdown";
import {
  NetWorthBreakdownPanel,
  NetWorthChartPanel,
  NetWorthSummary,
} from "./NetWorth";
import { useNetWorth } from "./NetWorth/useNetWorth";
import PayslipUploadModal from "./Modals/PayslipUploadModal";
import RealEstateModal from "./Modals/RealEstateModal";
import SettingsModal from "./Modals/SettingsModal";
import TransactionsModule from "./Transactions";
import { useAppContext } from "../../Context";
import { useIncomeBreakdown } from "./Transactions/useIncomeBreakdown";
import styles from "./index.module.css";
import { useDashboardData } from "./useDashboardData";
import { useDashboardFilters } from "./useDashboardFilters";
import { useDashboardLogout } from "./useDashboardLogout";
import { useTransactions } from "./Transactions/useTransactions";
import type { TransactionTableTab } from "./shared/types";

const Dashboard = () => {
  const { authUser, dispatch } = useAppContext();
  const logout = useDashboardLogout(dispatch);
  const filters = useDashboardFilters();
  const { selectedMonth } = filters;
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isRealEstateModalOpen, setIsRealEstateModalOpen] = useState(false);
  const [isPayslipUploadModalOpen, setIsPayslipUploadModalOpen] =
    useState(false);
  const [activeTransactionTab, setActiveTransactionTab] =
    useState<TransactionTableTab>("expenses");
  const [activePage, setActivePage] = useState<
    "dashboard" | "credit-card-rewards"
  >("dashboard");

  const {
    data,
    isLoading,
    error,
    reportError,
    changeTransactionCustomRange,
    changeTransactionRange,
    manuallyRefreshData,
    isTransactionRangeLoading,
    isIncomeAllocationLoading,
    isManualRefreshLoading,
    isSnapshotLoading,
  } = useDashboardData(filters);
  const creditCardRewards = useCreditCardRewards({ selectedMonth });
  const netWorth = useNetWorth({
    data,
    selectedMonth,
  });
  const wealthChange = useWealthChange({ data });
  const incomeAllocation = useIncomeAllocation({
    data,
    incomeAllocationRange: filters.incomeAllocationRange,
    incomeAllocationMode: filters.incomeAllocationMode,
    incomeAllocationCustomRange: filters.incomeAllocationCustomRange,
    setIncomeAllocationRange: filters.setIncomeAllocationRange,
    setIncomeAllocationMode: filters.setIncomeAllocationMode,
    setIncomeAllocationCustomRange: filters.setIncomeAllocationCustomRange,
  });
  const expenseBreakdown = useExpenseBreakdown({
    data,
    selectedMonth,
    transactionCustomRange: filters.transactionCustomRange,
    transactionRange: filters.transactionRange,
    changeTransactionCustomRange,
    changeTransactionRange,
    setActiveTransactionTab,
  });

  const transactions = useTransactions({
    activeTransactionTab,
    data,
    selectedTransactionCategories:
      expenseBreakdown.selectedTransactionCategories,
    setActiveTransactionTab,
    onError: reportError,
    transactionsInSelectedRange: expenseBreakdown.transactionsInSelectedRange,
  });
  const incomeBreakdown = useIncomeBreakdown({
    data,
    otherIncomeCount: transactions.otherIncomeTransactions.length,
    otherIncomeTotal: transactions.otherIncomeTotal,
  });

  const changeSelectedMonth = (month: string) => {
    filters.setSelectedMonth(month);
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

  const isAdmin = authUser?.account_type === "admin";

  return (
    <main className={styles.dashboard}>
      <DashboardToolbar
        institutions={data.institutions}
        selectedMonth={selectedMonth}
        areBalancesHidden={netWorth.areBalancesHidden}
        isManualRefreshLoading={isManualRefreshLoading}
        onSelectedMonthChange={changeSelectedMonth}
        onError={reportError}
        onToggleBalanceVisibility={() =>
          netWorth.setAreBalancesHidden((areHidden) => !areHidden)
        }
        onManualRefresh={manuallyRefreshData}
        activePage={activePage}
        isCreditCardRewardsAvailable={true}
        isOwner={isAdmin}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenRealEstate={() => setIsRealEstateModalOpen(true)}
        onOpenPayslips={() => setIsPayslipUploadModalOpen(true)}
        onShowCreditCardRewards={() => setActivePage("credit-card-rewards")}
        onShowDashboard={() => setActivePage("dashboard")}
        onLogout={logout}
      />

      {activePage === "credit-card-rewards" ? (
        <CreditCardRewardsPage
          data={creditCardRewards.data}
          error={creditCardRewards.error}
          isLoading={creditCardRewards.isLoading}
          isOptimizationLoading={creditCardRewards.isOptimizationLoading}
          isUpdating={creditCardRewards.isUpdating}
          isUpdatingPerkCompletion={creditCardRewards.isUpdatingPerkCompletion}
          optimizationData={creditCardRewards.optimizationData}
          optimizationError={creditCardRewards.optimizationError}
          onAccountTypeChange={creditCardRewards.updateAccountType}
          onLoadOptimization={creditCardRewards.loadOptimization}
          onPerkCompletionChange={creditCardRewards.updatePerkCompletion}
          onBackToDashboard={() => setActivePage("dashboard")}
        />
      ) : (
        <div className={styles.dashboardContent} aria-busy={isSnapshotLoading}>
        {isSnapshotLoading && (
          <div className={styles.snapshotLoadingOverlay} aria-hidden="true" />
        )}
        <div className={styles.summaryGrid}>
          <div className={styles.netWorthSummaryArea}>
            <NetWorthSummary
              areBalancesHidden={netWorth.areBalancesHidden}
              currentNetWorth={netWorth.currentNetWorth}
            />
          </div>
          <div className={styles.netWorthChartArea}>
            <NetWorthChartPanel
              areBalancesHidden={netWorth.areBalancesHidden}
              chart={netWorth.chart}
              trailingMonths={netWorth.trailingMonths}
              onTrailingMonthsChange={netWorth.setTrailingMonths}
            />
          </div>
          <div className={styles.wealthChangeArea}>
            <WealthChangeModule
              wealthChangeChart={wealthChange.wealthChangeChart}
              categories={wealthChange.wealthChangeCategories}
              hoveredBarId={wealthChange.hoveredWealthChangeBarId}
              onHoveredBarChange={wealthChange.setHoveredWealthChangeBarId}
            />
          </div>
          <div className={styles.netWorthBreakdownArea}>
            <NetWorthBreakdownPanel
              areBalancesHidden={netWorth.areBalancesHidden}
              breakdown={netWorth.breakdown}
              breakdownDates={netWorth.breakdownDates}
              openCategories={netWorth.openCategories}
              tableColumns={netWorth.tableColumns}
              onToggleCategory={netWorth.toggleCategory}
            />
          </div>
          <div className={styles.incomeAllocationArea}>
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
              onRangeChange={incomeAllocation.setIncomeAllocationRange}
              onCustomRangeChange={
                incomeAllocation.setIncomeAllocationCustomRange
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
          onHoveredCategoryChange={
            expenseBreakdown.setHoveredTransactionCategory
          }
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
          onClearAll={() =>
            expenseBreakdown.setSelectedTransactionCategories([])
          }
        />

        <TransactionsModule
          selectedMonth={selectedMonth}
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
          onClearAllExcluded={() =>
            transactions.setSelectedExcludedCategories([])
          }
          onToggleExpenseReviewOnly={() =>
            transactions.setIsShowingExpenseReviewOnly(
              (isShowingReviewOnly) => !isShowingReviewOnly,
            )
          }
          onSaveManualCategory={transactions.saveManualCategory}
          onBulkSaveManualCategory={transactions.saveBulkManualCategory}
          onSaveManualDate={transactions.saveManualDate}
          onError={reportError}
        />
        </div>
      )}
      {isSettingsModalOpen && (
        <SettingsModal
          cardTypes={creditCardRewards.data?.card_types || []}
          isCardTypeManager={isAdmin}
          isDeletingCardType={creditCardRewards.isDeletingCardType}
          isImportingVectorMintCards={
            creditCardRewards.isImportingVectorMintCards
          }
          isSavingCardType={
            creditCardRewards.isCreatingCardType ||
            creditCardRewards.isUpdatingCardType
          }
          onClose={() => setIsSettingsModalOpen(false)}
          onCreateCardType={creditCardRewards.createCardType}
          onDeleteCardType={creditCardRewards.deleteCardType}
          onError={reportError}
          onImportVectorMintCards={creditCardRewards.importVectorMintCards}
          onUpdateCardType={creditCardRewards.updateCardType}
        />
      )}
      {isRealEstateModalOpen && (
        <RealEstateModal
          onClose={() => setIsRealEstateModalOpen(false)}
          onError={reportError}
        />
      )}
      {isPayslipUploadModalOpen && (
        <PayslipUploadModal
          onClose={() => setIsPayslipUploadModalOpen(false)}
          onError={reportError}
        />
      )}
    </main>
  );
};

export default Dashboard;
