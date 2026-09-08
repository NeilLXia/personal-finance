import { getCategoryColor } from "../../shared/constants";
import type { CategoryTotal, TransactionPieSlice } from "../../shared/types";

const getArcPoint = (center: number, radius: number, angle: number) => {
  const radians = ((angle - 90) * Math.PI) / 180;

  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
};

const getDonutSlicePath = (
  startAngle: number,
  endAngle: number,
  outerRadius = 44,
  innerRadius = 24,
) => {
  const center = 50;
  const adjustedEndAngle =
    endAngle - startAngle >= 360 ? endAngle - 0.01 : endAngle;
  const outerStart = getArcPoint(center, outerRadius, startAngle);
  const outerEnd = getArcPoint(center, outerRadius, adjustedEndAngle);
  const innerStart = getArcPoint(center, innerRadius, adjustedEndAngle);
  const innerEnd = getArcPoint(center, innerRadius, startAngle);
  const largeArcFlag = adjustedEndAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    "Z",
  ].join(" ");
};

export const buildTransactionPieSlices = (
  categories: CategoryTotal[],
): TransactionPieSlice[] => {
  const total = categories.reduce(
    (sum, category) => sum + Math.abs(category.amount),
    0,
  );
  let startAngle = 0;

  if (total <= 0) {
    return [];
  }

  return categories.map((category) => {
    const degrees = (Math.abs(category.amount) / total) * 360;
    const endAngle = startAngle + degrees;
    const slice = {
      category: category.category,
      amount: category.amount,
      count: category.count,
      color: getCategoryColor(category.category),
      path: getDonutSlicePath(startAngle, endAngle),
    };

    startAngle = endAngle;
    return slice;
  });
};
