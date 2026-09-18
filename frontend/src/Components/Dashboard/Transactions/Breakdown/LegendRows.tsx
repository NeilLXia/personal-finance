import { Fragment } from "react";

import { getCategoryColor } from "../../shared/constants";
import { getCategorySelectionKey } from "../../shared/dashboardDataUtils";
import { formatCurrency } from "../../shared/formatters";
import shared from "../../dashboard.shared.module.css";
import styles from "./index.module.css";
import type {
  BreakdownTab,
  ExpenseCategorySummary,
} from "../../shared/types";

type SummaryAmountProps = {
  amount: number;
  total: number;
};

type LegendRowsProps = {
  activeTab: BreakdownTab;
  expenseCategories: ExpenseCategorySummary[];
  expenseTotal: number;
  hoveredCategory: string | null;
  hoveredPayslipCategory: string | null;
  openGroups: Record<string, boolean>;
  openPayslipGroups: Record<string, boolean>;
  payslipCategories: ExpenseCategorySummary[];
  payslipGrossTotal: number;
  selectedCategories: string[];
  onHoveredCategoryChange: (category: string | null) => void;
  onHoveredPayslipCategoryChange: (category: string | null) => void;
  onToggleCategory: (category: string) => void;
  onToggleGroup: (category: string) => void;
  onTogglePayslipGroup: (category: string) => void;
};

const SummaryAmount = ({ amount, total }: SummaryAmountProps) => {
  const totalMagnitude = Math.abs(total);
  const percent =
    totalMagnitude > 0 ? (Math.abs(amount) / totalMagnitude) * 100 : 0;

  return (
    <strong className={styles.summaryAmount}>
      <span className={styles.summaryAmountValue}>
        {formatCurrency(amount)}
      </span>
      <small className={styles.summaryAmountPercent}>
        ({percent.toFixed(1)}%)
      </small>
    </strong>
  );
};

const LegendRows = ({
  activeTab,
  expenseCategories,
  expenseTotal,
  hoveredCategory,
  hoveredPayslipCategory,
  openGroups,
  openPayslipGroups,
  payslipCategories,
  payslipGrossTotal,
  selectedCategories,
  onHoveredCategoryChange,
  onHoveredPayslipCategoryChange,
  onToggleCategory,
  onToggleGroup,
  onTogglePayslipGroup,
}: LegendRowsProps) => (
  <div className={styles.legendRows}>
    {activeTab === "income" &&
      payslipCategories.map((category) => {
        const color = getCategoryColor(category.category);
        const isHovered = hoveredPayslipCategory === category.category;

        if (category.kind === "group") {
          return (
            <Fragment key={category.category}>
              <button
                type="button"
                className={`${styles.legendRow} ${styles.legendGroupRow} ${styles.legendRowActive}`}
                onClick={() => onTogglePayslipGroup(category.category)}
                onMouseEnter={() =>
                  onHoveredPayslipCategoryChange(category.category)
                }
                onMouseLeave={() => onHoveredPayslipCategoryChange(null)}
                aria-expanded={Boolean(openPayslipGroups[category.category])}
              >
                <span
                  className={`${shared.disclosureIcon} ${
                    openPayslipGroups[category.category]
                      ? shared.disclosureIconOpen
                      : ""
                  }`}
                  style={{ borderLeftColor: color }}
                />
                <span className={styles.legendCategoryText}>
                  <span>{category.category}</span>
                </span>
                <SummaryAmount
                  amount={category.amount}
                  total={payslipGrossTotal}
                />
              </button>
              {openPayslipGroups[category.category] &&
                category.children.map((child) => (
                  <div
                    className={`${styles.legendRow} ${styles.legendChildRow} ${styles.legendRowActive} ${styles.legendRowPassive}`}
                    key={child.category}
                  >
                    <span
                      className={styles.legendSwatch}
                      style={{ backgroundColor: color }}
                    />
                    <span className={styles.legendCategoryText}>
                      <span>{child.category}</span>
                    </span>
                    <SummaryAmount
                      amount={child.amount}
                      total={payslipGrossTotal}
                    />
                  </div>
                ))}
            </Fragment>
          );
        }

        return (
          <div
            className={`${styles.legendRow} ${styles.legendRowActive} ${styles.legendRowPassive} ${
              isHovered ? styles.legendRowActive : ""
            }`}
            key={category.category}
            onMouseEnter={() => onHoveredPayslipCategoryChange(category.category)}
            onMouseLeave={() => onHoveredPayslipCategoryChange(null)}
          >
            <span
              className={styles.legendSwatch}
              style={{ backgroundColor: color }}
            />
            <span className={styles.legendCategoryText}>
              <span>{category.category}</span>
            </span>
            <SummaryAmount amount={category.amount} total={payslipGrossTotal} />
          </div>
        );
      })}
    {activeTab === "expenses" &&
      expenseCategories.map((category) => {
        const color = getCategoryColor(category.category);
        const childCategories =
          category.kind === "group"
            ? category.children.map((child) => getCategorySelectionKey(child))
            : [category.category];
        const hasSelectedChild = childCategories.some((childCategory) =>
          selectedCategories.includes(childCategory),
        );
        const isMuted = selectedCategories.length === 0 || !hasSelectedChild;

        if (category.kind === "category") {
          return (
            <button
              type="button"
              className={`${styles.legendRow} ${
                hoveredCategory === category.category ||
                selectedCategories.includes(category.category)
                  ? styles.legendRowActive
                  : ""
              } ${isMuted ? styles.legendRowMuted : ""}`}
              key={category.category}
              onClick={() => onToggleCategory(category.category)}
              onMouseEnter={() => onHoveredCategoryChange(category.category)}
              onMouseLeave={() => onHoveredCategoryChange(null)}
            >
              <span
                className={styles.legendSwatch}
                style={{ backgroundColor: color }}
              />
              <span className={styles.legendCategoryText}>
                <span>{category.category}</span>
              </span>
              <SummaryAmount amount={category.amount} total={expenseTotal} />
            </button>
          );
        }

        return (
          <Fragment key={category.category}>
            <button
              type="button"
              className={`${styles.legendRow} ${styles.legendGroupRow} ${
                hoveredCategory === category.category || hasSelectedChild
                  ? styles.legendRowActive
                  : ""
              } ${isMuted ? styles.legendRowMuted : ""}`}
              onClick={() => onToggleGroup(category.category)}
              onMouseEnter={() => onHoveredCategoryChange(category.category)}
              onMouseLeave={() => onHoveredCategoryChange(null)}
              aria-expanded={Boolean(openGroups[category.category])}
            >
              <span
                className={`${shared.disclosureIcon} ${
                  openGroups[category.category] ? shared.disclosureIconOpen : ""
                }`}
                style={{ borderLeftColor: color }}
              />
              <span className={styles.legendCategoryText}>
                <span>{category.category}</span>
              </span>
              <SummaryAmount amount={category.amount} total={expenseTotal} />
            </button>
            {openGroups[category.category] &&
              category.children.map((child) => {
                const childSelectionKey = getCategorySelectionKey(child);
                const isChildSelected =
                  selectedCategories.includes(childSelectionKey);

                return (
                  <button
                    type="button"
                    className={`${styles.legendRow} ${styles.legendChildRow} ${
                      hoveredCategory === child.category || isChildSelected
                        ? styles.legendRowActive
                        : ""
                    } ${
                      selectedCategories.length === 0 || !isChildSelected
                        ? styles.legendRowMuted
                        : ""
                    }`}
                    key={childSelectionKey}
                    onClick={() => onToggleCategory(childSelectionKey)}
                    onMouseEnter={() =>
                      onHoveredCategoryChange(childSelectionKey)
                    }
                    onMouseLeave={() => onHoveredCategoryChange(null)}
                  >
                    <span
                      className={styles.legendSwatch}
                      style={{ backgroundColor: color }}
                    />
                    <span className={styles.legendCategoryText}>
                      <span>{child.category}</span>
                    </span>
                    <SummaryAmount amount={child.amount} total={expenseTotal} />
                  </button>
                );
              })}
          </Fragment>
        );
      })}
  </div>
);

export default LegendRows;
