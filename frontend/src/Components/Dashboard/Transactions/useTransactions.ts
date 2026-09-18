import { useEffect, useMemo, useState } from "react";

import {
  getCategorySelectionKey,
  getExcludedCategorySelectionKey,
  getExcludedTransactionCategory,
  getTransactionDisplayCategory,
  summarizeExcludedTransactions,
} from "../shared/dashboardDataUtils";
import type {
  DashboardData,
  Transaction,
  TransactionTableTab,
} from "../shared/types";
import {
  updateTransactionManualDate,
  updateTransactionsCategoryRules,
} from "./transactionsApi";

export const useTransactions = ({
  activeTransactionTab,
  data,
  selectedTransactionCategories,
  transactionsInSelectedRange,
  reloadDashboard,
  setActiveTransactionTab,
  setError,
}: {
  activeTransactionTab: TransactionTableTab;
  data: DashboardData | null;
  selectedTransactionCategories: string[];
  transactionsInSelectedRange: Transaction[];
  reloadDashboard: () => Promise<void>;
  setActiveTransactionTab: (tab: TransactionTableTab) => void;
  setError: (error: string | null) => void;
}) => {
  const [selectedExcludedCategories, setSelectedExcludedCategories] = useState<
    string[]
  >([]);
  const [isShowingExpenseReviewOnly, setIsShowingExpenseReviewOnly] =
    useState(false);
  const [
    hasInitializedExcludedCategories,
    setHasInitializedExcludedCategories,
  ] = useState(false);
  const [savingCategoryTransactionId, setSavingCategoryTransactionId] =
    useState<number | null>(null);
  const [savingDateTransactionId, setSavingDateTransactionId] = useState<
    number | null
  >(null);

  const payslipIncomeTransactionIds = useMemo(
    () =>
      new Set(
        (data?.payslips || [])
          .map((payslip) => payslip.income_transaction_id)
          .filter(Boolean)
          .map(String),
      ),
    [data],
  );
  const otherIncomeTransactions = useMemo(
    () =>
      transactionsInSelectedRange.filter(
        (transaction) =>
          transaction.cash_flow_type === "income" &&
          !payslipIncomeTransactionIds.has(String(transaction.id)),
      ),
    [payslipIncomeTransactionIds, transactionsInSelectedRange],
  );
  const otherIncomeTotal = useMemo(
    () =>
      Number(
        otherIncomeTransactions
          .reduce(
            (total, transaction) =>
              total + Math.abs(Number(transaction.amount || 0)),
            0,
          )
          .toFixed(2),
      ),
    [otherIncomeTransactions],
  );
  const excludedCategorySummary = useMemo(
    () => summarizeExcludedTransactions(transactionsInSelectedRange),
    [transactionsInSelectedRange],
  );
  const excludedCategories = useMemo(
    () => excludedCategorySummary?.children || [],
    [excludedCategorySummary],
  );
  const excludedCategoryNames = useMemo(
    () => excludedCategories.map((category) => getCategorySelectionKey(category)),
    [excludedCategories],
  );

  useEffect(() => {
    if (excludedCategoryNames.length === 0) {
      setSelectedExcludedCategories([]);
      return;
    }

    if (!hasInitializedExcludedCategories) {
      setSelectedExcludedCategories(excludedCategoryNames);
      setHasInitializedExcludedCategories(true);
      return;
    }

    setSelectedExcludedCategories((currentCategories) => {
      const knownCategories = currentCategories.filter((category) =>
        excludedCategoryNames.includes(category),
      );

      if (knownCategories.length === 0) {
        return [];
      }

      return knownCategories.length === currentCategories.length
        ? currentCategories
        : knownCategories;
    });
  }, [excludedCategoryNames, hasInitializedExcludedCategories]);

  const filteredTransactions = useMemo(() => {
    if (!data) {
      return [];
    }

    if (activeTransactionTab === "income") {
      return [];
    }

    if (activeTransactionTab === "other_income") {
      return transactionsInSelectedRange.filter(
        (transaction) =>
          transaction.cash_flow_type === "income" &&
          !payslipIncomeTransactionIds.has(String(transaction.id)),
      );
    }

    if (activeTransactionTab === "expenses") {
      if (isShowingExpenseReviewOnly) {
        return transactionsInSelectedRange.filter(
          (transaction) => transaction.is_expense && !transaction.manual_category,
        );
      }

      if (selectedTransactionCategories.length === 0) {
        return [];
      }

      return transactionsInSelectedRange.filter(
        (transaction) =>
          transaction.is_expense &&
          selectedTransactionCategories.includes(
            getTransactionDisplayCategory(transaction),
          ),
      );
    }

    if (selectedExcludedCategories.length === 0) {
      return [];
    }

    return transactionsInSelectedRange.filter(
      (transaction) =>
        !transaction.is_expense &&
        selectedExcludedCategories.includes(
          getExcludedCategorySelectionKey(
            getExcludedTransactionCategory(transaction),
          ),
        ),
    );
  }, [
    activeTransactionTab,
    data,
    isShowingExpenseReviewOnly,
    payslipIncomeTransactionIds,
    selectedExcludedCategories,
    selectedTransactionCategories,
    transactionsInSelectedRange,
  ]);

  const resetExcludedCategorySelections = () => {
    setSelectedExcludedCategories([]);
    setHasInitializedExcludedCategories(false);
  };

  const toggleExcludedCategory = (category: string) => {
    setSelectedExcludedCategories((currentCategories) =>
      currentCategories.includes(category)
        ? currentCategories.filter((currentCategory) => currentCategory !== category)
        : [...currentCategories, category],
    );
  };

  const saveManualCategory = async (
    transactionId: number,
    manualCategory: string,
  ) => {
    if (!manualCategory) {
      return;
    }

    setSavingCategoryTransactionId(transactionId);

    try {
      await updateTransactionsCategoryRules([transactionId], manualCategory);
      await reloadDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update transaction category",
      );
    } finally {
      setSavingCategoryTransactionId(null);
    }
  };

  const saveBulkManualCategory = async (
    transactionIds: number[],
    manualCategory: string,
  ) => {
    if (transactionIds.length === 0 || !manualCategory) {
      return;
    }

    setSavingCategoryTransactionId(-1);

    try {
      await updateTransactionsCategoryRules(transactionIds, manualCategory);
      await reloadDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update transaction categories",
      );
      throw requestError;
    } finally {
      setSavingCategoryTransactionId(null);
    }
  };

  const saveManualDate = async (transactionId: number, manualDate: string) => {
    setSavingDateTransactionId(transactionId);

    try {
      await updateTransactionManualDate(transactionId, manualDate);
      await reloadDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update transaction date",
      );
    } finally {
      setSavingDateTransactionId(null);
    }
  };

  return {
    activeTransactionTab,
    excludedCategories,
    excludedCategoryNames,
    filteredTransactions,
    isShowingExpenseReviewOnly,
    otherIncomeTotal,
    otherIncomeTransactions,
    savingCategoryTransactionId,
    savingDateTransactionId,
    selectedExcludedCategories,
    resetExcludedCategorySelections,
    saveBulkManualCategory,
    saveManualCategory,
    saveManualDate,
    setActiveTransactionTab,
    setIsShowingExpenseReviewOnly,
    setSelectedExcludedCategories,
    toggleExcludedCategory,
  };
};
