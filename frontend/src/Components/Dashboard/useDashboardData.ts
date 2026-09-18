import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchDashboard,
  refreshAllPlaidData,
} from "./dashboardApi";
import {
  appendCustomDateRangeParams,
  getMonthDateRange,
  isValidDateRange,
} from "./shared/dashboardStateUtils";
import { getDefaultDashboardMonth } from "./shared/formatters";
import type {
  DashboardData,
  DateRange,
  IncomeAllocationRange,
  TransactionRange,
} from "./shared/types";

type LoadDashboardOptions = {
  preserveScroll?: boolean;
  month?: string;
};

type UseDashboardDataOptions = {
  selectedMonth: string;
  incomeAllocationRange: IncomeAllocationRange;
  incomeAllocationCustomRange: DateRange;
};

const buildDashboardSearchParams = ({
  month,
  incomeAllocationRange,
  incomeAllocationCustomRange,
  transactionRange,
  transactionCustomRange,
}: {
  month: string;
  incomeAllocationRange: IncomeAllocationRange;
  incomeAllocationCustomRange: DateRange;
  transactionRange: TransactionRange;
  transactionCustomRange: DateRange;
}) => {
  const searchParams = new URLSearchParams({
    month,
    income_allocation_range: String(incomeAllocationRange),
    transaction_range: String(transactionRange),
  });

  if (incomeAllocationRange === "custom") {
    appendCustomDateRangeParams(
      searchParams,
      "income_allocation",
      incomeAllocationCustomRange,
    );
  }

  if (transactionRange === "custom") {
    appendCustomDateRangeParams(
      searchParams,
      "transaction",
      transactionCustomRange,
    );
  }

  return searchParams;
};

export const useDashboardData = ({
  selectedMonth,
  incomeAllocationRange,
  incomeAllocationCustomRange,
}: UseDashboardDataOptions) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [transactionRange, setTransactionRange] = useState<TransactionRange>(1);
  const [transactionCustomRange, setTransactionCustomRange] =
    useState<DateRange>(() => getMonthDateRange(getDefaultDashboardMonth(), 1));
  const [isLoading, setIsLoading] = useState(true);
  const [isTransactionRangeLoading, setIsTransactionRangeLoading] =
    useState(false);
  const [isIncomeAllocationLoading, setIsIncomeAllocationLoading] =
    useState(false);
  const [isManualRefreshLoading, setIsManualRefreshLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const incomeAllocationRangeRef = useRef(incomeAllocationRange);
  const incomeAllocationCustomRangeRef = useRef(incomeAllocationCustomRange);
  const transactionRangeRef = useRef(transactionRange);
  const transactionCustomRangeRef = useRef(transactionCustomRange);
  const dashboardRequestId = useRef(0);
  const dashboardAbortController = useRef<AbortController | null>(null);
  const transactionRangeRequestId = useRef(0);
  const incomeAllocationRequestId = useRef(0);

  useEffect(() => {
    incomeAllocationRangeRef.current = incomeAllocationRange;
  }, [incomeAllocationRange]);

  useEffect(() => {
    incomeAllocationCustomRangeRef.current = incomeAllocationCustomRange;
  }, [incomeAllocationCustomRange]);

  useEffect(() => {
    transactionRangeRef.current = transactionRange;
  }, [transactionRange]);

  useEffect(() => {
    transactionCustomRangeRef.current = transactionCustomRange;
  }, [transactionCustomRange]);

  const loadDashboard = useCallback(
    async (options?: LoadDashboardOptions) => {
      const scrollPosition = options?.preserveScroll ? window.scrollY : null;
      const dashboardMonth = options?.month || selectedMonth;
      const requestId = dashboardRequestId.current + 1;
      const abortController = new AbortController();
      dashboardRequestId.current = requestId;
      dashboardAbortController.current?.abort();
      dashboardAbortController.current = abortController;

      if (!options?.preserveScroll) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const searchParams = buildDashboardSearchParams({
          month: dashboardMonth,
          incomeAllocationRange: incomeAllocationRangeRef.current,
          incomeAllocationCustomRange: incomeAllocationCustomRangeRef.current,
          transactionRange: transactionRangeRef.current,
          transactionCustomRange: transactionCustomRangeRef.current,
        });

        const dashboardData = await fetchDashboard(
          searchParams,
          "Dashboard",
          { signal: abortController.signal },
        );

        if (dashboardRequestId.current !== requestId) {
          return;
        }

        setData(dashboardData);
        if (scrollPosition !== null) {
          requestAnimationFrame(() => {
            window.scrollTo({
              top: scrollPosition,
              left: window.scrollX,
              behavior: "auto",
            });
          });
        }
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load dashboard",
        );
      } finally {
        if (dashboardRequestId.current === requestId) {
          dashboardAbortController.current = null;
        }

        if (!options?.preserveScroll && dashboardRequestId.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [selectedMonth],
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(
    () => () => {
      dashboardAbortController.current?.abort();
    },
    [],
  );

  const manuallyRefreshData = useCallback(async () => {
    if (isManualRefreshLoading) {
      return;
    }

    setIsManualRefreshLoading(true);
    setError(null);

    try {
      await refreshAllPlaidData();
      await loadDashboard({ preserveScroll: true });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to refresh data",
      );
    } finally {
      setIsManualRefreshLoading(false);
    }
  }, [isManualRefreshLoading, loadDashboard]);

  const loadTransactionRange = useCallback(
    async (range: TransactionRange, customRange: DateRange) => {
      if (!data) {
        return;
      }

      const requestId = transactionRangeRequestId.current + 1;
      transactionRangeRequestId.current = requestId;
      setIsTransactionRangeLoading(true);
      setError(null);

      try {
        const searchParams = buildDashboardSearchParams({
          month: selectedMonth,
          incomeAllocationRange: incomeAllocationRangeRef.current,
          incomeAllocationCustomRange: incomeAllocationCustomRangeRef.current,
          transactionRange: range,
          transactionCustomRange: customRange,
        });

        const transactionData = await fetchDashboard(
          searchParams,
          "Transaction range",
        );
        if (transactionRangeRequestId.current !== requestId) {
          return;
        }

        setData((currentData) =>
          currentData
            ? {
                ...currentData,
                transaction_range: transactionData.transaction_range,
                transaction_categories: transactionData.transaction_categories,
                latest_transactions: transactionData.latest_transactions,
                payslips: transactionData.payslips,
              }
            : currentData,
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load transaction range",
        );
      } finally {
        if (transactionRangeRequestId.current === requestId) {
          setIsTransactionRangeLoading(false);
        }
      }
    },
    [
      data,
      selectedMonth,
    ],
  );

  const loadIncomeAllocation = useCallback(
    async ({
      range,
      customRange,
    }: {
      range: IncomeAllocationRange;
      customRange: DateRange;
    }) => {
      if (!data) {
        return;
      }

      const requestId = incomeAllocationRequestId.current + 1;
      incomeAllocationRequestId.current = requestId;
      setIsIncomeAllocationLoading(true);
      setError(null);

      try {
        const searchParams = buildDashboardSearchParams({
          month: selectedMonth,
          incomeAllocationRange: range,
          incomeAllocationCustomRange: customRange,
          transactionRange: transactionRangeRef.current,
          transactionCustomRange: transactionCustomRangeRef.current,
        });

        const incomeAllocationData = await fetchDashboard(
          searchParams,
          "Income allocation",
        );
        if (incomeAllocationRequestId.current !== requestId) {
          return;
        }

        setData((currentData) =>
          currentData
            ? {
                ...currentData,
                income_allocation: incomeAllocationData.income_allocation,
              }
            : currentData,
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load income allocation",
        );
      } finally {
        if (incomeAllocationRequestId.current === requestId) {
          setIsIncomeAllocationLoading(false);
        }
      }
    },
    [data, selectedMonth],
  );

  const changeTransactionRange = useCallback(
    (range: TransactionRange) => {
      transactionRangeRef.current = range;
      setTransactionRange(range);
      void loadTransactionRange(range, transactionCustomRangeRef.current);
    },
    [loadTransactionRange],
  );

  const changeTransactionCustomRange = useCallback(
    (range: DateRange) => {
      transactionCustomRangeRef.current = range;
      setTransactionCustomRange(range);

      if (transactionRangeRef.current !== "custom" || !isValidDateRange(range)) {
        return;
      }

      void loadTransactionRange("custom", range);
    },
    [loadTransactionRange],
  );

  return {
    data,
    isLoading,
    error,
    setError,
    loadDashboard,
    loadIncomeAllocation,
    changeTransactionCustomRange,
    changeTransactionRange,
    manuallyRefreshData,
    transactionCustomRange,
    transactionRange,
    isTransactionRangeLoading,
    isIncomeAllocationLoading,
    isManualRefreshLoading,
  };
};
