import { getCategorySelectionKey } from "../../shared/dashboardDataUtils";
import { formatCurrency } from "../../shared/formatters";
import styles from "./index.module.css";
import type {
  BreakdownTab,
  ExpenseCategorySummary,
  TransactionPieSlice,
} from "../../shared/types";

type PieChartProps = {
  activeTab: BreakdownTab;
  expenseCategories: ExpenseCategorySummary[];
  hoveredCategory: string | null;
  hoveredPayslipCategory: string | null;
  pieSlices: TransactionPieSlice[];
  selectedCategories: string[];
  onHoveredCategoryChange: (category: string | null) => void;
  onHoveredPayslipCategoryChange: (category: string | null) => void;
  onToggleCategory: (category: string) => void;
  onToggleCategoryGroupSelection: (category: string) => void;
};

const PieChart = ({
  activeTab,
  expenseCategories,
  hoveredCategory,
  hoveredPayslipCategory,
  pieSlices,
  selectedCategories,
  onHoveredCategoryChange,
  onHoveredPayslipCategoryChange,
  onToggleCategory,
  onToggleCategoryGroupSelection,
}: PieChartProps) => (
  <div className={styles.pieChart} aria-label="Transaction type pie chart">
    {pieSlices.length === 0 ? (
      <div className={styles.emptyPieChart} />
    ) : (
      <svg viewBox="0 0 100 100">
        {pieSlices.map((slice) => {
          if (activeTab === "income") {
            const isHovered = hoveredPayslipCategory === slice.category;

            return (
              <path
                className={`${styles.pieSlice} ${
                  isHovered ? styles.pieSliceActive : ""
                }`}
                d={slice.path}
                style={{ fill: slice.color }}
                key={slice.category}
                onMouseEnter={() =>
                  onHoveredPayslipCategoryChange(slice.category)
                }
                onMouseLeave={() => onHoveredPayslipCategoryChange(null)}
              >
                <title>
                  {slice.category}: {formatCurrency(slice.amount)}
                </title>
              </path>
            );
          }

          const summary = expenseCategories.find(
            (category) => category.category === slice.category,
          );
          const isHovered = hoveredCategory === slice.category;
          const childCategories =
            summary?.kind === "group"
              ? summary.children.map((child) => getCategorySelectionKey(child))
              : [slice.category];
          const isSelected = childCategories.some((category) =>
            selectedCategories.includes(category),
          );
          const isMuted = selectedCategories.length === 0 || !isSelected;
          const handleSliceSelection = () => {
            if (summary?.kind === "group") {
              onToggleCategoryGroupSelection(summary.category);
              return;
            }

            onToggleCategory(slice.category);
          };

          return (
            <path
              className={`${styles.pieSlice} ${
                isHovered || isSelected ? styles.pieSliceActive : ""
              } ${isMuted ? styles.pieSliceMuted : ""}`}
              d={slice.path}
              style={{ fill: slice.color }}
              key={slice.category}
              onClick={handleSliceSelection}
              onMouseEnter={() => onHoveredCategoryChange(slice.category)}
              onMouseLeave={() => onHoveredCategoryChange(null)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSliceSelection();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <title>
                {slice.category}: {formatCurrency(slice.amount)}
              </title>
            </path>
          );
        })}
      </svg>
    )}
  </div>
);

export default PieChart;
