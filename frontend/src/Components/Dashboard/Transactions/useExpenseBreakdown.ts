import { useEffect, useMemo, useState } from "react";

import { getMonthDateRange } from "../shared/dashboardStateUtils";
import { formatDateRange } from "../shared/formatters";
import {
  buildExpenseCategorySummaries,
  getCategorySelectionKey,
  summarizeTransactionsByDisplayCategory,
} from "../shared/dashboardDataUtils";
import type {
  BreakdownTab,
  DashboardData,
  DateRange,
  TransactionRange,
  TransactionTableTab,
} from "../shared/types";
import { buildTransactionPieSlices } from "./Breakdown/chartUtils";

export const useExpenseBreakdown = ({
  data,
  selectedMonth,
  transactionCustomRange,
  transactionRange,
  changeTransactionCustomRange,
  changeTransactionRange,
  setActiveTransactionTab,
}: {
  data: DashboardData | null;
  selectedMonth: string;
  transactionCustomRange: DateRange;
  transactionRange: TransactionRange;
  changeTransactionCustomRange: (range: DateRange) => void;
  changeTransactionRange: (range: TransactionRange) => void;
  setActiveTransactionTab: (
    tab:
      TransactionTableTab | ((tab: TransactionTableTab) => TransactionTableTab),
  ) => void;
}) => {
  const [activeBreakdownTab, setActiveBreakdownTab] =
    useState<BreakdownTab>("expenses");
  const [openExpenseCategoryGroups, setOpenExpenseCategoryGroups] = useState<
    Record<string, boolean>
  >({});
  const [hoveredTransactionCategory, setHoveredTransactionCategory] = useState<
    string | null
  >(null);
  const [selectedTransactionCategories, setSelectedTransactionCategories] =
    useState<string[]>([]);
  const [
    hasInitializedTransactionCategories,
    setHasInitializedTransactionCategories,
  ] = useState(false);

  const transactionsInSelectedRange = useMemo(
    () => data?.latest_transactions || [],
    [data],
  );
  const detailedTransactionCategories = useMemo(
    () =>
      summarizeTransactionsByDisplayCategory(
        transactionsInSelectedRange.filter(
          (transaction) => transaction.is_expense,
        ),
      ),
    [transactionsInSelectedRange],
  );
  const expenseCategorySummaries = useMemo(
    () => buildExpenseCategorySummaries(detailedTransactionCategories),
    [detailedTransactionCategories],
  );
  const topLevelTransactionCategories = useMemo(
    () =>
      expenseCategorySummaries.map((category) => ({
        category: category.category,
        amount: category.amount,
        count: category.count,
      })),
    [expenseCategorySummaries],
  );
  const transactionPieSlices = useMemo(
    () => buildTransactionPieSlices(topLevelTransactionCategories),
    [topLevelTransactionCategories],
  );
  const transactionExpenseTotal = useMemo(
    () =>
      detailedTransactionCategories.reduce(
        (total, category) => total + category.amount,
        0,
      ),
    [detailedTransactionCategories],
  );
  const transactionCategoryNames = useMemo(
    () => detailedTransactionCategories.map((category) => category.category),
    [detailedTransactionCategories],
  );
  const transactionDateRange = useMemo(() => {
    if (data?.transaction_range.start_date && data.transaction_range.end_date) {
      return {
        startDate: data.transaction_range.start_date,
        endDate: data.transaction_range.end_date,
      };
    }

    return transactionRange === "custom"
      ? transactionCustomRange
      : getMonthDateRange(selectedMonth, transactionRange);
  }, [data, selectedMonth, transactionCustomRange, transactionRange]);
  const transactionRangeLabel = useMemo(() => {
    const startDate =
      data?.transaction_range.start_date || transactionDateRange.startDate;
    const endDate =
      data?.transaction_range.end_date || transactionDateRange.endDate;
    const label =
      data?.transaction_range.label ||
      (transactionRange === "custom"
        ? "Specific date range"
        : transactionRange === 1
          ? "1 month"
          : `${transactionRange} months ending ${selectedMonth}`);

    return `${label} (${formatDateRange(startDate, endDate)})`;
  }, [data, selectedMonth, transactionDateRange, transactionRange]);

  useEffect(() => {
    if (transactionCategoryNames.length === 0) {
      setSelectedTransactionCategories([]);
      return;
    }

    if (!hasInitializedTransactionCategories) {
      setSelectedTransactionCategories(transactionCategoryNames);
      setHasInitializedTransactionCategories(true);
      return;
    }

    setSelectedTransactionCategories((currentCategories) => {
      const knownCategories = currentCategories.filter((category) =>
        transactionCategoryNames.includes(category),
      );

      if (knownCategories.length === 0) {
        return [];
      }

      return knownCategories.length === currentCategories.length
        ? currentCategories
        : knownCategories;
    });
  }, [hasInitializedTransactionCategories, transactionCategoryNames]);

  const resetTransactionCategorySelections = () => {
    setSelectedTransactionCategories([]);
    setHasInitializedTransactionCategories(false);
  };

  const toggleExpenseCategoryGroup = (category: string) => {
    setOpenExpenseCategoryGroups((currentGroups) => ({
      ...currentGroups,
      [category]: !currentGroups[category],
    }));
  };

  const toggleTransactionCategory = (category: string) => {
    setSelectedTransactionCategories((currentCategories) => {
      const currentSelection =
        currentCategories.length > 0 ? currentCategories : [];

      return currentSelection.includes(category)
        ? currentSelection.filter(
            (currentCategory) => currentCategory !== category,
          )
        : [...currentSelection, category];
    });
  };

  const toggleTransactionCategoryGroupSelection = (category: string) => {
    const summary = expenseCategorySummaries.find(
      (categorySummary) => categorySummary.category === category,
    );

    if (!summary) {
      return;
    }

    if (summary.kind !== "group") {
      toggleTransactionCategory(summary.category);
      return;
    }

    const childCategories = summary.children.map((child) =>
      getCategorySelectionKey(child),
    );

    setSelectedTransactionCategories((currentCategories) => {
      const selectedCategorySet = new Set(currentCategories);
      const areAllChildrenSelected = childCategories.every((childCategory) =>
        selectedCategorySet.has(childCategory),
      );

      if (areAllChildrenSelected) {
        return currentCategories.filter(
          (currentCategory) => !childCategories.includes(currentCategory),
        );
      }

      childCategories.forEach((childCategory) => {
        selectedCategorySet.add(childCategory);
      });

      return Array.from(selectedCategorySet);
    });
  };

  const changeBreakdownTab = (tab: BreakdownTab) => {
    setActiveBreakdownTab(tab);
    setActiveTransactionTab((currentTab) => {
      if (tab === "income") {
        return "income";
      }

      return currentTab === "excluded" ? currentTab : "expenses";
    });
  };

  return {
    activeBreakdownTab,
    detailedTransactionCategories,
    expenseCategorySummaries,
    hoveredTransactionCategory,
    openExpenseCategoryGroups,
    selectedTransactionCategories,
    transactionCategoryNames,
    transactionCustomRange,
    transactionExpenseTotal,
    transactionPieSlices,
    transactionRange,
    transactionRangeLabel,
    transactionsInSelectedRange,
    changeBreakdownTab,
    changeTransactionCustomRange,
    changeTransactionRange,
    resetTransactionCategorySelections,
    setHoveredTransactionCategory,
    setSelectedTransactionCategories,
    toggleExpenseCategoryGroup,
    toggleTransactionCategory,
    toggleTransactionCategoryGroupSelection,
  };
};
