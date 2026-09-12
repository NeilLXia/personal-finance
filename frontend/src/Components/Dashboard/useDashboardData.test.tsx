import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDashboardData } from "./useDashboardData";
import { createDashboardData } from "../../test/dashboardData";
import { createQueryClientWrapper } from "../../test/queryClient";
import type {
  DashboardData,
  DateRange,
  TransactionRange,
} from "./shared/types";

const dashboardApi = vi.hoisted(() => ({
  fetchDashboard: vi.fn(),
  fetchDashboardIncomeAllocation: vi.fn(),
  fetchDashboardTransactions: vi.fn(),
  refreshAllPlaidData: vi.fn(),
}));

vi.mock("./dashboardApi", () => dashboardApi);

const incomeAllocationCustomRange = {
  startDate: "2025-09-01",
  endDate: "2026-08-31",
};
const transaction = { id: 101 } as DashboardData["latest_transactions"][number];
type TransactionSlice = Pick<
  DashboardData,
  | "latest_transactions"
  | "payslips"
  | "transaction_categories"
  | "transaction_range"
>;
const transactionSlice: TransactionSlice = {
  latest_transactions: [transaction],
  payslips: [],
  transaction_categories: [],
  transaction_range: {
    range: 1,
    start_date: "2026-08-01",
    end_date: "2026-08-31",
    label: "1 month",
  },
};
const incomeAllocationSlice = {
  income_allocation: {
    ...createDashboardData().income_allocation,
    income: 4200,
    label: "Income slice",
  },
} satisfies Pick<DashboardData, "income_allocation">;

const createDeferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
};

// Renders the hook with a real `transactionRange` state cell so the
// `changeTransactionRange` callback actually drives a re-render.
const renderDashboardData = () =>
  renderHook(
    () => {
      const [transactionRange, setTransactionRange] =
        useState<TransactionRange>(1);
      const [transactionCustomRange, setTransactionCustomRange] =
        useState<DateRange>({ startDate: "2026-08-01", endDate: "2026-08-31" });

      return useDashboardData({
        selectedMonth: "2026-08",
        transactionRange,
        transactionCustomRange,
        incomeAllocationRange: 12,
        incomeAllocationCustomRange,
        setTransactionRange,
        setTransactionCustomRange,
      });
    },
    { wrapper: createQueryClientWrapper() },
  );

const renderDashboardDataWithMonthState = () =>
  renderHook(
    () => {
      const [selectedMonth, setSelectedMonth] = useState("2026-08");
      const [transactionRange, setTransactionRange] =
        useState<TransactionRange>(1);
      const [transactionCustomRange, setTransactionCustomRange] =
        useState<DateRange>({ startDate: "2026-08-01", endDate: "2026-08-31" });

      return {
        ...useDashboardData({
          selectedMonth,
          transactionRange,
          transactionCustomRange,
          incomeAllocationRange: 12,
          incomeAllocationCustomRange,
          setTransactionRange,
          setTransactionCustomRange,
        }),
        setSelectedMonth,
      };
    },
    { wrapper: createQueryClientWrapper() },
  );

describe("useDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dashboardApi.fetchDashboard.mockResolvedValue(createDashboardData());
    dashboardApi.fetchDashboardTransactions.mockResolvedValue(transactionSlice);
    dashboardApi.fetchDashboardIncomeAllocation.mockResolvedValue(
      incomeAllocationSlice,
    );
    dashboardApi.refreshAllPlaidData.mockResolvedValue(undefined);
  });

  it("composes the base dashboard with transaction and income slice queries", async () => {
    const { result } = renderDashboardData();

    await waitFor(() =>
      expect(result.current.data?.income_allocation.income).toBe(4200),
    );

    expect(result.current.data?.latest_transactions).toEqual([transaction]);
    expect(dashboardApi.fetchDashboard.mock.calls[0][0].toString()).toBe(
      "month=2026-08",
    );
    expect(
      dashboardApi.fetchDashboardTransactions.mock.calls[0][0].toString(),
    ).toBe("month=2026-08&transaction_range=1");
    expect(
      dashboardApi.fetchDashboardIncomeAllocation.mock.calls[0][0].toString(),
    ).toBe("month=2026-08&income_allocation_range=12");
  });

  it("uses the transaction slice query and spinner for transaction range changes", async () => {
    const nextTransactionSlice = {
      ...transactionSlice,
      transaction_range: {
        ...transactionSlice.transaction_range,
        range: 3,
        label: "3 months",
      },
    } satisfies TransactionSlice;
    const deferred = createDeferred<typeof transactionSlice>();

    dashboardApi.fetchDashboardTransactions
      .mockResolvedValueOnce(transactionSlice)
      .mockReturnValueOnce(deferred.promise);

    const { result } = renderDashboardData();

    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => {
      result.current.changeTransactionRange(3);
    });

    await waitFor(() =>
      expect(result.current.isTransactionRangeLoading).toBe(true),
    );

    expect(result.current.isIncomeAllocationLoading).toBe(false);
    expect(dashboardApi.fetchDashboard).toHaveBeenCalledTimes(1);
    expect(dashboardApi.fetchDashboardTransactions).toHaveBeenCalledTimes(2);
    expect(
      dashboardApi.fetchDashboardTransactions.mock.calls[1][0].toString(),
    ).toBe("month=2026-08&transaction_range=3");

    await act(async () => {
      deferred.resolve(nextTransactionSlice);
      await deferred.promise;
    });

    await waitFor(() =>
      expect(result.current.isTransactionRangeLoading).toBe(false),
    );
    expect(result.current.data?.transaction_range.label).toBe("3 months");
  });

  it("shows the snapshot loading state only while a selected month change settles", async () => {
    const nextDashboard = createDashboardData({
      dashboard_month: {
        start_date: "2026-09-01",
        end_date: "2026-09-30",
        label: "September 2026",
      },
    });
    const nextTransactionSlice = {
      ...transactionSlice,
      transaction_range: {
        ...transactionSlice.transaction_range,
        start_date: "2026-09-01",
        end_date: "2026-09-30",
      },
    } satisfies TransactionSlice;
    const nextIncomeAllocationSlice = {
      income_allocation: {
        ...incomeAllocationSlice.income_allocation,
        label: "Next income slice",
      },
    } satisfies Pick<DashboardData, "income_allocation">;
    const dashboardDeferred = createDeferred<DashboardData>();
    const transactionDeferred = createDeferred<typeof transactionSlice>();
    const incomeAllocationDeferred =
      createDeferred<typeof incomeAllocationSlice>();

    dashboardApi.fetchDashboard
      .mockResolvedValueOnce(createDashboardData())
      .mockReturnValueOnce(dashboardDeferred.promise);
    dashboardApi.fetchDashboardTransactions
      .mockResolvedValueOnce(transactionSlice)
      .mockReturnValueOnce(transactionDeferred.promise);
    dashboardApi.fetchDashboardIncomeAllocation
      .mockResolvedValueOnce(incomeAllocationSlice)
      .mockReturnValueOnce(incomeAllocationDeferred.promise);

    const { result } = renderDashboardDataWithMonthState();

    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.isSnapshotLoading).toBe(false);

    act(() => {
      result.current.setSelectedMonth("2026-09");
    });

    await waitFor(() => expect(result.current.isSnapshotLoading).toBe(true));

    await act(async () => {
      dashboardDeferred.resolve(nextDashboard);
      await dashboardDeferred.promise;
    });

    expect(result.current.isSnapshotLoading).toBe(true);

    await act(async () => {
      transactionDeferred.resolve(nextTransactionSlice);
      incomeAllocationDeferred.resolve(nextIncomeAllocationSlice);
      await Promise.all([
        transactionDeferred.promise,
        incomeAllocationDeferred.promise,
      ]);
    });

    await waitFor(() => expect(result.current.isSnapshotLoading).toBe(false));
    expect(result.current.data?.dashboard_month.label).toBe("September 2026");
    expect(result.current.data?.income_allocation.label).toBe(
      "Next income slice",
    );
  });
});
