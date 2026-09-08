export type Account = {
  id: number;
  name: string;
  mask: string | null;
  institution_name: string | null;
  official_name: string | null;
  subtype: string | null;
  type: string | null;
  balance_available: string | number | null;
  balance_current: string | number | null;
  iso_currency_code: string | null;
};

export type InstitutionStatus = {
  institution_name: string;
  institution_id: string | null;
  plaid_item_id: string | null;
  plaid_environment: string;
  has_active_access_token: boolean;
  has_stale_access_token: boolean;
  item_count: number;
  account_count: number;
  last_updated_at: string;
};

export type CategoryTotal = {
  category: string;
  selectionKey?: string;
  amount: number;
  count: number;
};

export type TransactionCategoryRule = {
  id: number;
  original_category: string;
  original_category_key: string;
  vendor_name: string;
  vendor_name_key: string;
  match_type: "exact" | "contains" | "starts_with";
  manual_category: string;
  created_at: string;
  updated_at: string;
};

export type BudgetTarget = {
  id: number;
  category: string;
  category_key: string;
  target_percent: string | number;
  net_target_percent: string | number;
  gross_target_percent: string | number;
  created_at: string;
  updated_at: string;
};

export type Payslip = {
  id: number;
  payslip_identifier: string;
  employee_name: string | null;
  employer_name: string | null;
  employee_id: string | null;
  pay_period_begin: string;
  pay_period_end: string;
  check_date: string;
  check_number: string | null;
  hours_worked: string | number | null;
  gross_pay: string | number | null;
  pre_tax_deductions: string | number | null;
  pretax_401k: string | number | null;
  pretax_401k_bonus_deferral: string | number | null;
  pretax_dental: string | number | null;
  pretax_fsa_healthcare: string | number | null;
  pretax_hsa: string | number | null;
  pretax_medical: string | number | null;
  associate_taxes: string | number | null;
  social_security_tax: string | number | null;
  medicare_tax: string | number | null;
  federal_withholding_tax: string | number | null;
  state_tax: string | number | null;
  ca_disability_insurance_tax: string | number | null;
  post_tax_deductions: string | number | null;
  posttax_401k_roth: string | number | null;
  posttax_401k_bonus_deferral_roth: string | number | null;
  net_pay: string | number | null;
  income_transaction_id: number | null;
  created_at: string;
  updated_at: string;
};

export type PayslipUpload = {
  id: number;
  original_filename: string;
  page_count: number;
  imported_count: number;
  skipped_count: number;
  created_at: string;
};

export type ExpenseCategorySummary = CategoryTotal & {
  kind: "group" | "category" | "excluded";
  children: CategoryTotal[];
};

export type NetWorthCategoryKey =
  | "cash"
  | "personal_equity"
  | "tax_advantaged"
  | "real_estate"
  | "other_assets";

export type NetWorthCategory = {
  key: NetWorthCategoryKey;
  label: string;
};

export type NetWorthPoint = {
  date: string;
  amount?: number;
  cash: number;
  personal_equity: number;
  tax_advantaged: number;
  real_estate: number;
  other_assets: number;
  total: number;
};

export type NetWorthBreakdownItem = {
  id: string;
  name: string;
  detail: string;
  balances: Record<string, number | null>;
};

export type NetWorthBreakdownCategory = {
  key: NetWorthCategoryKey;
  label: string;
  total: number;
  balances: Record<string, number>;
  items: NetWorthBreakdownItem[];
};

export type NetWorthChart = {
  areas: Array<{
    key: NetWorthCategoryKey;
    label: string;
    color: string;
    path: string;
  }>;
  lines: Array<{
    key: NetWorthCategoryKey;
    label: string;
    color: string;
    path: string;
  }>;
  hoverPoints: Array<{
    date: string;
    x: number;
    y: number;
    total: number;
    categories: Array<{
      key: NetWorthCategoryKey;
      label: string;
      value: number;
      color: string;
    }>;
  }>;
  yTicks: Array<{ value: number; y: number }>;
  xLabels: Array<{ label: string; x: number }>;
  xTicks: Array<{ label: string; x: number; isMajor: boolean }>;
};

export type WealthChangeCategoryKey =
  | "expenses"
  | "savings"
  | "real_estate_equity"
  | "asset_appreciation";

export type WealthChangeCategory = {
  key: WealthChangeCategoryKey;
  label: string;
};

export type WealthChangeMonth = {
  month: string;
  label: string;
  income: number;
  expenses: number;
  savings: number;
  real_estate_equity: number;
  asset_appreciation?: number;
  total: number;
};

export type WealthChangeChart = {
  bars: Array<{
    id: string;
    month: string;
    category: WealthChangeCategoryKey;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    value: number;
    color: string;
  }>;
  zeroY: number;
  yTicks: Array<{ value: number; y: number }>;
  xLabels: Array<{ label: string; x: number }>;
  xTicks: Array<{ label: string; x: number; isMajor: boolean }>;
};

export type IncomeAllocationSegment = {
  key: string;
  label: string;
  amount: number;
  percent: number;
  barLeftPercent: number;
  barWidthPercent: number;
  zeroLinePercent: number;
  chartMinPercent: number;
  chartRangePercent: number;
  color: string;
  targetPercent?: number;
  targetLinePercent?: number;
};

export type IncomeAllocationMode = "net" | "gross";

export type DateRange = {
  startDate: string;
  endDate: string;
};

export type IncomeAllocationRange = 1 | 3 | 6 | 12 | "custom";

export type TransactionRange = 1 | 3 | 6 | 12 | "custom";

export type NetWorthTrailingMonths = 12 | 24 | 36 | 60 | 120 | "all";

export type BreakdownTab = "expenses" | "income";

export type TransactionTableTab =
  | "expenses"
  | "excluded"
  | "income"
  | "other_income";

export type Transaction = {
  id: number;
  name: string;
  amount: string | number;
  date: string;
  manual_date?: string | null;
  merchant_name: string | null;
  category: string | null;
  original_category?: string | null;
  manual_category?: string | null;
  display_category?: string | null;
  cash_flow_type?: string | null;
  is_expense?: boolean;
  pending: boolean;
  account_name: string;
  account_mask: string | null;
  institution_name?: string | null;
};

export type TransactionPieSlice = CategoryTotal & {
  color: string;
  path: string;
};

export type DashboardResponse = {
  institutions?: InstitutionStatus[];
  dashboard_month?: {
    start_date: string;
    end_date: string;
    label: string;
  };
  accounts?: Account[];
  balance_summary?: {
    current: number;
    available: number;
  };
  net_worth?: {
    current: number;
    categories?: NetWorthCategory[];
    history: NetWorthPoint[];
    breakdown_dates?: string[];
    breakdown?: NetWorthBreakdownCategory[];
  };
  monthly_cash_flow?: {
    categories: WealthChangeCategory[];
    months: WealthChangeMonth[];
  };
  income_allocation?: {
    range: IncomeAllocationRange;
    years: number[];
    available_years: number[];
    start_date: string;
    end_date: string;
    label: string;
    income: number;
    expenses: number;
    savings: number;
    real_estate_equity: number;
    transactions: Transaction[];
    payslips: Payslip[];
  };
  budget_targets?: BudgetTarget[];
  transaction_range?: {
    range: TransactionRange;
    start_date: string;
    end_date: string;
    label: string;
  };
  transaction_categories?: CategoryTotal[];
  latest_transactions?: Transaction[];
  payslips?: Payslip[];
};

export type DashboardData = {
  institutions: InstitutionStatus[];
  dashboard_month: {
    start_date: string;
    end_date: string;
    label: string;
  };
  accounts: Account[];
  balance_summary: {
    current: number;
    available: number;
  };
  net_worth: {
    current: number;
    categories: NetWorthCategory[];
    history: NetWorthPoint[];
    breakdown_dates: string[];
    breakdown: NetWorthBreakdownCategory[];
  };
  monthly_cash_flow: {
    categories: WealthChangeCategory[];
    months: WealthChangeMonth[];
  };
  income_allocation: {
    range: IncomeAllocationRange;
    years: number[];
    available_years: number[];
    start_date: string;
    end_date: string;
    label: string;
    income: number;
    expenses: number;
    savings: number;
    real_estate_equity: number;
    transactions: Transaction[];
    payslips: Payslip[];
  };
  budget_targets: BudgetTarget[];
  transaction_range: {
    range: TransactionRange;
    start_date: string;
    end_date: string;
    label: string;
  };
  transaction_categories: CategoryTotal[];
  latest_transactions: Transaction[];
  payslips: Payslip[];
};
