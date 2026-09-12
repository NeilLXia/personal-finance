import { Fragment } from "react";

import shared from "../dashboard.shared.module.css";

export const chartTooltipMetrics = {
  width: 70,
  padding: 4,
  labelXOffset: 7,
  headerBaselineOffset: 5,
  rowStartOffset: 12,
  rowHeight: 5.6,
  valueXOffset: 66,
};

export const getChartTooltipHeight = (rowCount: number) =>
  12 + rowCount * chartTooltipMetrics.rowHeight;

type ChartTooltipRow = {
  key: string;
  label: string;
  value: string;
  color: string;
};

type ChartTooltipProps = {
  title: string;
  value: string;
  rows: ChartTooltipRow[];
  x: number;
  y: number;
  width?: number;
};

const ChartTooltip = ({
  title,
  value,
  rows,
  x,
  y,
  width = chartTooltipMetrics.width,
}: ChartTooltipProps) => {
  const valueXOffset = width - chartTooltipMetrics.padding;

  return (
    <g className={shared.chartTooltip}>
      <rect
        className={shared.chartTooltipBox}
        x={x}
        y={y}
        width={width}
        height={getChartTooltipHeight(rows.length)}
        rx="2"
      />
      <text
        className={shared.chartTooltipTitle}
        x={x + 3}
        y={y + chartTooltipMetrics.headerBaselineOffset}
      >
        {title}
      </text>
      <text
        className={shared.chartTooltipTotal}
        x={x + valueXOffset}
        y={y + chartTooltipMetrics.headerBaselineOffset}
      >
        {value}
      </text>
      {rows.map((row, index) => (
        <Fragment key={row.key}>
          <circle
            cx={x + chartTooltipMetrics.padding}
            cy={
              y +
              chartTooltipMetrics.rowStartOffset -
              1 +
              index * chartTooltipMetrics.rowHeight
            }
            r="0.9"
            style={{ fill: row.color }}
          />
          <text
            className={shared.chartTooltipText}
            x={x + chartTooltipMetrics.labelXOffset}
            y={
              y +
              chartTooltipMetrics.rowStartOffset +
              index * chartTooltipMetrics.rowHeight
            }
          >
            {row.label}
          </text>
          <text
            className={shared.chartTooltipValue}
            x={x + valueXOffset}
            y={
              y +
              chartTooltipMetrics.rowStartOffset +
              index * chartTooltipMetrics.rowHeight
            }
          >
            {row.value}
          </text>
        </Fragment>
      ))}
    </g>
  );
};

export default ChartTooltip;
