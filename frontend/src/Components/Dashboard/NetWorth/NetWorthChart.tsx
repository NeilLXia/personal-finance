import { useEffect, useState } from "react";
import type { MouseEvent } from "react";

import {
  chartBounds,
  chartViewBox,
  chartViewBoxValue,
  netWorthTrailingMonthOptions,
} from "../shared/constants";
import {
  formatShortDate,
  maskTooltipCompactCurrency,
} from "../shared/formatters";
import shared from "../dashboard.shared.module.css";
import ChartTooltip, {
  chartTooltipMetrics,
  getChartTooltipHeight,
} from "../shared/ChartTooltip";
import RangeSelector from "../shared/RangeSelector";
import styles from "./index.module.css";
import type {
  NetWorthChart as NetWorthChartData,
  NetWorthTrailingMonths,
} from "../shared/types";

type NetWorthChartProps = {
  areBalancesHidden: boolean;
  chart: NetWorthChartData;
  trailingMonths: NetWorthTrailingMonths;
  onTrailingMonthsChange: (trailingMonths: NetWorthTrailingMonths) => void;
};

const getTooltipCategoryLabel = (
  category: NetWorthChartData["hoverPoints"][number]["categories"][number],
) => {
  if (category.key === "personal_equity") {
    return "Personal";
  }

  if (category.key === "tax_advantaged") {
    return "Tax-advantaged";
  }

  return category.label;
};

const NetWorthChart = ({
  areBalancesHidden,
  chart,
  trailingMonths,
  onTrailingMonthsChange,
}: NetWorthChartProps) => {
  const [hoveredPoint, setHoveredPoint] = useState<
    NetWorthChartData["hoverPoints"][number] | null
  >(null);

  useEffect(() => {
    setHoveredPoint(null);
  }, [chart]);

  const updateHoveredPoint = (event: MouseEvent<SVGSVGElement>) => {
    if (chart.hoverPoints.length === 0) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const svgX =
      chartViewBox.x +
      ((event.clientX - bounds.left) / bounds.width) * chartViewBox.width;
    const nearestPoint = chart.hoverPoints.reduce((nearest, point) =>
      Math.abs(point.x - svgX) < Math.abs(nearest.x - svgX) ? point : nearest,
    );

    setHoveredPoint(nearestPoint);
  };
  const tooltipHeight = hoveredPoint
    ? getChartTooltipHeight(hoveredPoint.categories.length)
    : 0;
  const tooltipX = hoveredPoint
    ? Math.min(
        Math.max(
          hoveredPoint.x + chartTooltipMetrics.padding,
          chartBounds.left,
        ),
        chartBounds.right - chartTooltipMetrics.width,
      )
    : 0;
  const tooltipY = hoveredPoint
    ? Math.min(
        Math.max(hoveredPoint.y - 6, chartBounds.top),
        chartBounds.bottom - tooltipHeight,
      )
    : 0;
  const formatBalanceValue = (value: number) =>
    maskTooltipCompactCurrency(value, areBalancesHidden);

  return (
    <div className={shared.chartFrame}>
      <div
        className={`${shared.dashboardCardHeader} ${shared.dashboardCardHeaderWrap}`}
      >
        <h2 className={shared.dashboardCardTitle}>Historical Net Worth</h2>
        <RangeSelector
          label="Range"
          layout="inline"
          onChange={onTrailingMonthsChange}
          options={netWorthTrailingMonthOptions}
          value={trailingMonths}
        />
      </div>
      {chart.areas.length === 0 ? (
        <p className={shared.emptyText}>No historical balance snapshots yet.</p>
      ) : (
        <>
          <svg
            viewBox={chartViewBoxValue}
            onMouseLeave={() => setHoveredPoint(null)}
            onMouseMove={updateHoveredPoint}
          >
            {chart.yTicks.map((tick) => (
              <g key={tick.y}>
                <line
                  className={shared.chartGridLine}
                  x1={chartBounds.left}
                  x2={chartBounds.right}
                  y1={tick.y}
                  y2={tick.y}
                />
                <text
                  className={shared.chartYAxisLabel}
                  x={chartBounds.left - 3}
                  y={tick.y - 1}
                >
                  {formatBalanceValue(tick.value)}
                </text>
              </g>
            ))}
            {chart.xTicks.map((tick) => (
              <g key={`${tick.label}-${tick.x}`}>
                <line
                  className={
                    tick.isMajor
                      ? shared.chartXAxisTickMajor
                      : shared.chartXAxisTick
                  }
                  x1={tick.x}
                  x2={tick.x}
                  y1={chartBounds.bottom}
                  y2={
                    tick.isMajor
                      ? chartBounds.bottom + 3
                      : chartBounds.bottom + 2
                  }
                />
                <text
                  className={shared.chartXAxisLabel}
                  textAnchor={chart.xTicks.length > 8 ? "end" : "middle"}
                  transform={
                    chart.xTicks.length > 8
                      ? `rotate(-35 ${tick.x} 88)`
                      : undefined
                  }
                  x={tick.x}
                  y="88"
                >
                  {tick.label}
                </text>
              </g>
            ))}
            {chart.areas.map((area) => (
              <path
                className={styles.netWorthArea}
                d={area.path}
                style={{ fill: area.color }}
                key={area.key}
              />
            ))}
            {chart.lines.map((line) => (
              <path
                className={styles.netWorthLine}
                d={line.path}
                key={line.key}
                style={{ stroke: line.color }}
              />
            ))}
            <rect
              className={styles.netWorthHoverTarget}
              x={chartBounds.left}
              y={chartBounds.top}
              width={chartBounds.right - chartBounds.left}
              height={chartBounds.bottom - chartBounds.top}
            />
            {hoveredPoint && (
              <g>
                <line
                  className={styles.netWorthHoverLine}
                  x1={hoveredPoint.x}
                  x2={hoveredPoint.x}
                  y1={chartBounds.top}
                  y2={chartBounds.bottom}
                />
                <circle
                  className={styles.netWorthHoverDot}
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r="1.6"
                />
                <ChartTooltip
                  title={formatShortDate(hoveredPoint.date)}
                  value={formatBalanceValue(hoveredPoint.total)}
                  x={tooltipX}
                  y={tooltipY}
                  rows={hoveredPoint.categories.map((category) => ({
                    key: category.key,
                    label: getTooltipCategoryLabel(category),
                    value: formatBalanceValue(category.value),
                    color: category.color,
                  }))}
                />
              </g>
            )}
          </svg>
          <div className={shared.chartLegend}>
            {chart.areas.map((area) => (
              <span className={shared.chartLegendItem} key={area.key}>
                <span
                  className={shared.chartLegendSwatch}
                  style={{ backgroundColor: area.color }}
                />
                {area.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default NetWorthChart;
