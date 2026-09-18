import { Fragment } from "react";
import type { CSSProperties } from "react";

import { netWorthCategoryColors } from "../shared/constants";
import { formatShortDate } from "../shared/formatters";
import shared from "../dashboard.shared.module.css";
import styles from "./index.module.css";
import type {
  NetWorthBreakdownCategory,
  NetWorthCategoryKey,
} from "../shared/types";

type NetWorthBreakdownTableProps = {
  breakdown: NetWorthBreakdownCategory[];
  breakdownDates: string[];
  tableColumns: CSSProperties;
  openCategories: Partial<Record<NetWorthCategoryKey, boolean>>;
  formatBalanceValue: (value: number | string | null | undefined) => string;
  onToggleCategory: (categoryKey: NetWorthCategoryKey) => void;
};

const NetWorthBreakdownTable = ({
  breakdown,
  breakdownDates,
  tableColumns,
  openCategories,
  formatBalanceValue,
  onToggleCategory,
}: NetWorthBreakdownTableProps) => {
  if (breakdown.length === 0) {
    return null;
  }

  return (
    <div className={styles.netWorthTable}>
      <div className={styles.netWorthTableHeader} style={tableColumns}>
        <span className={styles.netWorthStickyCell}>Account Balances</span>
        {breakdownDates.map((date) => (
          <span className={styles.netWorthBalanceCell} key={date}>
            {formatShortDate(date)}
          </span>
        ))}
      </div>
      {breakdown.map((category) => (
        <Fragment key={category.key}>
          <button
            type="button"
            className={`${styles.netWorthCategoryRow} ${styles.netWorthCategoryButton}`}
            style={tableColumns}
            onClick={() => onToggleCategory(category.key)}
            aria-expanded={Boolean(openCategories[category.key])}
          >
            <span className={styles.netWorthStickyCell}>
              <span
                className={`${shared.disclosureIcon} ${
                  openCategories[category.key] ? shared.disclosureIconOpen : ""
                }`}
                style={{
                  borderLeftColor: netWorthCategoryColors[category.key],
                }}
                aria-hidden="true"
              />
              {category.label}
            </span>
            {breakdownDates.map((date) => (
              <strong className={styles.netWorthBalanceCell} key={date}>
                {formatBalanceValue(category.balances[date])}
              </strong>
            ))}
          </button>
          {openCategories[category.key] &&
            category.items.map((item) => (
              <div
                className={styles.netWorthAccountRow}
                key={item.id}
                style={tableColumns}
              >
                <span className={styles.netWorthStickyCell}>
                  <strong>{item.name}</strong>
                  {item.detail && <small>{item.detail}</small>}
                </span>
                {breakdownDates.map((date) => (
                  <strong className={styles.netWorthBalanceCell} key={date}>
                    {item.balances[date] === null
                      ? "-"
                      : formatBalanceValue(item.balances[date])}
                  </strong>
                ))}
              </div>
            ))}
        </Fragment>
      ))}
    </div>
  );
};

export default NetWorthBreakdownTable;
