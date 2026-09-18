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

type NetWorthModuleProps = {
  currentNetWorth: number;
  chart: NetWorthChartData;
  breakdown: NetWorthBreakdownCategory[];
  breakdownDates: string[];
  tableColumns: CSSProperties;
  trailingMonths: NetWorthTrailingMonths;
  areBalancesHidden: boolean;
  openCategories: Partial<Record<NetWorthCategoryKey, boolean>>;
  onTrailingMonthsChange: (trailingMonths: NetWorthTrailingMonths) => void;
  onToggleCategory: (categoryKey: NetWorthCategoryKey) => void;
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
  const formatBalanceValue = (value: number | string | null | undefined) =>
    maskCurrency(value, areBalancesHidden);

  return (
    <section className={styles.netWorthSection}>
      <div className={styles.netWorthTopRow}>
        <div className={styles.netWorthSummary}>
          <p className={styles.sectionLabel}>Net worth</p>
          <strong className={styles.totalBalance}>
            {formatBalanceValue(currentNetWorth)}
          </strong>
        </div>
      </div>
      <NetWorthChart
        areBalancesHidden={areBalancesHidden}
        chart={chart}
        trailingMonths={trailingMonths}
        onTrailingMonthsChange={onTrailingMonthsChange}
      />
      <NetWorthBreakdownTable
        breakdown={breakdown}
        breakdownDates={breakdownDates}
        formatBalanceValue={formatBalanceValue}
        openCategories={openCategories}
        tableColumns={tableColumns}
        onToggleCategory={onToggleCategory}
      />
    </section>
  );
};

export default NetWorthModule;
