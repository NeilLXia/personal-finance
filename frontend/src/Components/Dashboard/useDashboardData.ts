import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchDashboard,
  fetchDashboardIncomeAllocation,
  fetchDashboardTransactions,
  refreshAllPlaidData,
} from "./dashboardApi";
import {
  dashboardPayloadKeys,
  type IncomeAllocationSliceParams,
  type TransactionSliceParams,
} from "./dashboardQueryKeys";
import {
  appendCustomDateRangeParams,
  isValidDateRange,
} from "./shared/dashboardStateUtils";
import { getErrorMessage } from "./shared/useReportedQueryError";
import type { DashboardFilters } from "./useDashboardFilters";
import type { DateRange, TransactionRange } from "./shared/types";

type UseDashboardDataOptions = Pick<
  DashboardFilters,
  | "selectedMonth"
  | "transactionRange"
  | "transactionCustomRange"
  | "incomeAllocationRange"
  | "incomeAllocationCustomRange"
  | "setTransactionRange"
  | "setTransactionCustomRange"
>;

const buildBaseSearchParams = (month: string) => new URLSearchParams({ month });

const buildTransactionSearchParams = ({
  month,
  range,
  customRange,
}: TransactionSliceParams) => {
  const searchParams = new URLSearchParams({
    month,
    transaction_range: String(range),
  });

  if (range === "custom" && customRange) {
    appendCustomDateRangeParams(searchParams, "transaction", customRange);
  }

  return searchParams;
};

const buildIncomeAllocationSearchParams = ({
  month,
  range,
  customRange,
}: IncomeAllocationSliceParams) => {
  const searchParams = new URLSearchParams({
    month,
    income_allocation_range: String(range),
  });

  if (range === "custom" && customRange) {
    appendCustomDateRangeParams(searchParams, "income_allocation", customRange);
  }

  return searchParams;
};

export const useDashboardData = ({
  selectedMonth,
  transactionRange,
  transactionCustomRange,
  incomeAllocationRange,
  incomeAllocationCustomRange,
  setTransactionRange,
  setTransactionCustomRange,
}: UseDashboardDataOptions) => {
  // Errors surfaced imperatively — mutation failures, modal callbacks, range
  // validation. Query load errors are derived below, not mirrored into state.
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const scrollPositionRef = useRef<number | null>(null);

  const reportError = useCallback((message: string) => {
    setActionError(message);
  }, []);
  const clearError = useCallback(() => {
    setActionError(null);
  }, []);

  const transactionSliceParams = useMemo<TransactionSliceParams>(
    () => ({
      month: selectedMonth,
      range: transactionRange,
      customRange: transactionRange === "custom" ? transactionCustomRange : null,
    }),
    [selectedMonth, transactionCustomRange, transactionRange],
  );
  const incomeAllocationSliceParams = useMemo<IncomeAllocationSliceParams>(
    () => ({
      month: selectedMonth,
      range: incomeAllocationRange,
      customRange:
        incomeAllocationRange === "custom" ? incomeAllocationCustomRange : null,
    }),
    [incomeAllocationCustomRange, incomeAllocationRange, selectedMonth],
  );

  const isTransactionQueryEnabled =
    transactionRange !== "custom" || isValidDateRange(transactionCustomRange);
  const isIncomeAllocationQueryEnabled =
    incomeAllocationRange !== "custom" ||
    isValidDateRange(incomeAllocationCustomRange);

  const baseQuery = useQuery({
    queryKey: dashboardPayloadKeys.base(selectedMonth),
    queryFn: ({ signal }) =>
      fetchDashboard(buildBaseSearchParams(selectedMonth), "Dashboard", {
        signal,
      }),
    placeholderData: (previousData) => previousData,
  });
  const transactionSliceQuery = useQuery({
    queryKey: dashboardPayloadKeys.transactionSlice(transactionSliceParams),
    queryFn: ({ signal }) =>
      fetchDashboardTransactions(
        buildTransactionSearchParams(transactionSliceParams),
        { signal },
      ),
    enabled: isTransactionQueryEnabled,
    placeholderData: (previousData) => previousData,
  });
  const incomeAllocationSliceQuery = useQuery({
    queryKey: dashboardPayloadKeys.incomeAllocationSlice(
      incomeAllocationSliceParams,
    ),
    queryFn: ({ signal }) =>
      fetchDashboardIncomeAllocation(
        buildIncomeAllocationSearchParams(incomeAllocationSliceParams),
        { signal },
      ),
    enabled: isIncomeAllocationQueryEnabled,
    placeholderData: (previousData) => previousData,
  });

  const data = useMemo(() => {
    if (!baseQuery.data) {
      return null;
    }

    return {
      ...baseQuery.data,
      ...(transactionSliceQuery.data || {}),
      income_allocation:
        incomeAllocationSliceQuery.data?.income_allocation ||
        baseQuery.data.income_allocation,
    };
  }, [
    baseQuery.data,
    incomeAllocationSliceQuery.data,
    transactionSliceQuery.data,
  ]);

  const queryError =
    baseQuery.error ??
    transactionSliceQuery.error ??
    incomeAllocationSliceQuery.error;
  const error =
    actionError ??
    (queryError ? getErrorMessage(queryError, "Unable to load dashboard") : null);

  const isPayloadFresh =
    baseQuery.isSuccess &&
    transactionSliceQuery.isSuccess &&
    incomeAllocationSliceQuery.isSuccess &&
    !baseQuery.isPlaceholderData &&
    !transactionSliceQuery.isPlaceholderData &&
    !incomeAllocationSliceQuery.isPlaceholderData;

  // Drop a stale imperative error once every slice has refetched cleanly — e.g.
  // after a mutation invalidates the payload and all three queries succeed.
  useEffect(() => {
    if (isPayloadFresh && !queryError) {
      setActionError(null);
    }
  }, [isPayloadFresh, queryError]);

  // Restore the pre-refresh scroll position once the new payload has rendered.
  useEffect(() => {
    const scrollPosition = scrollPositionRef.current;

    if (!data || scrollPosition === null) {
      return;
    }

    scrollPositionRef.current = null;
    requestAnimationFrame(() => {
      window.scrollTo({
        top: scrollPosition,
        left: window.scrollX,
        behavior: "auto",
      });
    });
  }, [data]);

  const manualRefreshMutation = useMutation({
    mutationFn: refreshAllPlaidData,
    onMutate: () => {
      scrollPositionRef.current = window.scrollY;
      setActionError(null);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: dashboardPayloadKeys.root }),
    onError: (requestError) => {
      setActionError(getErrorMessage(requestError, "Unable to refresh data"));
    },
  });
  const { mutate: runManualRefresh, isPending: isManualRefreshLoading } =
    manualRefreshMutation;

  const manuallyRefreshData = useCallback(() => {
    if (!isManualRefreshLoading) {
      runManualRefresh();
    }
  }, [isManualRefreshLoading, runManualRefresh]);

  const changeTransactionRange = useCallback(
    (range: TransactionRange) => {
      setActionError(null);
      setTransactionRange(range);
    },
    [setTransactionRange],
  );
  const changeTransactionCustomRange = useCallback(
    (range: DateRange) => {
      setTransactionCustomRange(range);

      if (transactionRange === "custom" && isValidDateRange(range)) {
        setActionError(null);
      }
    },
    [setTransactionCustomRange, transactionRange],
  );

  return {
    data,
    isLoading:
      baseQuery.isLoading ||
      transactionSliceQuery.isLoading ||
      incomeAllocationSliceQuery.isLoading,
    error,
    reportError,
    clearError,
    changeTransactionCustomRange,
    changeTransactionRange,
    manuallyRefreshData,
    // A slice spinner shows only while that slice refetches on its own. When the
    // month changes or a manual refresh runs, the base query refetches too and
    // the full-screen loading state covers it instead.
    isTransactionRangeLoading:
      transactionSliceQuery.isFetching && !baseQuery.isFetching,
    isIncomeAllocationLoading:
      incomeAllocationSliceQuery.isFetching && !baseQuery.isFetching,
    isManualRefreshLoading,
  };
};
