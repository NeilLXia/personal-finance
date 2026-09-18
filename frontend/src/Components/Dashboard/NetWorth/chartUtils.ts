import { chartBounds, netWorthCategoryColors } from "../shared/constants";
import {
  roundUpTo,
  scaleLinearY,
} from "../shared/chartScale";
import { parseIsoDate } from "../shared/date";
import { formatShortDate } from "../shared/formatters";
import type {
  NetWorthChart,
  NetWorthCategory,
  NetWorthPoint,
  NetWorthTrailingMonths,
} from "../shared/types";

const formatMonthTick = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });

const getMonthDiff = (start: Date, end: Date) =>
  (end.getFullYear() - start.getFullYear()) * 12 +
  end.getMonth() -
  start.getMonth();

const getTrailingNetWorthHistory = (
  history: NetWorthPoint[],
  trailingMonths: NetWorthTrailingMonths,
  selectedMonth: string,
) => {
  if (trailingMonths === "all" || history.length === 0) {
    return history;
  }

  const [year, month] = selectedMonth.split("-").map(Number);
  const startDate = new Date(year, month - trailingMonths, 1);

  return history.filter((point) => parseIsoDate(point.date) >= startDate);
};

const buildDateTicks = (history: NetWorthPoint[]) => {
  if (history.length === 0) {
    return [];
  }

  const startDate = parseIsoDate(history[0].date);
  const endDate = parseIsoDate(history[history.length - 1].date);
  const monthCount = Math.max(getMonthDiff(startDate, endDate) + 1, 1);
  const ticks: Array<{ label: string; date: Date; isMajor: boolean }> = [];

  if (monthCount <= 24) {
    const tickDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

    if (tickDate < startDate) {
      tickDate.setMonth(tickDate.getMonth() + 1);
    }

    while (tickDate <= endDate) {
      ticks.push({
        label: formatMonthTick(tickDate),
        date: new Date(tickDate),
        isMajor: tickDate.getMonth() === 0,
      });
      tickDate.setMonth(tickDate.getMonth() + 1);
    }

    return ticks;
  }

  const firstYear = startDate.getFullYear();
  const lastYear = endDate.getFullYear();

  for (let year = firstYear; year <= lastYear; year += 1) {
    ticks.push({
      label: String(year),
      date: new Date(year, 0, 1),
      isMajor: true,
    });
  }

  return ticks.filter((tick) => tick.date >= startDate && tick.date <= endDate);
};

export const buildNetWorthChart = (
  history: NetWorthPoint[],
  categories: NetWorthCategory[],
  currentNetWorth: number,
  trailingMonths: NetWorthTrailingMonths,
  selectedMonth: string,
): NetWorthChart => {
  const chart: NetWorthChart = {
    areas: [],
    lines: [],
    hoverPoints: [],
    yTicks: [],
    xLabels: [],
    xTicks: [],
  };

  const filteredHistory = getTrailingNetWorthHistory(
    history,
    trailingMonths,
    selectedMonth,
  );

  if (filteredHistory.length === 0) {
    return chart;
  }

  const normalizedHistory = filteredHistory.map((point) => {
    const hasBreakdown = categories.some(
      (category) => Number(point[category.key] || 0) !== 0,
    );
    const fallbackAmount = Number(point.total || point.amount || 0);

    if (hasBreakdown) {
      return {
        ...point,
        total:
          Number(point.total || 0) ||
          categories.reduce(
            (total, category) => total + Number(point[category.key] || 0),
            0,
          ),
      };
    }

    return {
      ...point,
      cash: fallbackAmount,
      personal_equity: 0,
      tax_advantaged: 0,
      real_estate: 0,
      other_assets: 0,
      total: fallbackAmount,
    };
  });
  const activeCategories = categories.filter((category) =>
    normalizedHistory.some((point) => Number(point[category.key] || 0) !== 0),
  );
  const orderedCategories = activeCategories.length > 0
    ? activeCategories
    : [{ key: "cash" as const, label: "Net worth" }];
  const cumulativeValues = normalizedHistory.flatMap((point) => {
    let total = 0;

    return orderedCategories.map((category) => {
      total += Number(point[category.key] || 0);
      return total;
    });
  });
  const minValue = Math.min(...cumulativeValues, 0);
  const graphInterval = 500000;
  const maxValue = Math.max(
    roundUpTo(Number(currentNetWorth || 0), graphInterval),
    graphInterval,
  );
  const range = maxValue - minValue || 1;
  const expandedHistory =
    normalizedHistory.length === 1
      ? [normalizedHistory[0], normalizedHistory[0]]
      : normalizedHistory;
  const startTime = parseIsoDate(normalizedHistory[0].date).getTime();
  const endTime = parseIsoDate(
    normalizedHistory[normalizedHistory.length - 1].date,
  ).getTime();
  const timeRange = endTime - startTime || 1;
  const xForDate = (date: string | Date) => {
    if (normalizedHistory.length === 1) {
      return chartBounds.left;
    }

    const time = date instanceof Date ? date.getTime() : parseIsoDate(date).getTime();

    return chartBounds.left +
      ((time - startTime) / timeRange) *
        (chartBounds.right - chartBounds.left);
  };
  const xForExpandedPoint = (point: NetWorthPoint, index: number) =>
    normalizedHistory.length === 1 && index === 1
      ? chartBounds.right
      : xForDate(point.date);
  const yForValue = (value: number) =>
    scaleLinearY({
      value,
      minValue,
      range,
      top: chartBounds.top,
      bottom: chartBounds.bottom,
    });
  const cumulativeBottoms = expandedHistory.map(() => 0);

  chart.areas = orderedCategories.map((category) => {
    const bottoms = cumulativeBottoms.slice();
    const topPoints = expandedHistory.map((point, index) => {
      cumulativeBottoms[index] += Number(point[category.key] || 0);

      return {
        x: xForExpandedPoint(point, index),
        y: yForValue(cumulativeBottoms[index]),
      };
    });
    const bottomPoints = bottoms
      .map((bottom, index) => ({
        x: xForExpandedPoint(expandedHistory[index], index),
        y: yForValue(bottom),
      }))
      .reverse();
    const path = [
      ...topPoints.map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      ),
      ...bottomPoints.map(
        (point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      ),
      "Z",
    ].join(" ");

    return {
      key: category.key,
      label: category.label,
      color: netWorthCategoryColors[category.key],
      path,
    };
  });

  const cumulativeLines = expandedHistory.map(() => 0);
  chart.lines = orderedCategories.map((category) => {
    const points = expandedHistory.map((point, index) => {
      cumulativeLines[index] += Number(point[category.key] || 0);

      return {
        x: xForExpandedPoint(point, index),
        y: yForValue(cumulativeLines[index]),
      };
    });
    const path = points
      .map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      )
      .join(" ");

    return {
      key: category.key,
      label: category.label,
      color: netWorthCategoryColors[category.key],
      path,
    };
  });

  chart.yTicks = [0, 0.5, 1].map((position) => ({
    value: minValue + range * (1 - position),
    y: chartBounds.top + position * (chartBounds.bottom - chartBounds.top),
  }));
  chart.hoverPoints = normalizedHistory.map((point) => {
    const categoriesForPoint = orderedCategories.map((category) => ({
      key: category.key,
      label: category.label,
      value: Number(point[category.key] || 0),
      color: netWorthCategoryColors[category.key],
    }));
    const total = categoriesForPoint.reduce(
      (sum, category) => sum + category.value,
      0,
    );

    return {
      date: point.date,
      x: xForDate(point.date),
      y: yForValue(total),
      total,
      categories: categoriesForPoint,
    };
  });
  chart.xLabels = normalizedHistory.length === 1
    ? [{ label: formatShortDate(normalizedHistory[0].date), x: 50 }]
    : [
        { label: formatShortDate(normalizedHistory[0].date), x: chartBounds.left },
        {
          label: formatShortDate(
            normalizedHistory[normalizedHistory.length - 1].date,
          ),
          x: chartBounds.right,
        },
      ];
  chart.xTicks = buildDateTicks(normalizedHistory).map((tick) => ({
    label: tick.label,
    x: xForDate(tick.date),
    isMajor: tick.isMajor,
  }));

  return chart;
};
