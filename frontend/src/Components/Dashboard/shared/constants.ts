import type {
  IncomeAllocationRange,
  NetWorthCategory,
  NetWorthCategoryKey,
  NetWorthTrailingMonths,
  TransactionRange,
  WealthChangeCategory,
  WealthChangeCategoryKey,
} from "./types";

// Chart colours are CSS custom properties (see src/styles/tokens.css) so the
// SVG fills and legend swatches follow the light/dark theme. Values here are
// `var(--chart-*)` strings; they land in `style={{ fill }}` / `backgroundColor`.
export const chartColors = [
  "var(--chart-cat-1)",
  "var(--chart-cat-2)",
  "var(--chart-cat-3)",
  "var(--chart-cat-4)",
  "var(--chart-cat-5)",
  "var(--chart-cat-6)",
  "var(--chart-cat-7)",
  "var(--chart-cat-8)",
];

export const dashboardPalette = {
  realEstate: "var(--chart-real-estate)",
  taxAdvantagedSavings: "var(--chart-tax-advantaged)",
  normalSavings: "var(--chart-normal-savings)",
  personalEquity: "var(--chart-personal-equity)",
  cash: "var(--chart-cash)",
  essentialExpenditures: "var(--chart-essential)",
  foodAndDining: "var(--chart-food-dining)",
  discretionaryExpenditures: "var(--chart-discretionary)",
  travel: "var(--chart-travel)",
  fitness: "var(--chart-fitness)",
  housingCosts: "var(--chart-housing-costs)",
  neutral: "var(--chart-neutral)",
};

export const incomeAllocationColors = {
  housing: "var(--chart-ia-housing)",
  realEstateEquity: "var(--chart-ia-real-estate-equity)",
  essentials: "var(--chart-ia-essentials)",
  discretionary: "var(--chart-ia-discretionary)",
  savings: "var(--chart-ia-savings)",
  otherIncome: "var(--chart-ia-other-income)",
  shortfall: "var(--chart-ia-shortfall)",
  taxes: "var(--chart-ia-taxes)",
};

export const categoryColorMap: Record<string, string> = {
  "401k": dashboardPalette.taxAdvantagedSavings,
  "401k bonus deferral": "var(--chart-c-401k-bonus-deferral)",
  "401k bonus deferral roth": "var(--chart-c-401k-bonus-deferral-roth)",
  "401k roth": "var(--chart-c-401k-roth)",
  "associate taxes": incomeAllocationColors.taxes,
  bills: "var(--chart-c-bills)",
  "ca disability insurance tax": "var(--chart-c-ca-disability-tax)",
  cash: dashboardPalette.cash,
  dental: "var(--chart-c-dental)",
  dining: dashboardPalette.foodAndDining,
  discretionary: dashboardPalette.discretionaryExpenditures,
  "discretionary expenses": dashboardPalette.discretionaryExpenditures,
  entertainment: "var(--chart-c-entertainment)",
  "essential expenses": dashboardPalette.essentialExpenditures,
  essentials: dashboardPalette.essentialExpenditures,
  "federal withholding tax": "var(--chart-c-federal-withholding-tax)",
  fitness: dashboardPalette.fitness,
  "food & dining": dashboardPalette.foodAndDining,
  gifts: "var(--chart-c-gifts)",
  groceries: "var(--chart-c-groceries)",
  health: "var(--chart-c-health)",
  housing: dashboardPalette.housingCosts,
  income: "var(--chart-c-income)",
  insurance: "var(--chart-c-insurance)",
  "medicare tax": "var(--chart-c-medicare-tax)",
  "net income": "var(--chart-c-income)",
  "normal savings": dashboardPalette.normalSavings,
  other: dashboardPalette.neutral,
  "other income": incomeAllocationColors.otherIncome,
  "personal care": "var(--chart-c-personal-care)",
  "post-tax deductions": "var(--chart-c-401k-bonus-deferral-roth)",
  "pre-tax deductions": incomeAllocationColors.essentials,
  "real estate equity": incomeAllocationColors.realEstateEquity,
  "real estate": dashboardPalette.realEstate,
  roth: "var(--chart-c-roth)",
  savings: incomeAllocationColors.savings,
  shopping: dashboardPalette.discretionaryExpenditures,
  "social security tax": "var(--chart-c-social-security-tax)",
  "tax-advantaged savings": dashboardPalette.taxAdvantagedSavings,
  taxes: incomeAllocationColors.taxes,
  transportation: dashboardPalette.essentialExpenditures,
  travel: dashboardPalette.travel,
  uncategorized: dashboardPalette.neutral,
  venmo: "var(--chart-c-venmo)",
};

export const getCategoryColor = (category: string) => {
  const normalizedCategory = category.trim().toLowerCase();

  if (categoryColorMap[normalizedCategory]) {
    return categoryColorMap[normalizedCategory];
  }

  const hash = Array.from(normalizedCategory).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return chartColors[hash % chartColors.length];
};

export const netWorthCategoryColors: Record<NetWorthCategoryKey, string> = {
  cash: dashboardPalette.cash,
  personal_equity: dashboardPalette.personalEquity,
  tax_advantaged: dashboardPalette.taxAdvantagedSavings,
  real_estate: dashboardPalette.realEstate,
  other_assets: dashboardPalette.neutral,
};

export const defaultNetWorthCategories: NetWorthCategory[] = [
  { key: "cash", label: "Cash" },
  { key: "personal_equity", label: "Personal equity" },
  { key: "tax_advantaged", label: "Tax-advantaged equity" },
  { key: "real_estate", label: "Real estate" },
  { key: "other_assets", label: "Other assets" },
];

export const netWorthTrailingMonthOptions: Array<{
  label: string;
  value: NetWorthTrailingMonths;
}> = [
  { label: "12 months", value: 12 },
  { label: "24 months", value: 24 },
  { label: "36 months", value: 36 },
  { label: "5 years", value: 60 },
  { label: "10 years", value: 120 },
  { label: "All", value: "all" },
];

export const trailingRangeOptions: Array<{
  label: string;
  value: IncomeAllocationRange;
}> = [
  { label: "1 month", value: 1 },
  { label: "3 months", value: 3 },
  { label: "6 months", value: 6 },
  { label: "12 months", value: 12 },
  { label: "Specific date range", value: "custom" },
];

export const wealthChangeColors: Record<WealthChangeCategoryKey, string> =
  {
    expenses: incomeAllocationColors.discretionary,
    savings: incomeAllocationColors.savings,
    real_estate_equity: incomeAllocationColors.realEstateEquity,
    asset_appreciation: "var(--chart-asset-appreciation)",
  };
export const negativeWealthChangeColor = dashboardPalette.fitness;

export const defaultWealthChangeCategories: WealthChangeCategory[] = [
  { key: "expenses", label: "Expenses" },
  { key: "savings", label: "Savings" },
  { key: "real_estate_equity", label: "Real estate equity" },
  { key: "asset_appreciation", label: "Asset appreciation" },
];

export const incomeAllocationRangeOptions: Array<{
  label: string;
  value: IncomeAllocationRange;
}> = trailingRangeOptions;

export const incomeAllocationBudgetTargetCategories = [
  "Housing",
  "Essential expenses",
  "Discretionary expenses",
  "Real estate equity",
  "Taxes",
  "Effective savings",
];

export const transactionRangeOptions: Array<{
  label: string;
  value: TransactionRange;
}> = trailingRangeOptions;

export const manualExpenseCategories = [
  "Income",
  "Savings",
  "Transfers",
  "Groceries",
  "Bills",
  "Housing",
  "Transportation",
  "Travel",
  "Dining",
  "Health",
  "Fitness",
  "Shopping",
  "Entertainment",
  "Personal care",
  "Insurance",
  "Venmo",
  "Gifts",
  "Other",
];

export const expenseCategoryGroups = [
  {
    label: "Discretionary",
    categories: new Set(["entertainment", "shopping", "gifts"]),
  },
  {
    label: "Essentials",
    categories: new Set([
      "transportation",
      "bills",
      "insurance",
      "health",
      "personal care",
    ]),
  },
  {
    label: "Food & dining",
    categories: new Set(["groceries", "dining"]),
  },
];

export const chartBounds = {
  top: 14,
  right: 190,
  bottom: 78,
  left: 22,
};

export const chartViewBox = {
  x: 0,
  y: 0,
  width: 200,
  height: 100,
};

export const chartViewBoxValue = `${chartViewBox.x} ${chartViewBox.y} ${chartViewBox.width} ${chartViewBox.height}`;
