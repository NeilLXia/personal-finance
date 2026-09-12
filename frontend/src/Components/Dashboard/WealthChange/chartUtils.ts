import {
  chartBounds,
  defaultNetWorthCategories,
  negativeWealthChangeColor,
  wealthChangeColors,
} from "../shared/constants";
import { roundDownTo, roundUpTo, scaleLinearY } from "../shared/chartScale";
import { getMonthKey, getPreviousMonthKey } from "../shared/date";
import type {
  NetWorthPoint,
  WealthChangeChart,
  WealthChangeCategory,
  WealthChangeMonth,
} from "../shared/types";

const getNetWorthAmount = (point: NetWorthPoint) =>
  Number(point.total || point.amount || 0);

const getNetWorthBalanceChange = (point: NetWorthPoint) =>
  point.balance_change === undefined ? undefined : Number(point.balance_change);

const getNetWorthCategoryChanges = ({
  currentPoint,
  previousPoint,
}: {
  currentPoint?: NetWorthPoint;
  previousPoint?: NetWorthPoint;
}) => {
  if (!currentPoint) {
    return {};
  }

  if (currentPoint.balance_changes) {
    return currentPoint.balance_changes;
  }

  if (!previousPoint) {
    return {};
  }

  return Object.fromEntries(
    defaultNetWorthCategories.map((category) => [
      category.key,
      Number(currentPoint[category.key] || 0) -
        Number(previousPoint[category.key] || 0),
    ]),
  );
};

const roundChartMoney = (value: number) => Number(value.toFixed(2));

const allocateKnownCashFlows = ({
  assetAppreciation,
  categoryChanges,
  month,
}: {
  assetAppreciation: number;
  categoryChanges: Partial<
    Record<(typeof defaultNetWorthCategories)[number]["key"], number>
  >;
  month: WealthChangeMonth;
}) => {
  const values = Object.fromEntries(
    defaultNetWorthCategories.map((category) => [
      category.key,
      Number(categoryChanges[category.key] || 0),
    ]),
  );

  values.cash = values.cash - Number(month.expenses || 0);
  values.real_estate =
    values.real_estate - Number(month.real_estate_equity || 0);

  const savings = Number(month.savings || 0);
  const savingsCategories = [
    "personal_equity",
    "tax_advantaged",
    "other_assets",
  ] as const;
  const savingsBasis = savingsCategories.map((key) =>
    savings >= 0
      ? Math.max(values[key], 0)
      : Math.abs(Math.min(values[key], 0)),
  );
  const totalSavingsBasis = savingsBasis.reduce(
    (total, value) => total + value,
    0,
  );

  if (savings !== 0) {
    if (totalSavingsBasis === 0) {
      values.personal_equity = values.personal_equity - savings;
    } else {
      savingsCategories.forEach((key, index) => {
        values[key] =
          values[key] - savings * (savingsBasis[index] / totalSavingsBasis);
      });
    }
  }

  const breakdown = defaultNetWorthCategories.map((category) => ({
    key: category.key,
    label: category.label,
    value: roundChartMoney(values[category.key]),
  }));
  const roundedTotal = roundChartMoney(
    breakdown.reduce((total, category) => total + category.value, 0),
  );
  const roundingDelta = roundChartMoney(assetAppreciation - roundedTotal);

  if (roundingDelta !== 0) {
    const adjustmentCategory =
      breakdown.find((category) => category.value !== 0) || breakdown[0];
    adjustmentCategory.value = roundChartMoney(
      adjustmentCategory.value + roundingDelta,
    );
  }

  return breakdown;
};

export const addAssetAppreciation = ({
  months,
  netWorthHistory,
}: {
  months: WealthChangeMonth[];
  netWorthHistory: NetWorthPoint[];
}): WealthChangeMonth[] => {
  const netWorthByMonth = new Map<
    string,
    { balanceChange?: number; point: NetWorthPoint; total: number }
  >();

  netWorthHistory
    .slice()
    .sort((firstPoint, secondPoint) =>
      firstPoint.date.localeCompare(secondPoint.date),
    )
    .forEach((point) => {
      netWorthByMonth.set(getMonthKey(point.date), {
        balanceChange: getNetWorthBalanceChange(point),
        point,
        total: getNetWorthAmount(point),
      });
    });

  return months.map((month) => {
    const currentNetWorthPoint = netWorthByMonth.get(month.month);
    const previousNetWorthPoint = netWorthByMonth.get(
      getPreviousMonthKey(month.month),
    );
    const aggregateNetWorthChange =
      currentNetWorthPoint === undefined || previousNetWorthPoint === undefined
        ? 0
        : currentNetWorthPoint.total - previousNetWorthPoint.total;
    const netWorthChange =
      currentNetWorthPoint?.balanceChange ?? aggregateNetWorthChange;
    const shownWealthChangeImpact =
      Number(month.expenses || 0) +
      Number(month.savings || 0) +
      Number(month.real_estate_equity || 0);
    const assetAppreciation = Number(
      (netWorthChange - shownWealthChangeImpact).toFixed(2),
    );
    const assetAppreciationBreakdown = allocateKnownCashFlows({
      assetAppreciation,
      categoryChanges: getNetWorthCategoryChanges({
        currentPoint: currentNetWorthPoint?.point,
        previousPoint: previousNetWorthPoint?.point,
      }),
      month,
    });

    return {
      ...month,
      asset_appreciation: assetAppreciation,
      asset_appreciation_breakdown: assetAppreciationBreakdown,
      total: Number((Number(month.total || 0) + assetAppreciation).toFixed(2)),
    };
  });
};

export const buildWealthChangeChart = (
  months: WealthChangeMonth[],
  categories: WealthChangeCategory[],
): WealthChangeChart => {
  const chart: WealthChangeChart = {
    bars: [],
    zeroY: 50,
    yTicks: [],
    xLabels: [],
    xTicks: [],
  };

  if (months.length === 0) {
    return chart;
  }

  const snapAmount = 1000;
  const visibleCategories = categories.filter((category) =>
    months.some((month) => Number(month[category.key] || 0) !== 0),
  );
  const monthTotals = months.map((month) =>
    visibleCategories.reduce(
      (totals, category) => {
        const value = Number(month[category.key] || 0);

        if (value > 0) {
          totals.positive += value;
        } else {
          totals.negative += value;
        }

        return totals;
      },
      { positive: 0, negative: 0 },
    ),
  );
  const positiveMax = Math.max(
    ...monthTotals.map((month) => month.positive),
    0,
  );
  const negativeMin = Math.min(
    ...monthTotals.map((month) => month.negative),
    0,
  );
  const maxValue = Math.max(roundUpTo(positiveMax, snapAmount), snapAmount);
  const minValue = Math.min(roundDownTo(negativeMin, snapAmount), -snapAmount);
  const range = maxValue - minValue || snapAmount;
  const chartTop = chartBounds.top;
  const chartBottom = chartBounds.bottom;
  const chartLeft = chartBounds.left;
  const chartRight = chartBounds.right;
  const chartWidth = chartRight - chartLeft;
  const getY = (value: number) =>
    scaleLinearY({
      value,
      minValue,
      range,
      top: chartTop,
      bottom: chartBottom,
    });
  const zeroY = getY(0);
  const slotWidth = chartWidth / months.length;
  const barWidth = Math.min(18, slotWidth * 0.72);

  chart.zeroY = zeroY;
  chart.yTicks = [minValue, 0, maxValue].map((value) => ({
    value,
    y: getY(value),
  }));
  chart.xLabels = months.map((month, index) => ({
    label: month.label,
    x: chartLeft + slotWidth * index + slotWidth / 2,
  }));
  chart.xTicks = chart.xLabels.map((label, index) => ({
    ...label,
    isMajor: months[index].month.endsWith("-01"),
  }));

  months.forEach((month, monthIndex) => {
    const x = chartLeft + slotWidth * monthIndex + (slotWidth - barWidth) / 2;
    let positiveOffsetValue = 0;
    let negativeOffsetValue = 0;

    visibleCategories.forEach((category) => {
      const value = Number(month[category.key] || 0);

      if (value === 0) {
        return;
      }

      const baseValue = value > 0 ? positiveOffsetValue : negativeOffsetValue;
      const nextValue = baseValue + value;
      const y = Math.min(getY(baseValue), getY(nextValue));
      const height = Math.abs(getY(baseValue) - getY(nextValue));

      chart.bars.push({
        id: `${month.month}-${category.key}`,
        month: month.month,
        category: category.key,
        label:
          category.key === "asset_appreciation" && value < 0
            ? "Asset depreciation"
            : category.label,
        x,
        y,
        width: barWidth,
        height,
        value,
        color:
          category.key === "asset_appreciation" && value < 0
            ? negativeWealthChangeColor
            : wealthChangeColors[category.key],
        breakdown:
          category.key === "asset_appreciation"
            ? month.asset_appreciation_breakdown
            : undefined,
      });

      if (value > 0) {
        positiveOffsetValue = nextValue;
      } else {
        negativeOffsetValue = nextValue;
      }
    });
  });

  return chart;
};
