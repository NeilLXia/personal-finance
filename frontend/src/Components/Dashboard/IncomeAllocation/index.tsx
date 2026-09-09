import { incomeAllocationRangeOptions } from "../shared/constants";
import {
  formatCurrency,
  maskCurrency,
} from "../shared/formatters";
import styles from "./index.module.css";
import shared from "../dashboard.shared.module.css";
import CustomDateRangeInputs from "../shared/CustomDateRangeInputs";
import RangeSelector from "../shared/RangeSelector";
import TabRow from "../shared/TabRow";
import type {
  DateRange,
  IncomeAllocationMode,
  IncomeAllocationRange,
  IncomeAllocationSegment,
} from "../shared/types";

type IncomeAllocationModuleProps = {
  areBalancesHidden: boolean;
  incomeLabel: string;
  income: number;
  mode: IncomeAllocationMode;
  range: IncomeAllocationRange;
  customRange: DateRange;
  segments: IncomeAllocationSegment[];
  isLoading: boolean;
  onModeChange: (mode: IncomeAllocationMode) => void;
  onRangeChange: (range: IncomeAllocationRange) => void;
  onCustomRangeChange: (range: DateRange) => void;
};

const getTargetLabel = (segment: IncomeAllocationSegment) => {
  if (!segment.targetPercent || segment.targetPercent <= 0) {
    return null;
  }

  return `(${Number(segment.targetPercent).toFixed(1)}%)`;
};

const IncomeAllocationModule = ({
  areBalancesHidden,
  incomeLabel,
  income,
  mode,
  range,
  customRange,
  segments,
  isLoading,
  onModeChange,
  onRangeChange,
  onCustomRangeChange,
}: IncomeAllocationModuleProps) => {
  return (
    <div className={styles.incomeAllocation}>
      {isLoading && (
        <span className={shared.loadingOverlay}>Updating allocation...</span>
      )}
      <div
        className={`${shared.dashboardCardHeader} ${shared.dashboardCardHeaderWrap} ${styles.incomeAllocationHeader}`}
      >
        <div className={styles.incomeAllocationTitle}>
          <strong className={shared.dashboardCardTitle}>
            Income distribution
          </strong>
        </div>
        <TabRow
          ariaLabel="Income allocation basis"
          options={[
            { label: "Net", value: "net" },
            { label: "Gross", value: "gross" },
          ]}
          value={mode}
          onChange={onModeChange}
        />
      </div>
      <div className={styles.incomeAllocationControls}>
        <div className={styles.incomeAllocationIncome}>
          <span>{incomeLabel}</span>
          <strong>{maskCurrency(income, areBalancesHidden)}</strong>
        </div>
        <RangeSelector
          label=""
          layout="inline"
          onChange={onRangeChange}
          options={incomeAllocationRangeOptions}
          value={range}
        />
      </div>
      {range === "custom" && (
        <CustomDateRangeInputs
          value={customRange}
          onChange={onCustomRangeChange}
        />
      )}
      {segments.length === 0 ? (
        <p className={shared.emptyText}>No income for this range.</p>
      ) : (
        <div className={styles.incomeAllocationRows}>
          {segments.map((segment) => {
            const targetLabel = getTargetLabel(segment);

            return (
              <div className={styles.incomeAllocationRow} key={segment.key}>
                <span
                  className={styles.incomeAllocationRowLabel}
                  style={{ borderLeftColor: segment.color }}
                >
                  {segment.label}
                </span>
                <div
                  className={styles.incomeAllocationBarTrack}
                  title={`${segment.label}: ${formatCurrency(
                    segment.amount,
                  )} (${segment.percent.toFixed(1)}%)`}
                >
                  <span
                    className={styles.incomeAllocationZeroLine}
                    style={{ left: `${segment.zeroLinePercent}%` }}
                  />
                  {typeof segment.targetLinePercent === "number" && (
                    <span
                      className={styles.incomeAllocationTargetLine}
                      style={{ left: `${segment.targetLinePercent}%` }}
                      title={`Target: ${Number(segment.targetPercent).toFixed(
                        1,
                      )}%`}
                    />
                  )}
                  <span
                    className={`${styles.incomeAllocationSegment} ${
                      segment.amount < 0
                        ? styles.incomeAllocationSegmentNegative
                        : styles.incomeAllocationSegmentPositive
                    }`}
                    style={{
                      backgroundColor: segment.color,
                      left: `${segment.barLeftPercent}%`,
                      right: "auto",
                      width: `${segment.barWidthPercent}%`,
                    }}
                  >
                    <span>{formatCurrency(segment.amount)}</span>
                  </span>
                </div>
                <span className={styles.incomeAllocationResult}>
                  <strong>{segment.percent.toFixed(1)}%</strong>
                  {targetLabel && <small>{targetLabel}</small>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IncomeAllocationModule;
