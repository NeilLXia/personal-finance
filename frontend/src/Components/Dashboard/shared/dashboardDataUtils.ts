import { expenseCategoryGroups } from "./constants";
import type {
  CategoryTotal,
  DashboardData,
  DashboardResponse,
  ExpenseCategorySummary,
  Transaction,
} from "./types";
import {
  defaultWealthChangeCategories,
  defaultNetWorthCategories,
} from "./constants";

export const getTransactionDisplayCategory = (transaction: Transaction) =>
  transaction.display_category ||
  transaction.manual_category ||
  transaction.category ||
  "Uncategorized";

export const excludedTransactionCategory = "Excluded";
export const excludedUnassignedCategory = "Unassigned";
export const getExcludedCategorySelectionKey = (category: string) =>
  `${excludedTransactionCategory}:${category}`;

export const getCategorySelectionKey = (category: CategoryTotal) =>
  category.selectionKey || category.category;

export const getExcludedTransactionCategory = (transaction: Transaction) =>
  transaction.manual_category || excludedUnassignedCategory;

const getTransactionSignedAmount = (transaction: Transaction) => {
  const amount = Number(transaction.amount || 0);

  return amount > 0 ? -amount : Math.abs(amount);
};

const getExpenseCategoryGroupLabel = (category: string) => {
  const normalizedCategory = category.trim().toLowerCase();
  const matchedGroup = expenseCategoryGroups.find((group) =>
    group.categories.has(normalizedCategory),
  );

  return matchedGroup?.label || null;
};

export const summarizeTransactionsByDisplayCategory = (
  transactions: Transaction[],
): CategoryTotal[] => {
  const categoriesByName = transactions.reduce<Record<string, CategoryTotal>>(
    (categories, transaction) => {
      const category = getTransactionDisplayCategory(transaction);

      if (!categories[category]) {
        categories[category] = {
          category,
          amount: 0,
          count: 0,
        };
      }

      categories[category].amount += getTransactionSignedAmount(transaction);
      categories[category].count += 1;

      return categories;
    },
    {},
  );

  return Object.values(categoriesByName)
    .map((category) => ({
      ...category,
      amount: Number(category.amount.toFixed(2)),
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
};

export const summarizeExcludedTransactions = (transactions: Transaction[]) => {
  const excludedTransactions = transactions.filter(
    (transaction) => !transaction.is_expense,
  );

  if (excludedTransactions.length === 0) {
    return null;
  }

  const childrenByName = excludedTransactions.reduce<
    Record<string, CategoryTotal>
  >((categories, transaction) => {
    const category = getExcludedTransactionCategory(transaction);

    if (!categories[category]) {
      categories[category] = {
        category,
        selectionKey: getExcludedCategorySelectionKey(category),
        amount: 0,
        count: 0,
      };
    }

    categories[category].amount += getTransactionSignedAmount(transaction);
    categories[category].count += 1;

    return categories;
  }, {});

  const children = Object.values(childrenByName)
    .map((category) => ({
      ...category,
      amount: Number(category.amount.toFixed(2)),
    }))
    .sort((a, b) => {
      if (a.category === excludedUnassignedCategory) {
        return -1;
      }

      if (b.category === excludedUnassignedCategory) {
        return 1;
      }

      return Math.abs(b.amount) - Math.abs(a.amount);
    });

  return {
    category: excludedTransactionCategory,
    amount: Number(
      excludedTransactions
        .reduce(
          (total, transaction) =>
            total + getTransactionSignedAmount(transaction),
          0,
        )
        .toFixed(2),
    ),
    count: excludedTransactions.length,
    kind: "excluded" as const,
    children,
  };
};

export const buildExpenseCategorySummaries = (
  categories: CategoryTotal[],
): ExpenseCategorySummary[] => {
  const groupsByName = new Map<string, ExpenseCategorySummary>();
  const ungroupedCategories: ExpenseCategorySummary[] = [];

  categories.forEach((category) => {
    const groupLabel = getExpenseCategoryGroupLabel(category.category);

    if (!groupLabel) {
      ungroupedCategories.push({
        ...category,
        kind: "category",
        children: [],
      });
      return;
    }

    const currentGroup = groupsByName.get(groupLabel) || {
      category: groupLabel,
      amount: 0,
      count: 0,
      kind: "group" as const,
      children: [],
    };

    currentGroup.amount += category.amount;
    currentGroup.count += category.count;
    currentGroup.children.push(category);
    groupsByName.set(groupLabel, currentGroup);
  });

  return [...groupsByName.values(), ...ungroupedCategories]
    .map((category) => ({
      ...category,
      amount: Number(category.amount.toFixed(2)),
      children: category.children
        .map((child) => ({
          ...child,
          amount: Number(child.amount.toFixed(2)),
        }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
};

export const getVenmoDetails = (transaction: Transaction) => {
  const transactionText = [
    transaction.category,
    transaction.name,
    transaction.merchant_name,
    transaction.account_name,
    transaction.institution_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!transactionText.includes("venmo")) {
    return null;
  }

  const noteMatch = transaction.name.match(/"([^"]+)"/);
  const note = noteMatch?.[1] || null;
  const counterparty =
    transaction.merchant_name ||
    transaction.name.replace(/"[^"]+"/g, "").trim();

  return {
    counterparty:
      counterparty && counterparty !== "Venmo" ? counterparty : null,
    note,
  };
};

export const normalizeDashboardData = (
  dashboardData: DashboardResponse,
): DashboardData => ({
  institutions: dashboardData.institutions || [],
  dashboard_month: dashboardData.dashboard_month || {
    start_date: "",
    end_date: "",
    label: "Last full month",
  },
  accounts: dashboardData.accounts || [],
  balance_summary: dashboardData.balance_summary || {
    current: 0,
    available: 0,
  },
  net_worth: {
    current: dashboardData.net_worth?.current || 0,
    categories:
      dashboardData.net_worth?.categories || defaultNetWorthCategories,
    history: dashboardData.net_worth?.history || [],
    breakdown_dates: dashboardData.net_worth?.breakdown_dates || [],
    breakdown: dashboardData.net_worth?.breakdown || [],
  },
  monthly_cash_flow: dashboardData.monthly_cash_flow || {
    categories: defaultWealthChangeCategories,
    months: [],
  },
  income_allocation: {
    range: dashboardData.income_allocation?.range || 1,
    years: dashboardData.income_allocation?.years || [],
    available_years: dashboardData.income_allocation?.available_years || [],
    start_date:
      dashboardData.income_allocation?.start_date ||
      dashboardData.dashboard_month?.start_date ||
      "",
    end_date:
      dashboardData.income_allocation?.end_date ||
      dashboardData.dashboard_month?.end_date ||
      "",
    label:
      dashboardData.income_allocation?.label ||
      dashboardData.dashboard_month?.label ||
      "Selected month",
    income: dashboardData.income_allocation?.income || 0,
    expenses: dashboardData.income_allocation?.expenses || 0,
    savings: dashboardData.income_allocation?.savings || 0,
    real_estate_equity:
      dashboardData.income_allocation?.real_estate_equity || 0,
    transactions: dashboardData.income_allocation?.transactions || [],
    payslips:
      dashboardData.income_allocation?.payslips || dashboardData.payslips || [],
  },
  budget_targets: dashboardData.budget_targets || [],
  transaction_range: dashboardData.transaction_range || {
    range: 1,
    start_date: dashboardData.dashboard_month?.start_date || "",
    end_date: dashboardData.dashboard_month?.end_date || "",
    label: dashboardData.dashboard_month?.label || "Selected month",
  },
  transaction_categories: dashboardData.transaction_categories || [],
  latest_transactions: dashboardData.latest_transactions || [],
  payslips: dashboardData.payslips || [],
});
