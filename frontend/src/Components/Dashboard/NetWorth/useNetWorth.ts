import { useMemo, useState } from "react";

import { defaultNetWorthCategories } from "../shared/constants";
import type {
  DashboardData,
  NetWorthCategoryKey,
  NetWorthTrailingMonths,
} from "../shared/types";
import { buildNetWorthChart } from "./chartUtils";

export const useNetWorth = ({
  data,
  selectedMonth,
}: {
  data: DashboardData | null;
  selectedMonth: string;
}) => {
  const [trailingMonths, setTrailingMonths] =
    useState<NetWorthTrailingMonths>(12);
  const [areBalancesHidden, setAreBalancesHidden] = useState(false);
  const [openCategories, setOpenCategories] = useState<
    Partial<Record<NetWorthCategoryKey, boolean>>
  >({});

  const chart = useMemo(
    () =>
      buildNetWorthChart(
        data?.net_worth.history || [],
        data?.net_worth.categories || defaultNetWorthCategories,
        data?.net_worth.current || 0,
        trailingMonths,
        selectedMonth,
      ),
    [data, selectedMonth, trailingMonths],
  );
  const breakdown = useMemo(() => data?.net_worth.breakdown || [], [data]);
  const breakdownDates = useMemo(
    () =>
      data?.net_worth.breakdown_dates.length
        ? data.net_worth.breakdown_dates
        : data?.net_worth.history.map((point) => point.date) || [],
    [data],
  );
  const tableColumns = {
    gridTemplateColumns: `minmax(22rem, 28rem) repeat(${Math.max(
      breakdownDates.length,
      1,
    )}, minmax(12rem, 1fr))`,
  };
  const toggleCategory = (categoryKey: NetWorthCategoryKey) => {
    setOpenCategories((currentCategories) => ({
      ...currentCategories,
      [categoryKey]: !currentCategories[categoryKey],
    }));
  };

  return {
    areBalancesHidden,
    chart,
    breakdown,
    breakdownDates,
    currentNetWorth: data?.net_worth.current || 0,
    openCategories,
    setAreBalancesHidden,
    setTrailingMonths,
    tableColumns,
    toggleCategory,
    trailingMonths,
  };
};
