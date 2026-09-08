import { useMemo } from "react";

import { getBudgetTargetPercent } from "../shared/dashboardStateUtils";
import { summarizeTransactionsByDisplayCategory } from "../shared/dashboardDataUtils";
import type { DashboardFilters } from "../useDashboardFilters";
import type { DashboardData } from "../shared/types";
import {
  buildIncomeAllocationSegments,
  getIncomeAllocationIncomeTotal,
  getIncomeAllocationOffsetPercent,
  resolveSegmentTargetPercent,
} from "./incomeAllocationUtils";

type UseIncomeAllocationOptions = Pick<
  DashboardFilters,
  | "incomeAllocationRange"
  | "incomeAllocationMode"
  | "incomeAllocationCustomRange"
  | "setIncomeAllocationRange"
  | "setIncomeAllocationMode"
  | "setIncomeAllocationCustomRange"
> & {
  data: DashboardData | null;
};

export const useIncomeAllocation = ({
  data,
  incomeAllocationCustomRange,
  incomeAllocationMode,
  incomeAllocationRange,
  setIncomeAllocationCustomRange,
  setIncomeAllocationMode,
  setIncomeAllocationRange,
}: UseIncomeAllocationOptions) => {
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

  return {
    income,
    incomeAllocationCustomRange,
    incomeAllocationMode,
    incomeAllocationRange,
    incomeAllocationSegments,
    setIncomeAllocationMode,
    setIncomeAllocationCustomRange,
    setIncomeAllocationRange,
  };
};
