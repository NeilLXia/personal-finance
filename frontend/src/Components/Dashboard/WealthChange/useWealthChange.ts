import { useEffect, useMemo, useState } from "react";

import { defaultWealthChangeCategories } from "../shared/constants";
import type { DashboardData } from "../shared/types";
import { addAssetAppreciation, buildWealthChangeChart } from "./chartUtils";

export const useWealthChange = ({ data }: { data: DashboardData | null }) => {
  const [hoveredWealthChangeBarId, setHoveredWealthChangeBarId] = useState<
    string | null
  >(null);

  const wealthChangeChart = useMemo(() => {
    const months = addAssetAppreciation({
      months: data?.monthly_cash_flow.months || [],
      netWorthHistory: data?.net_worth.history || [],
    });
    const categoryKeys = new Set(
      (data?.monthly_cash_flow.categories || []).map((category) => category.key),
    );
    const categories = [
      ...(data?.monthly_cash_flow.categories || defaultWealthChangeCategories),
      ...defaultWealthChangeCategories.filter(
        (category) => !categoryKeys.has(category.key),
      ),
    ];

    return buildWealthChangeChart(months, categories);
  }, [data]);

  useEffect(() => {
    setHoveredWealthChangeBarId(null);
  }, [wealthChangeChart]);

  return {
    wealthChangeChart,
    hoveredWealthChangeBarId,
    setHoveredWealthChangeBarId,
  };
};
