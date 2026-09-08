import { useMemo, useState } from "react";

import {
  getBudgetTargetPercent,
  getMonthDateRange,
  isValidDateRange,
} from "../shared/dashboardStateUtils";
import { getDefaultDashboardMonth } from "../shared/formatters";
import { summarizeTransactionsByDisplayCategory } from "../shared/dashboardDataUtils";
import type {
  DashboardData,
  DateRange,
  IncomeAllocationMode,
  IncomeAllocationRange,
} from "../shared/types";
import {
  buildIncomeAllocationSegments,
  getIncomeAllocationIncomeTotal,
  getIncomeAllocationOffsetPercent,
  resolveSegmentTargetPercent,
} from "./incomeAllocationUtils";

type IncomeAllocationControls = {
  incomeAllocationRange: IncomeAllocationRange;
  incomeAllocationMode: IncomeAllocationMode;
  incomeAllocationCustomRange: DateRange;
  setIncomeAllocationRange: (range: IncomeAllocationRange) => void;
  setIncomeAllocationMode: (mode: IncomeAllocationMode) => void;
  setIncomeAllocationCustomRange: (range: DateRange) => void;
};

/**
 * Owns the income-allocation controls (range / mode / custom range). These are
 * lifted to the dashboard container because `useDashboardData` needs the range
 * as a request parameter for the initial payload, but the state conceptually
 * belongs to this module.
 */
export const useIncomeAllocationControls = (): IncomeAllocationControls => {
  const [incomeAllocationRange, setIncomeAllocationRange] =
    useState<IncomeAllocationRange>(12);
  const [incomeAllocationMode, setIncomeAllocationMode] =
    useState<IncomeAllocationMode>("net");
  const [incomeAllocationCustomRange, setIncomeAllocationCustomRange] =
    useState<DateRange>(() => getMonthDateRange(getDefaultDashboardMonth(), 12));

  return {
    incomeAllocationRange,
    incomeAllocationMode,
    incomeAllocationCustomRange,
    setIncomeAllocationRange,
    setIncomeAllocationMode,
    setIncomeAllocationCustomRange,
  };
};

export const useIncomeAllocation = ({
  data,
  incomeAllocationCustomRange,
  incomeAllocationMode,
  incomeAllocationRange,
  loadIncomeAllocation,
  setIncomeAllocationCustomRange,
  setIncomeAllocationMode,
  setIncomeAllocationRange,
}: IncomeAllocationControls & {
  data: DashboardData | null;
  loadIncomeAllocation: (options: {
    range: IncomeAllocationRange;
    customRange: DateRange;
  }) => void;
}) => {
  // Only the budget targets the user has actually set, keyed by lowercased
  // category. A segment gets a target marker only when it finds a match here.
  const targetsByCategory = useMemo(() => {
    const targets = new Map<string, number>();

    (data?.budget_targets || []).forEach((target) => {
      targets.set(
        target.category.trim().toLowerCase(),
        getBudgetTargetPercent(target, incomeAllocationMode),
      );
    });

    return targets;
  }, [data, incomeAllocationMode]);
  const transactionCategories = useMemo(
    () =>
      summarizeTransactionsByDisplayCategory(
        (data?.income_allocation.transactions || []).filter(
          (transaction) => transaction.is_expense,
        ),
      ),
    [data],
  );
  const incomeAllocationSegments = useMemo(() => {
    const segments = buildIncomeAllocationSegments({
      income: data?.income_allocation.income || 0,
      savings: data?.income_allocation.savings || 0,
      realEstateEquity: data?.income_allocation.real_estate_equity || 0,
      categories: transactionCategories,
      mode: incomeAllocationMode,
      payslips: data?.income_allocation.payslips || [],
      transactions: data?.income_allocation.transactions || [],
      targetPercents: [...targetsByCategory.values()],
    });

    return segments.map((segment) => {
      const targetPercent = resolveSegmentTargetPercent(
        segment,
        targetsByCategory,
      );

      return {
        ...segment,
        targetPercent,
        targetLinePercent:
          targetPercent === undefined
            ? undefined
            : getIncomeAllocationOffsetPercent({
                value: targetPercent,
                zeroLinePercent: segment.zeroLinePercent,
                chartMinPercent: segment.chartMinPercent,
                chartRangePercent: segment.chartRangePercent,
              }),
      };
    });
  }, [data, incomeAllocationMode, targetsByCategory, transactionCategories]);
  const income = useMemo(
    () =>
      getIncomeAllocationIncomeTotal({
        income: data?.income_allocation.income || 0,
        mode: incomeAllocationMode,
        payslips: data?.income_allocation.payslips || [],
        transactions: data?.income_allocation.transactions || [],
      }),
    [data, incomeAllocationMode],
  );

  const changeIncomeAllocationRange = (range: IncomeAllocationRange) => {
    setIncomeAllocationRange(range);
    loadIncomeAllocation({
      range,
      customRange: incomeAllocationCustomRange,
    });
  };

  const changeIncomeAllocationCustomRange = (range: DateRange) => {
    setIncomeAllocationCustomRange(range);

    if (incomeAllocationRange === "custom") {
      if (!isValidDateRange(range)) {
        return;
      }

      loadIncomeAllocation({
        range: "custom",
        customRange: range,
      });
    }
  };

  return {
    income,
    incomeAllocationCustomRange,
    incomeAllocationMode,
    incomeAllocationRange,
    incomeAllocationSegments,
    setIncomeAllocationMode,
    changeIncomeAllocationCustomRange,
    changeIncomeAllocationRange,
  };
};
