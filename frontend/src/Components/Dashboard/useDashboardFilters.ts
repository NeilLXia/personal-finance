import { useState } from "react";

import { getMonthDateRange } from "./shared/dashboardStateUtils";
import { getDefaultDashboardMonth } from "./shared/formatters";
import type {
  DateRange,
  IncomeAllocationMode,
  IncomeAllocationRange,
  TransactionRange,
} from "./shared/types";

// Trailing-month defaults for the two range controls.
const DEFAULT_TRANSACTION_MONTHS = 1;
const DEFAULT_INCOME_ALLOCATION_MONTHS = 12;

export type DashboardFilters = {
  selectedMonth: string;
  transactionRange: TransactionRange;
  transactionCustomRange: DateRange;
  incomeAllocationRange: IncomeAllocationRange;
  incomeAllocationMode: IncomeAllocationMode;
  incomeAllocationCustomRange: DateRange;
  setSelectedMonth: (month: string) => void;
  setTransactionRange: (range: TransactionRange) => void;
  setTransactionCustomRange: (range: DateRange) => void;
  setIncomeAllocationRange: (range: IncomeAllocationRange) => void;
  setIncomeAllocationMode: (mode: IncomeAllocationMode) => void;
  setIncomeAllocationCustomRange: (range: DateRange) => void;
};

/**
 * Single owner for every user-controlled dashboard query parameter: the
 * selected month plus the transaction and income-allocation ranges. It is
 * passed into `useDashboardData` (which turns these into requests) and down to
 * the modules that render the matching controls, so there is one source of
 * truth instead of the state being split across the container, `useDashboardData`
 * and a dedicated controls hook.
 *
 * `incomeAllocationMode` rides along because its control sits next to the range
 * control in the UI, even though it only affects client-side math and is not
 * sent to the server.
 */
export const useDashboardFilters = (): DashboardFilters => {
  const [selectedMonth, setSelectedMonth] = useState(getDefaultDashboardMonth);
  const [transactionRange, setTransactionRange] =
    useState<TransactionRange>(DEFAULT_TRANSACTION_MONTHS);
  const [transactionCustomRange, setTransactionCustomRange] = useState<DateRange>(
    () => getMonthDateRange(getDefaultDashboardMonth(), DEFAULT_TRANSACTION_MONTHS),
  );
  const [incomeAllocationRange, setIncomeAllocationRange] =
    useState<IncomeAllocationRange>(DEFAULT_INCOME_ALLOCATION_MONTHS);
  const [incomeAllocationMode, setIncomeAllocationMode] =
    useState<IncomeAllocationMode>("net");
  const [incomeAllocationCustomRange, setIncomeAllocationCustomRange] =
    useState<DateRange>(() =>
      getMonthDateRange(
        getDefaultDashboardMonth(),
        DEFAULT_INCOME_ALLOCATION_MONTHS,
      ),
    );

  return {
    selectedMonth,
    transactionRange,
    transactionCustomRange,
    incomeAllocationRange,
    incomeAllocationMode,
    incomeAllocationCustomRange,
    setSelectedMonth,
    setTransactionRange,
    setTransactionCustomRange,
    setIncomeAllocationRange,
    setIncomeAllocationMode,
    setIncomeAllocationCustomRange,
  };
};
