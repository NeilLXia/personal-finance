import {
  chartBounds,
  chartViewBoxValue,
  defaultWealthChangeCategories,
  negativeWealthChangeColor,
  wealthChangeColors,
} from "../shared/constants";
import { formatCompactCurrency, formatCurrency } from "../shared/formatters";
import styles from "./index.module.css";
import shared from "../dashboard.shared.module.css";
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
              {wealthChangeChart.bars.map((bar) => (
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
                  <title>
                    {bar.label}: {formatCurrency(bar.value)}
                  </title>
                </rect>
              ))}
              {hoveredBar && (
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
