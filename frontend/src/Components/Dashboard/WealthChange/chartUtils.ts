import {
  chartBounds,
  negativeWealthChangeColor,
  wealthChangeColors,
} from "../shared/constants";
import {
  roundDownTo,
  roundUpTo,
  scaleLinearY,
} from "../shared/chartScale";
import {
  getMonthKey,
  getPreviousMonthKey,
} from "../shared/date";
import type {
  NetWorthPoint,
  WealthChangeChart,
  WealthChangeCategory,
  WealthChangeMonth,
} from "../shared/types";

const getNetWorthAmount = (point: NetWorthPoint) =>
  Number(point.total || point.amount || 0);

export const addAssetAppreciation = ({
  months,
  netWorthHistory,
}: {
  months: WealthChangeMonth[];
  netWorthHistory: NetWorthPoint[];
}): WealthChangeMonth[] => {
  const netWorthByMonth = new Map<string, number>();

  netWorthHistory
    .slice()
    .sort((firstPoint, secondPoint) =>
      firstPoint.date.localeCompare(secondPoint.date),
    )
    .forEach((point) => {
      netWorthByMonth.set(getMonthKey(point.date), getNetWorthAmount(point));
    });

  return months.map((month) => {
    const currentNetWorth = netWorthByMonth.get(month.month);
    const previousNetWorth = netWorthByMonth.get(getPreviousMonthKey(month.month));
    const netWorthChange =
      currentNetWorth === undefined || previousNetWorth === undefined
        ? 0
        : currentNetWorth - previousNetWorth;
    const shownWealthChangeImpact =
      Number(month.expenses || 0) +
      Number(month.savings || 0) +
      Number(month.real_estate_equity || 0);
    const assetAppreciation = Number(
      (netWorthChange - shownWealthChangeImpact).toFixed(2),
    );

    return {
      ...month,
      asset_appreciation: assetAppreciation,
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
  const positiveMax = Math.max(...monthTotals.map((month) => month.positive), 0);
  const negativeMin = Math.min(...monthTotals.map((month) => month.negative), 0);
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
