import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { dashboardPayloadKeys } from "../dashboardQueryKeys";
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
  setActiveTransactionTab,
  onError,
}: {
  activeTransactionTab: TransactionTableTab;
  data: DashboardData | null;
  selectedTransactionCategories: string[];
  transactionsInSelectedRange: Transaction[];
  setActiveTransactionTab: (tab: TransactionTableTab) => void;
  onError: (message: string) => void;
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
  const queryClient = useQueryClient();
  const categoryMutation = useMutation({
    mutationFn: ({
      transactionIds,
      manualCategory,
    }: {
      transactionIds: number[];
      manualCategory: string;
      errorMessage: string;
    }) => updateTransactionsCategoryRules(transactionIds, manualCategory),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardPayloadKeys.root,
      });
    },
    onError: (requestError, variables) => {
      onError(
        requestError instanceof Error
          ? requestError.message
          : variables.errorMessage,
      );
    },
    onSettled: () => setSavingCategoryTransactionId(null),
  });
  const manualDateMutation = useMutation({
    mutationFn: ({
      transactionId,
      manualDate,
    }: {
      transactionId: number;
      manualDate: string;
    }) => updateTransactionManualDate(transactionId, manualDate),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardPayloadKeys.root,
      });
    },
    onError: (requestError) => {
      onError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update transaction date",
      );
    },
    onSettled: () => setSavingDateTransactionId(null),
  });

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

  const saveManualCategory = (
    transactionId: number,
    manualCategory: string,
  ) => {
    if (!manualCategory) {
      return;
    }

    setSavingCategoryTransactionId(transactionId);
    categoryMutation.mutate({
      transactionIds: [transactionId],
      manualCategory,
      errorMessage: "Unable to update transaction category",
    });
  };

  const saveBulkManualCategory = async (
    transactionIds: number[],
    manualCategory: string,
  ) => {
    if (transactionIds.length === 0 || !manualCategory) {
      return;
    }

    setSavingCategoryTransactionId(-1);
    await categoryMutation.mutateAsync({
      transactionIds,
      manualCategory,
      errorMessage: "Unable to update transaction categories",
    });
  };

  const saveManualDate = (transactionId: number, manualDate: string) => {
    setSavingDateTransactionId(transactionId);
    manualDateMutation.mutate({ transactionId, manualDate });
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
