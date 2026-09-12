import type { CSSProperties } from "react";

import { maskCurrency } from "../shared/formatters";
import styles from "./index.module.css";
import NetWorthBreakdownTable from "./NetWorthBreakdownTable";
import NetWorthChart from "./NetWorthChart";
import type {
  NetWorthBreakdownCategory,
  NetWorthChart as NetWorthChartData,
  NetWorthCategoryKey,
  NetWorthTrailingMonths,
} from "../shared/types";

type NetWorthSummaryProps = {
  currentNetWorth: number;
  areBalancesHidden: boolean;
};

type NetWorthChartPanelProps = {
  areBalancesHidden: boolean;
  chart: NetWorthChartData;
  trailingMonths: NetWorthTrailingMonths;
  onTrailingMonthsChange: (trailingMonths: NetWorthTrailingMonths) => void;
};

type NetWorthBreakdownPanelProps = {
  areBalancesHidden: boolean;
  breakdown: NetWorthBreakdownCategory[];
  breakdownDates: string[];
  tableColumns: CSSProperties;
  openCategories: Partial<Record<NetWorthCategoryKey, boolean>>;
  onToggleCategory: (categoryKey: NetWorthCategoryKey) => void;
};

type NetWorthModuleProps = NetWorthSummaryProps &
  NetWorthChartPanelProps &
  NetWorthBreakdownPanelProps;

export const NetWorthSummary = ({
  currentNetWorth,
  areBalancesHidden,
}: NetWorthSummaryProps) => {
  const formatBalanceValue = (value: number | string | null | undefined) =>
    maskCurrency(value, areBalancesHidden);

  return (
    <section className={styles.netWorthTopRow}>
      <div className={styles.netWorthSummary}>
        <p className={styles.sectionLabel}>Net worth</p>
        <strong className={styles.totalBalance}>
          {formatBalanceValue(currentNetWorth)}
        </strong>
      </div>
    </section>
  );
};

export const NetWorthChartPanel = ({
  chart,
  trailingMonths,
  areBalancesHidden,
  onTrailingMonthsChange,
}: NetWorthChartPanelProps) => (
  <NetWorthChart
    areBalancesHidden={areBalancesHidden}
    chart={chart}
    trailingMonths={trailingMonths}
    onTrailingMonthsChange={onTrailingMonthsChange}
  />
);

export const NetWorthBreakdownPanel = ({
  breakdown,
  breakdownDates,
  tableColumns,
  areBalancesHidden,
  openCategories,
  onToggleCategory,
}: NetWorthBreakdownPanelProps) => {
  const formatBalanceValue = (value: number | string | null | undefined) =>
    maskCurrency(value, areBalancesHidden);

  return (
    <NetWorthBreakdownTable
      breakdown={breakdown}
      breakdownDates={breakdownDates}
      formatBalanceValue={formatBalanceValue}
      openCategories={openCategories}
      tableColumns={tableColumns}
      onToggleCategory={onToggleCategory}
    />
  );
};

const NetWorthModule = ({
  currentNetWorth,
  chart,
  breakdown,
  breakdownDates,
  tableColumns,
  trailingMonths,
  areBalancesHidden,
  openCategories,
  onTrailingMonthsChange,
  onToggleCategory,
}: NetWorthModuleProps) => {
  return (
    <section className={styles.netWorthSection}>
      <NetWorthSummary
        areBalancesHidden={areBalancesHidden}
        currentNetWorth={currentNetWorth}
      />
      <NetWorthChartPanel
        areBalancesHidden={areBalancesHidden}
        chart={chart}
        trailingMonths={trailingMonths}
        onTrailingMonthsChange={onTrailingMonthsChange}
      />
      <NetWorthBreakdownPanel
        areBalancesHidden={areBalancesHidden}
        breakdown={breakdown}
        breakdownDates={breakdownDates}
        openCategories={openCategories}
        tableColumns={tableColumns}
        onToggleCategory={onToggleCategory}
      />
    </section>
  );
};

export default NetWorthModule;
