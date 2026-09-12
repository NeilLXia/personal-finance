import {
  chartBounds,
  chartViewBoxValue,
  defaultWealthChangeCategories,
  netWorthCategoryColors,
  negativeWealthChangeColor,
  wealthChangeColors,
} from "../shared/constants";
import {
  formatCompactCurrency,
  formatCurrency,
  formatTooltipCompactCurrency,
} from "../shared/formatters";
import styles from "./index.module.css";
import shared from "../dashboard.shared.module.css";
import ChartTooltip, {
  chartTooltipMetrics,
  getChartTooltipHeight,
} from "../shared/ChartTooltip";
import type { WealthChangeChart, WealthChangeCategory } from "../shared/types";

type WealthChangeModuleProps = {
  wealthChangeChart: WealthChangeChart;
  categories: WealthChangeCategory[];
  hoveredBarId: string | null;
  onHoveredBarChange: (barId: string | null) => void;
};

const WealthChangeModule = ({
  wealthChangeChart,
  categories,
  hoveredBarId,
  onHoveredBarChange,
}: WealthChangeModuleProps) => {
  const hoveredBar =
    wealthChangeChart.bars.find((bar) => bar.id === hoveredBarId) || null;
  const isHoveringAssetAppreciation =
    hoveredBar?.category === "asset_appreciation" &&
    hoveredBar.breakdown &&
    hoveredBar.breakdown.length > 0;
  const assetBreakdownTooltipHeight = getChartTooltipHeight(
    hoveredBar?.breakdown?.length || 0,
  );
  const assetBreakdownTooltipX = hoveredBar
    ? Math.min(
        chartBounds.right - chartTooltipMetrics.width,
        Math.max(
          chartBounds.left,
          hoveredBar.x + hoveredBar.width / 2 - chartTooltipMetrics.width / 2,
        ),
      )
    : 0;
  const assetBreakdownTooltipY = hoveredBar
    ? hoveredBar.value > 0
      ? Math.max(4, hoveredBar.y - assetBreakdownTooltipHeight - 2)
      : Math.min(
          chartBounds.bottom - assetBreakdownTooltipHeight,
          hoveredBar.y + hoveredBar.height + 2,
        )
    : 0;

  return (
    <section className={styles.wealthChangeSection}>
      <div className={`${shared.chartFrame} ${shared.chartFrameTight}`}>
        <h2 className={shared.dashboardCardTitle}>Wealth change</h2>
        {wealthChangeChart.bars.length === 0 ? (
          <p className={shared.emptyText}>No wealth change data yet.</p>
        ) : (
          <>
            <svg viewBox={chartViewBoxValue}>
              {wealthChangeChart.yTicks.map((tick) => (
                <g key={tick.value}>
                  <line
                    className={
                      tick.value === 0
                        ? styles.wealthChangeZeroLine
                        : shared.chartGridLine
                    }
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
                    {formatCompactCurrency(tick.value)}
                  </text>
                </g>
              ))}
              {wealthChangeChart.bars.map((bar) => {
                const title =
                  bar.category === "asset_appreciation" && bar.breakdown
                    ? [
                        `${bar.label}: ${formatCurrency(bar.value)}`,
                        ...bar.breakdown.map(
                          (item) =>
                            `${item.label}: ${formatCurrency(item.value)}`,
                        ),
                      ].join("\n")
                    : `${bar.label}: ${formatCurrency(bar.value)}`;

                return (
                  <rect
                    key={bar.id}
                    x={bar.x}
                    y={bar.y}
                    width={bar.width}
                    height={Math.max(bar.height, 0.6)}
                    style={{ fill: bar.color }}
                    onMouseEnter={() => onHoveredBarChange(bar.id)}
                    onMouseLeave={() => onHoveredBarChange(null)}
                  >
                    <title>{title}</title>
                  </rect>
                );
              })}
              {hoveredBar && !isHoveringAssetAppreciation && (
                <text
                  className={styles.wealthChangeValueLabel}
                  x={hoveredBar.x + hoveredBar.width / 2}
                  y={
                    hoveredBar.value > 0
                      ? Math.max(8, hoveredBar.y - 2)
                      : Math.min(96, hoveredBar.y + hoveredBar.height + 5)
                  }
                >
                  {formatCurrency(hoveredBar.value)}
                </text>
              )}
              {hoveredBar && isHoveringAssetAppreciation && (
                <ChartTooltip
                  title={hoveredBar.label}
                  value={formatTooltipCompactCurrency(hoveredBar.value)}
                  x={assetBreakdownTooltipX}
                  y={assetBreakdownTooltipY}
                  rows={
                    hoveredBar.breakdown?.map((item) => ({
                      key: item.key,
                      label: item.label,
                      value: formatTooltipCompactCurrency(item.value),
                      color: netWorthCategoryColors[item.key],
                    })) || []
                  }
                />
              )}
              {wealthChangeChart.xTicks.map((tick) => (
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
                    textAnchor="end"
                    transform={`rotate(-35 ${tick.x} 88)`}
                    x={tick.x}
                    y="88"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}
            </svg>
            <div className={shared.chartLegend}>
              {(categories.length
                ? categories
                : defaultWealthChangeCategories
              ).map((category) => (
                <span className={shared.chartLegendItem} key={category.key}>
                  <span
                    className={
                      category.key === "asset_appreciation"
                        ? styles.assetMovementLegendSwatch
                        : shared.chartLegendSwatch
                    }
                    style={{
                      background:
                        category.key === "asset_appreciation"
                          ? `linear-gradient(90deg, ${wealthChangeColors.asset_appreciation} 0 50%, ${negativeWealthChangeColor} 50% 100%)`
                          : wealthChangeColors[category.key],
                    }}
                  />
                  {category.key === "asset_appreciation"
                    ? "Asset appreciation/depreciation"
                    : category.label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default WealthChangeModule;
