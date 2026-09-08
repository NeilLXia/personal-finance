import type {
  BudgetTarget,
  DateRange,
  IncomeAllocationMode,
} from "./types";

export const getMonthDateRange = (month: string, trailingMonths: number) => {
  const [year, monthIndex] = month.split("-").map(Number);
  const endDate = new Date(year, monthIndex, 0);
  const startDate = new Date(year, monthIndex - trailingMonths, 1);
  const formatInputDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;

  return {
    startDate: formatInputDate(startDate),
    endDate: formatInputDate(endDate),
  };
};

export const appendCustomDateRangeParams = (
  searchParams: URLSearchParams,
  prefix: string,
  range: DateRange,
) => {
  searchParams.set(`${prefix}_start_date`, range.startDate);
  searchParams.set(`${prefix}_end_date`, range.endDate);
};

export const isValidDateRange = (range: DateRange) =>
  Boolean(range.startDate && range.endDate && range.startDate <= range.endDate);

export const getBudgetTargetPercent = (
  target: BudgetTarget,
  mode: IncomeAllocationMode,
) =>
  mode === "gross"
    ? Number(
        target.gross_target_percent ||
          target.net_target_percent ||
          target.target_percent ||
          0,
      )
    : Number(target.net_target_percent || target.target_percent || 0);

export const getCalculatedEffectiveSavingsTarget = (
  targets: BudgetTarget[],
  mode: IncomeAllocationMode,
) => {
  const allocatedTargetPercent = targets.reduce((total, target) => {
    const category = target.category.trim().toLowerCase();

    if (category === "effective savings") {
      return total;
    }

    if (mode === "net" && category === "taxes") {
      return total;
    }

    return total + getBudgetTargetPercent(target, mode);
  }, 0);

  return Number((100 - allocatedTargetPercent).toFixed(2));
};
