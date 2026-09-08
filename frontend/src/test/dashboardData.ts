import type { DashboardData } from "../Components/Dashboard/shared/types";

export const createDashboardData = (
  overrides: Partial<DashboardData> = {},
): DashboardData => ({
  institutions: [],
  dashboard_month: {
    start_date: "2026-08-01",
    end_date: "2026-08-31",
    label: "August 2026",
  },
  accounts: [],
  balance_summary: {
    current: 0,
    available: 0,
  },
  net_worth: {
    current: 0,
    categories: [],
    history: [],
    breakdown_dates: [],
    breakdown: [],
  },
  monthly_cash_flow: {
    categories: [],
    months: [],
  },
  income_allocation: {
    range: 12,
    years: [],
    available_years: [],
    start_date: "2025-09-01",
    end_date: "2026-08-31",
    label: "12 months",
    income: 0,
    expenses: 0,
    savings: 0,
    real_estate_equity: 0,
    transactions: [],
    payslips: [],
  },
  budget_targets: [],
  transaction_range: {
    range: 1,
    start_date: "2026-08-01",
    end_date: "2026-08-31",
    label: "1 month",
  },
  transaction_categories: [],
  latest_transactions: [],
  payslips: [],
  ...overrides,
});
