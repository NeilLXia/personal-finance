import { incomeAllocationColors } from "../shared/constants";
import type {
  CategoryTotal,
  IncomeAllocationMode,
  Payslip,
  Transaction,
} from "../shared/types";

const sumCategories = (
  categories: CategoryTotal[],
  includedCategories: string[],
) => {
  const includedCategorySet = new Set(
    includedCategories.map((category) => category.toLowerCase()),
  );

  return categories.reduce((total, category) => {
    if (includedCategorySet.has(category.category.toLowerCase())) {
      return total + Math.abs(category.amount);
    }

    return total;
  }, 0);
};

const sumPayslipFields = (payslips: Payslip[], fields: Array<keyof Payslip>) =>
  payslips.reduce(
    (total, payslip) =>
      total +
      fields.reduce(
        (fieldTotal, field) => fieldTotal + Number(payslip[field] || 0),
        0,
      ),
    0,
  );

const roundCurrency = (amount: number) => Number(amount.toFixed(2));

/**
 * The budget target that applies to a segment, or `undefined` when the user has
 * not set one. `targetsByCategory` is keyed by lowercased budget-target category.
 * The "Effective savings" bar falls back to an explicit "Savings" target when no
 * dedicated "Effective savings" target exists.
 */
export const resolveSegmentTargetPercent = (
  segment: { key: string; label: string },
  targetsByCategory: Map<string, number>,
) => {
  const targetPercent =
    segment.key === "savings"
      ? (targetsByCategory.get("effective savings") ??
        targetsByCategory.get("savings"))
      : targetsByCategory.get(segment.label.trim().toLowerCase());

  return typeof targetPercent === "number" && targetPercent > 0
    ? targetPercent
    : undefined;
};

/**
 * Maps a percent-of-income value onto its horizontal offset within a bar track,
 * using the same scale the segment bars are drawn with. Used to place the target
 * marker line.
 */
export const getIncomeAllocationOffsetPercent = ({
  value,
  zeroLinePercent,
  chartMinPercent,
  chartRangePercent,
}: {
  value: number;
  zeroLinePercent: number;
  chartMinPercent: number;
  chartRangePercent: number;
}) => {
  const clampedValue = Math.max(
    chartMinPercent,
    Math.min(chartMinPercent + chartRangePercent, value),
  );

  return zeroLinePercent + (clampedValue / chartRangePercent) * 100;
};

export const getIncomeAllocationIncomeTotal = ({
  income,
  mode = "net",
  payslips = [],
  transactions = [],
}: {
  income: number;
  mode?: IncomeAllocationMode;
  payslips?: Payslip[];
  transactions?: Transaction[];
}) => {
  const payslipGrossIncome = sumPayslipFields(payslips, ["gross_pay"]);
  const payslipNetIncome = sumPayslipFields(payslips, ["net_pay"]);

  if (payslips.length === 0) {
    return income;
  }

  const linkedIncomeTransactionIds = new Set(
    payslips
      .map((payslip) => payslip.income_transaction_id)
      .filter(Boolean)
      .map(String),
  );
  const unlinkedIncome = transactions.reduce((total, transaction) => {
    if (transaction.cash_flow_type !== "income") {
      return total;
    }

    if (linkedIncomeTransactionIds.has(String(transaction.id))) {
      return total;
    }

    return total + Math.abs(Number(transaction.amount || 0));
  }, 0);

  return mode === "gross"
    ? payslipGrossIncome + unlinkedIncome
    : payslipNetIncome + unlinkedIncome;
};

export const buildIncomeAllocationSegments = ({
  income,
  realEstateEquity,
  categories,
  mode = "net",
  payslips = [],
  transactions = [],
  targetPercents = [],
}: {
  income: number;
  savings: number;
  realEstateEquity: number;
  categories: CategoryTotal[];
  mode?: IncomeAllocationMode;
  payslips?: Payslip[];
  transactions?: Transaction[];
  /**
   * Budget-target percentages that will be drawn as marker lines on the bars.
   * Passed in so the chart's max can grow to keep a target (often "Effective
   * savings", which tends to sit near or above the widest bar) inside the track
   * instead of clamped against the clipped right edge.
   */
  targetPercents?: number[];
}) => {
  const denominator = roundCurrency(
    getIncomeAllocationIncomeTotal({
      income,
      mode,
      payslips,
      transactions,
    }),
  );

  if (denominator <= 0) {
    return [];
  }

  const housing = roundCurrency(sumCategories(categories, ["Housing"]));
  const discretionary = roundCurrency(
    sumCategories(categories, [
      "Entertainment",
      "Shopping",
      "Gifts",
      "Travel",
      "Fitness",
    ]),
  );
  const essentials = roundCurrency(
    sumCategories(categories, [
      "Transportation",
      "Bills",
      "Insurance",
      "Health",
      "Personal care",
      "Groceries",
      "Dining",
    ]),
  );
  const grossEssentialDeductions =
    mode === "gross"
      ? roundCurrency(
          sumPayslipFields(payslips, [
            "pretax_dental",
            "pretax_fsa_healthcare",
            "pretax_medical",
          ]),
        )
      : 0;
  const taxes =
    mode === "gross"
      ? roundCurrency(
          sumPayslipFields(payslips, [
            "social_security_tax",
            "medicare_tax",
            "federal_withholding_tax",
            "state_tax",
            "ca_disability_insurance_tax",
          ]),
        )
      : 0;
  const realEstateEquityOffset = roundCurrency(
    Math.min(housing, Math.max(0, realEstateEquity)),
  );
  const netHousing = roundCurrency(
    Math.max(0, housing - realEstateEquityOffset),
  );
  const essentialTotal = roundCurrency(essentials + grossEssentialDeductions);
  const effectiveSavings = roundCurrency(
    denominator -
      netHousing -
      realEstateEquityOffset -
      discretionary -
      essentialTotal -
      taxes,
  );
  const segments = [
    {
      key: "housing",
      label: "Housing",
      amount: netHousing,
      color: incomeAllocationColors.housing,
    },
    {
      key: "essentials",
      label: "Essential expenses",
      amount: essentialTotal,
      color: incomeAllocationColors.essentials,
    },
    {
      key: "discretionary",
      label: "Discretionary expenses",
      amount: discretionary,
      color: incomeAllocationColors.discretionary,
    },
    {
      key: "real_estate_equity",
      label: "Real estate equity",
      amount: realEstateEquityOffset,
      color: incomeAllocationColors.realEstateEquity,
    },
    ...(mode === "gross"
      ? [
          {
            key: "taxes",
            label: "Taxes",
            amount: taxes,
            color: incomeAllocationColors.taxes,
          },
        ]
      : []),
    {
      key: "savings",
      label: effectiveSavings < 0 ? "Shortfall" : "Effective savings",
      amount: effectiveSavings,
      color:
        effectiveSavings < 0
          ? incomeAllocationColors.shortfall
          : incomeAllocationColors.savings,
    },
  ];

  const rawSegments = segments.map((segment) => ({
    ...segment,
    percent: (segment.amount / denominator) * 100,
  }));
  const minSegmentPercent = Math.min(
    ...rawSegments.map((segment) => segment.percent),
  );
  const maxSegmentPercent = Math.max(
    ...rawSegments.map((segment) => segment.percent),
  );
  const maxTargetPercent = Math.max(
    0,
    ...targetPercents.filter((percent) => Number.isFinite(percent)),
  );
  const chartMinPercent =
    minSegmentPercent < -5 ? Math.floor(minSegmentPercent / 5) * 5 : -5;
  const chartUpperBound = Math.max(maxSegmentPercent, maxTargetPercent);
  const chartMaxPercent =
    chartUpperBound > 30 ? Math.ceil(chartUpperBound / 10) * 10 : 30;
  const chartRangePercent = chartMaxPercent - chartMinPercent;
  const zeroLinePercent = ((0 - chartMinPercent) / chartRangePercent) * 100;

  return rawSegments.map((segment) => {
    const { percent } = segment;
    const clampedPercent = Math.max(
      chartMinPercent,
      Math.min(chartMaxPercent, percent),
    );
    const barStartPercent = Math.min(0, clampedPercent);
    const barEndPercent = Math.max(0, clampedPercent);

    return {
      ...segment,
      percent,
      barLeftPercent:
        zeroLinePercent + (barStartPercent / chartRangePercent) * 100,
      barWidthPercent:
        ((barEndPercent - barStartPercent) / chartRangePercent) * 100,
      zeroLinePercent,
      chartMinPercent,
      chartRangePercent,
    };
  });
};
