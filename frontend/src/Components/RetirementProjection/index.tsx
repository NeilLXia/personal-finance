import {
  createContext,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useContext,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  formatCurrency,
  formatTooltipCompactCurrency,
} from "../Dashboard/shared/formatters";
import {
  chartBounds,
  chartViewBoxValue,
  dashboardPalette,
} from "../Dashboard/shared/constants";
import { roundUpTo, scaleLinearY } from "../Dashboard/shared/chartScale";
import ChipSelector from "../shared/ChipSelector";
import shared from "../Dashboard/dashboard.shared.module.css";
import styles from "./index.module.css";
import type {
  RetirementAssumptions,
  RetirementProjectionData,
  RetirementProjectionYear,
} from "./types";
import {
  defaultRetirementAssumptions,
  useRetirementSensitivityProjections,
  useRetirementProjection,
} from "./useRetirementProjection";
import { fetchRetirementProjection } from "./retirementProjectionApi";

type RetirementProjectionPageProps = {
  onBackToDashboard: () => void;
};

type NumericAssumptionKey = {
  [
    TKey in keyof RetirementAssumptions
  ]: RetirementAssumptions[TKey] extends number ? TKey : never;
}[keyof RetirementAssumptions];

type AssumptionInputFormat = "number" | "money";
type BlankAssumptions = Set<NumericAssumptionKey>;
type ProjectionChartMode = "custom" | "sensitivity";
type SensitivityScenario = {
  key: "conservative" | "baseline" | "favorable";
  label: string;
  color: string;
  data: RetirementProjectionData;
};
type SensitivityScenarioConfig = Omit<SensitivityScenario, "data"> & {
  assumptions: RetirementAssumptions;
};

const BlankAssumptionsContext = createContext<BlankAssumptions>(new Set());

const solveFieldRanges: Record<
  NumericAssumptionKey,
  (assumptions: RetirementAssumptions) => { min: number; max: number }
> = {
  currentAge: () => ({ min: 18, max: 100 }),
  retirementAge: (assumptions) => ({ min: assumptions.currentAge, max: 100 }),
  projectionEndAge: (assumptions) => ({
    min: assumptions.retirementAge + 1,
    max: 120,
  }),
  spendingPercent: () => ({ min: 1, max: 200 }),
  annualSpending: () => ({ min: 0, max: 500000 }),
  socialSecurityAge: () => ({ min: 62, max: 70 }),
  inflationRate: () => ({ min: -5, max: 15 }),
  realWageGrowthRate: () => ({ min: -5, max: 15 }),
  annualWageIncrease: () => ({ min: 0, max: 100000 }),
  lifestyleGrowthRate: () => ({ min: -5, max: 15 }),
  savingsPercent: () => ({ min: 0, max: 100 }),
  annualSavings: () => ({ min: 0, max: 500000 }),
  realEstateGrowthRate: () => ({ min: -10, max: 15 }),
  accumulationReturn: () => ({ min: -20, max: 20 }),
  leadingBucketYears: () => ({ min: 1, max: 30 }),
  leadingBucketReturn: () => ({ min: -10, max: 15 }),
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Unable to load retirement projection.";

const projectionChartColor = dashboardPalette.taxAdvantagedSavings;
const realEstateChartColor = dashboardPalette.realEstate;
const totalAssetsColor = "var(--color-ink)";
const conservativeScenarioColor = "var(--chart-ia-shortfall)";
const baselineScenarioColor = dashboardPalette.taxAdvantagedSavings;
const favorableScenarioColor = "var(--chart-c-income)";
const stableTextBaseWidth = 520;
const snapshotTooltipWidth = 52;
const snapshotTooltipHeight = 26.6;

const chartModeOptions = [
  { value: "custom", label: "Custom" },
  { value: "sensitivity", label: "Sensitivity" },
];

const applyRetirementSpendingAdjustment = (
  assumptions: RetirementAssumptions,
  factor: number,
): Pick<
  RetirementAssumptions,
  "retirementSpendingMode" | "spendingPercent" | "annualSpending"
> => {
  if (assumptions.retirementSpendingMode === "fixed_amount") {
    return {
      retirementSpendingMode: "fixed_amount",
      spendingPercent: assumptions.spendingPercent,
      annualSpending: Math.round(assumptions.annualSpending * factor),
    };
  }

  if (assumptions.retirementSpendingMode === "percentage") {
    return {
      retirementSpendingMode: "percentage",
      spendingPercent:
        Math.round(assumptions.spendingPercent * factor * 10) / 10,
      annualSpending: assumptions.annualSpending,
    };
  }

  return {
    retirementSpendingMode: "projected_lifestyle",
    spendingPercent: assumptions.spendingPercent,
    annualSpending: assumptions.annualSpending,
  };
};

const buildSensitivityScenarios = (
  assumptions: RetirementAssumptions,
): SensitivityScenarioConfig[] => {
  const conservativeDeriskedReturn = Math.max(
    -10,
    assumptions.leadingBucketReturn - 0.5,
  );
  const favorableDeriskedReturn = assumptions.leadingBucketReturn + 0.5;
  const conservativeRealEstateGrowth = Math.max(
    -10,
    assumptions.realEstateGrowthRate - 0.5,
  );
  const favorableRealEstateGrowth = assumptions.realEstateGrowthRate + 0.5;
  const conservativeEquityGrowth = Math.max(
    -20,
    assumptions.accumulationReturn - 2,
  );
  const favorableEquityGrowth = assumptions.accumulationReturn + 2;
  const conservativeInflationRate = assumptions.inflationRate + 1;
  const favorableInflationRate = Math.max(0, assumptions.inflationRate - 0.5);

  return [
    {
      key: "conservative",
      label: "Conservative",
      color: conservativeScenarioColor,
      assumptions: {
        ...assumptions,
        ...applyRetirementSpendingAdjustment(assumptions, 1.1),
        wageGrowthMode: "real",
        realWageGrowthRate: 0,
        inflationRate: conservativeInflationRate,
        accumulationReturn: conservativeEquityGrowth,
        leadingBucketReturn: conservativeDeriskedReturn,
        realEstateGrowthRate: conservativeRealEstateGrowth,
      },
    },
    {
      key: "baseline",
      label: "Baseline",
      color: baselineScenarioColor,
      assumptions: {
        ...assumptions,
        wageGrowthMode: "real",
        realWageGrowthRate: 0.5,
      },
    },
    {
      key: "favorable",
      label: "Favorable",
      color: favorableScenarioColor,
      assumptions: {
        ...assumptions,
        ...applyRetirementSpendingAdjustment(assumptions, 0.9),
        wageGrowthMode: "real",
        realWageGrowthRate: 1,
        inflationRate: favorableInflationRate,
        accumulationReturn: favorableEquityGrowth,
        leadingBucketReturn: favorableDeriskedReturn,
        realEstateGrowthRate: favorableRealEstateGrowth,
      },
    },
  ];
};

const getChartMaxValue = (data: RetirementProjectionData) =>
  Math.max(
    roundUpTo(
      Math.max(
        1,
        ...data.years.map((year) => year.beginningAssets),
        ...data.years.map((year) => year.beginningPortfolioAssets),
        ...data.years.map((year) => year.beginningRealEstateEquity),
        data.summary.requiredAssetsAtRetirement,
      ),
      500000,
    ),
    500000,
  );

const getSensitivityChartMaxValue = (scenarios: SensitivityScenario[]) =>
  Math.max(
    roundUpTo(
      Math.max(
        1,
        ...scenarios.flatMap((scenario) =>
          scenario.data.years.map((year) => year.beginningAssets),
        ),
      ),
      500000,
    ),
    500000,
  );

const getAgeX = (data: RetirementProjectionData, age: number) => {
  const ageRange = data.inputs.projectionEndAge - data.inputs.currentAge || 1;

  return (
    chartBounds.left +
    ((age - data.inputs.currentAge) / ageRange) *
      (chartBounds.right - chartBounds.left)
  );
};

const buildRetirementChartTicks = (data: RetirementProjectionData) => {
  const ticks = [];

  for (
    let age = data.inputs.currentAge;
    age <= data.inputs.projectionEndAge;
    age += 1
  ) {
    const isEndpoint =
      age === data.inputs.currentAge || age === data.inputs.projectionEndAge;
    const isMajor = isEndpoint || age % 5 === 0;
    const isStartAge = age === data.inputs.currentAge;
    const nextFiveYearAge = Math.ceil(data.inputs.currentAge / 5) * 5;
    const shouldHideStartLabel =
      isStartAge &&
      nextFiveYearAge > data.inputs.currentAge &&
      nextFiveYearAge - data.inputs.currentAge <= 1;

    ticks.push({
      label: isMajor && !shouldHideStartLabel ? String(age) : "",
      age,
      isMajor,
    });
  }

  return ticks;
};

const getTimelineLabel = (
  event: RetirementProjectionData["timeline"][number],
) => {
  if (event.key === "social_security") {
    return `Social Security income starts at age ${event.age}`;
  }

  if (event.key === "today") {
    return `Current age is ${event.age}`;
  }

  if (event.key === "retirement") {
    return `Retirement begins at age ${event.age}`;
  }

  if (event.key === "mortgage") {
    return `Mortgage is projected to be paid off at age ${event.age}`;
  }

  if (event.key === "end") {
    return `Projection ends at age ${event.age}`;
  }

  return `${event.label} applies at age ${event.age}`;
};

const getTimelineNotes = (data: RetirementProjectionData, age: number) =>
  data.timeline
    .filter((event) => event.age === age)
    .map(getTimelineLabel)
    .join(" / ");

const formatAssumptionValue = (
  value: number,
  format: AssumptionInputFormat,
) => {
  if (format !== "money") {
    return String(value);
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
};

const parseAssumptionValue = (value: string) =>
  Number(value.replace(/[$,%\s,]/g, ""));

const formatPercent = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(value);

const formatPercentPoint = (value: number) =>
  `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value)}%`;

const clampAssumptionValue = (value: number, min?: number, max?: number) => {
  const minClampedValue = min == null ? value : Math.max(min, value);

  return max == null ? minClampedValue : Math.min(max, minClampedValue);
};

const getProjectionSolveScore = (projection: RetirementProjectionData) => {
  const yearsBeforeEnd = projection.years.slice(0, -1);
  const depletesBeforeEnd = yearsBeforeEnd.some(
    (year) => year.endingPortfolioAssets <= 0,
  );

  if (depletesBeforeEnd) {
    return -1;
  }

  return projection.years.at(-1)?.endingPortfolioAssets || 0;
};

const normalizeSolvedValue = (field: NumericAssumptionKey, value: number) => {
  if (
    field === "currentAge" ||
    field === "retirementAge" ||
    field === "projectionEndAge" ||
    field === "socialSecurityAge" ||
    field === "leadingBucketYears"
  ) {
    return Math.round(value);
  }

  if (field === "annualSpending") {
    return Math.round(value / 1000) * 1000;
  }

  if (field === "annualSavings" || field === "annualWageIncrease") {
    return Math.round(value / 100) * 100;
  }

  return Math.round(value * 10) / 10;
};

const AssumptionInput = ({
  field,
  label,
  value,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  format = "number",
  onChange,
  onBlankChange,
}: {
  field?: NumericAssumptionKey;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  format?: AssumptionInputFormat;
  onChange: (value: number) => void;
  onBlankChange?: (field: NumericAssumptionKey, isBlank: boolean) => void;
}) => {
  const blankAssumptions = useContext(BlankAssumptionsContext);
  const isBlank = field ? blankAssumptions.has(field) : false;
  const [draftValue, setDraftValue] = useState(
    isBlank ? "" : formatAssumptionValue(value, format),
  );
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraftValue(isBlank ? "" : formatAssumptionValue(value, format));
    }
  }, [format, isBlank, isFocused, value]);

  const inputMode = step < 1 ? "decimal" : "numeric";

  return (
    <label className={styles.inputLabel}>
      <span>{label}</span>
      <span className={styles.inputShell}>
        {prefix && <span className={styles.inputAffix}>{prefix}</span>}
        <input
          type="text"
          value={draftValue}
          inputMode={inputMode}
          onFocus={() => {
            setIsFocused(true);
            setDraftValue(isBlank ? "" : String(value));
          }}
          onBlur={() => {
            setIsFocused(false);
            if (draftValue.trim() === "") {
              if (field) {
                onBlankChange?.(field, true);
              }
              return;
            }
            const parsedValue = parseAssumptionValue(draftValue);
            const nextValue = Number.isFinite(parsedValue)
              ? clampAssumptionValue(parsedValue, min, max)
              : value;

            if (field) {
              onBlankChange?.(field, false);
            }
            onChange(nextValue);
            setDraftValue(formatAssumptionValue(nextValue, format));
          }}
          onChange={(event) => {
            const nextValue = event.target.value;

            setDraftValue(nextValue);

            if (nextValue.trim() === "") {
              if (field) {
                onBlankChange?.(field, true);
              }
              return;
            }

            if (field) {
              onBlankChange?.(field, false);
            }
            const parsedValue = parseAssumptionValue(nextValue);

            if (Number.isFinite(parsedValue)) {
              onChange(parsedValue);
            }
          }}
        />
        {suffix && <span className={styles.inputAffix}>{suffix}</span>}
      </span>
    </label>
  );
};

const AssumptionGroup = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className={styles.assumptionGroup}>
    <h2>{title}</h2>
    <div className={styles.assumptionGroupFields}>{children}</div>
  </section>
);

const getAverageProjectedSavingsRate = (data: RetirementProjectionData) => {
  const accumulationYears = data.years.filter(
    (year) => year.phase === "accumulation" && year.income > 0,
  );

  if (accumulationYears.length === 0) {
    return 0;
  }

  return (
    accumulationYears.reduce(
      (total, year) => total + year.portfolioContribution / year.income,
      0,
    ) / accumulationYears.length
  );
};

const getCurrentSavingsBreakdown = (data: RetirementProjectionData | null) => {
  if (!data) {
    return [];
  }

  const breakdown =
    data.summary.savingsRateComparison.currentSavingsBreakdown ?? [];

  if (breakdown.length > 0) {
    return breakdown;
  }

  return [
    {
      key: "cash_savings",
      label: "Cash and investment savings",
      annualAmount: data.summary.savingsRateComparison.currentCashSavings,
    },
    {
      key: "paystub_retirement_savings",
      label: "Paystub retirement savings",
      annualAmount: data.summary.savingsRateComparison.currentRetirementSavings,
    },
  ].filter((item) => item.annualAmount !== 0);
};

const modeLabels = {
  projected_lifestyle: "Projected lifestyle",
  percentage: "Percent of income",
  fixed_amount: "Fixed amount",
  projected_cashflow: "Projected cashflow",
  current_rate: "Current rate",
  real: "Real growth",
  nominal: "Nominal amount",
} as const;

const sensitivityAssumptionRows: Array<{
  key: string;
  label: string;
  getValue: (assumptions: RetirementAssumptions) => string;
  showWhen?: (assumptions: RetirementAssumptions) => boolean;
}> = [
  {
    key: "inflationRate",
    label: "Inflation",
    getValue: (assumptions) => formatPercentPoint(assumptions.inflationRate),
  },
  {
    key: "wageGrowthMode",
    label: "Wage increase type",
    getValue: (assumptions) => modeLabels[assumptions.wageGrowthMode],
  },
  {
    key: "realWageGrowthRate",
    label: "Real wage growth",
    getValue: (assumptions) =>
      formatPercentPoint(assumptions.realWageGrowthRate),
  },
  {
    key: "annualWageIncrease",
    label: "Nominal wage increase",
    getValue: (assumptions) => formatCurrency(assumptions.annualWageIncrease),
    showWhen: () => false,
  },
  {
    key: "retirementSpendingMode",
    label: "Retirement expenses",
    getValue: (assumptions) => modeLabels[assumptions.retirementSpendingMode],
  },
  {
    key: "spendingPercent",
    label: "Expense percent",
    getValue: (assumptions) => formatPercentPoint(assumptions.spendingPercent),
    showWhen: (assumptions) =>
      assumptions.retirementSpendingMode === "percentage",
  },
  {
    key: "annualSpending",
    label: "Annual expenses",
    getValue: (assumptions) => formatCurrency(assumptions.annualSpending),
    showWhen: (assumptions) =>
      assumptions.retirementSpendingMode === "fixed_amount",
  },
  {
    key: "lifestyleGrowthRate",
    label: "Expense increase %",
    getValue: (assumptions) =>
      formatPercentPoint(assumptions.lifestyleGrowthRate),
  },
  {
    key: "savingsMode",
    label: "Savings type",
    getValue: (assumptions) => modeLabels[assumptions.savingsMode],
  },
  {
    key: "savingsPercent",
    label: "Savings percent",
    getValue: (assumptions) => formatPercentPoint(assumptions.savingsPercent),
    showWhen: (assumptions) => assumptions.savingsMode === "percentage",
  },
  {
    key: "annualSavings",
    label: "Annual savings",
    getValue: (assumptions) => formatCurrency(assumptions.annualSavings),
    showWhen: (assumptions) => assumptions.savingsMode === "fixed_amount",
  },
  {
    key: "accumulationReturn",
    label: "Equity growth %",
    getValue: (assumptions) =>
      formatPercentPoint(assumptions.accumulationReturn),
  },
  {
    key: "leadingBucketYears",
    label: "Derisking years",
    getValue: (assumptions) => `${assumptions.leadingBucketYears}`,
  },
  {
    key: "leadingBucketReturn",
    label: "Derisked return",
    getValue: (assumptions) =>
      formatPercentPoint(assumptions.leadingBucketReturn),
  },
  {
    key: "realEstateGrowthRate",
    label: "Real estate growth",
    getValue: (assumptions) =>
      formatPercentPoint(assumptions.realEstateGrowthRate),
  },
];

const SensitivityAssumptionsSummary = ({
  activeAssumptions,
  scenarios,
}: {
  activeAssumptions: RetirementAssumptions;
  scenarios: SensitivityScenarioConfig[];
}) => {
  const visibleRows = sensitivityAssumptionRows.filter(
    (row) => !row.showWhen || row.showWhen(activeAssumptions),
  );

  return (
    <section className={styles.sensitivityAssumptions}>
      <div className={styles.sensitivityAssumptionsHeader}>
        <span>Sensitivity assumptions</span>
      </div>
      <div className={styles.sensitivityAssumptionsTable}>
        <div className={styles.sensitivityAssumptionLabel} />
        {scenarios.map((scenario) => (
          <div className={styles.sensitivityScenarioHeading} key={scenario.key}>
            <span
              className={styles.sensitivityScenarioSwatch}
              style={{ backgroundColor: scenario.color }}
            />
            {scenario.label}
          </div>
        ))}
        {visibleRows.map((row) => (
          <Fragment key={row.key}>
            <div className={styles.sensitivityAssumptionLabel}>{row.label}</div>
            {scenarios.map((scenario) => (
              <div
                className={styles.sensitivityAssumptionValue}
                key={`${scenario.key}-${row.key}`}
              >
                {row.showWhen && !row.showWhen(scenario.assumptions)
                  ? "-"
                  : row.getValue(scenario.assumptions)}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </section>
  );
};

const SavingsRateSummary = ({
  data,
}: {
  data: RetirementProjectionData | null;
}) => {
  const currentSavingsRate =
    data?.summary.savingsRateComparison.currentSavingsRate ?? 0;
  const currentSavings =
    data?.summary.savingsRateComparison.currentSavings ?? 0;
  const currentSavingsMonthly = currentSavings / 12;
  const currentSavingsBreakdown = getCurrentSavingsBreakdown(data);
  const projectedSavingsRate = data ? getAverageProjectedSavingsRate(data) : 0;
  const projectedSavings =
    data && data.summary.savingsRateComparison.currentIncome > 0
      ? projectedSavingsRate * data.summary.savingsRateComparison.currentIncome
      : 0;
  const projectedSavingsMonthly = projectedSavings / 12;

  return (
    <section className={styles.savingsRateSummary}>
      <div>
        <span>Current savings rate</span>
        <strong>{data ? formatPercent(currentSavingsRate) : "-"}</strong>
        <small>
          {data ? `${formatCurrency(currentSavingsMonthly)} / mo` : "-"}
        </small>
        {data && (
          <ul className={styles.savingsBreakdown}>
            <li className={styles.savingsBreakdownHeader}>
              <span>Monthly breakout</span>
            </li>
            {currentSavingsBreakdown.length > 0 ? (
              currentSavingsBreakdown.map((item) => (
                <li key={item.key}>
                  <span>{item.label}</span>
                  <strong>{formatCurrency(item.annualAmount / 12)} / mo</strong>
                </li>
              ))
            ) : (
              <li>
                <span>No savings activity found</span>
              </li>
            )}
          </ul>
        )}
      </div>
      <div>
        <span>Average projected savings rate</span>
        <strong>{data ? formatPercent(projectedSavingsRate) : "-"}</strong>
        <small>
          {data ? `${formatCurrency(projectedSavingsMonthly)} / mo` : "-"}
        </small>
      </div>
    </section>
  );
};

const buildAssetPath = (data: RetirementProjectionData) => {
  const maxValue = getChartMaxValue(data);

  return data.years
    .map((year, index) => {
      const x = getAgeX(data, year.age);
      const y = scaleLinearY({
        value: year.beginningAssets,
        minValue: 0,
        range: maxValue,
        top: chartBounds.top,
        bottom: chartBounds.bottom,
      });

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

const buildScenarioAssetPath = ({
  data,
  xScaleData,
  maxValue,
}: {
  data: RetirementProjectionData;
  xScaleData: RetirementProjectionData;
  maxValue: number;
}) =>
  data.years
    .map((year, index) => {
      const x = getAgeX(xScaleData, year.age);
      const y = scaleLinearY({
        value: year.beginningAssets,
        minValue: 0,
        range: maxValue,
        top: chartBounds.top,
        bottom: chartBounds.bottom,
      });

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

const buildAssetAreaPath = ({
  data,
  maxValue,
  getTopValue,
  getBottomValue,
}: {
  data: RetirementProjectionData;
  maxValue: number;
  getTopValue: (year: RetirementProjectionYear) => number;
  getBottomValue: (year: RetirementProjectionYear) => number;
}) => {
  const topPoints = data.years.map((year) => ({
    x: getAgeX(data, year.age),
    y: scaleLinearY({
      value: getTopValue(year),
      minValue: 0,
      range: maxValue,
      top: chartBounds.top,
      bottom: chartBounds.bottom,
    }),
  }));
  const bottomPoints = data.years
    .map((year) => ({
      x: getAgeX(data, year.age),
      y: scaleLinearY({
        value: getBottomValue(year),
        minValue: 0,
        range: maxValue,
        top: chartBounds.top,
        bottom: chartBounds.bottom,
      }),
    }))
    .reverse();

  return [
    ...topPoints.map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    ),
    ...bottomPoints.map(
      (point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    ),
    "Z",
  ].join(" ");
};

const getChartPoint = ({
  data,
  year,
  maxValue,
}: {
  data: RetirementProjectionData;
  year: RetirementProjectionYear;
  maxValue: number;
}) => {
  const x = getAgeX(data, year.age);
  const y = scaleLinearY({
    value: year.beginningAssets,
    minValue: 0,
    range: maxValue,
    top: chartBounds.top,
    bottom: chartBounds.bottom,
  });

  return { x, y };
};

const RetirementSnapshotTooltip = ({
  snapshot,
  eventNote,
  x,
  y,
}: {
  snapshot: RetirementProjectionYear;
  eventNote: string;
  x: number;
  y: number;
}) => {
  const totalAssetAppreciation =
    snapshot.investmentReturn + snapshot.realEstateReturn;
  const leftValueX = x + 23.5;
  const rightLabelX = x + 27.5;
  const rightValueX = x + 50;

  return (
    <g className={styles.snapshotTooltip}>
      <rect
        className={styles.snapshotTooltipBox}
        x={x}
        y={y}
        width={snapshotTooltipWidth}
        height={snapshotTooltipHeight}
        rx="1.25"
      />
      <text className={styles.snapshotTooltipTitle} x={x + 1.4} y={y + 2.7}>
        Age {snapshot.age}
      </text>
      <text className={styles.snapshotTooltipTotal} x={rightValueX} y={y + 2.7}>
        {formatTooltipCompactCurrency(snapshot.beginningAssets)}
      </text>
      {eventNote && (
        <text className={styles.snapshotTooltipNote} x={x + 1.4} y={y + 5.1}>
          {eventNote}
        </text>
      )}
      <text className={styles.snapshotTooltipSection} x={x + 1.4} y={y + 7.8}>
        Assets
      </text>
      <text
        className={styles.snapshotTooltipSection}
        x={rightLabelX}
        y={y + 7.8}
      >
        Cash flow
      </text>
      <text className={styles.snapshotTooltipText} x={x + 1.4} y={y + 10.4}>
        Portfolio
      </text>
      <text className={styles.snapshotTooltipValue} x={leftValueX} y={y + 10.4}>
        {formatTooltipCompactCurrency(snapshot.beginningPortfolioAssets)}
      </text>
      <text className={styles.snapshotTooltipText} x={rightLabelX} y={y + 10.4}>
        Income
      </text>
      <text
        className={styles.snapshotTooltipValue}
        x={rightValueX}
        y={y + 10.4}
      >
        {formatTooltipCompactCurrency(snapshot.income)}
      </text>
      <text className={styles.snapshotTooltipText} x={x + 1.4} y={y + 13}>
        Home
      </text>
      <text className={styles.snapshotTooltipValue} x={leftValueX} y={y + 13}>
        {formatTooltipCompactCurrency(snapshot.beginningRealEstateValue)}
      </text>
      <text className={styles.snapshotTooltipText} x={x + 1.4} y={y + 15.6}>
        Mortgage
      </text>
      <text className={styles.snapshotTooltipValue} x={leftValueX} y={y + 15.6}>
        {formatTooltipCompactCurrency(-snapshot.beginningMortgageBalance)}
      </text>
      <text className={styles.snapshotTooltipText} x={x + 1.4} y={y + 18.2}>
        Apprec.
      </text>
      <text className={styles.snapshotTooltipValue} x={leftValueX} y={y + 18.2}>
        {formatTooltipCompactCurrency(totalAssetAppreciation)}
      </text>
      <text className={styles.snapshotTooltipText} x={rightLabelX} y={y + 13}>
        Soc. Sec.
      </text>
      <text className={styles.snapshotTooltipValue} x={rightValueX} y={y + 13}>
        {formatTooltipCompactCurrency(snapshot.socialSecurityIncome)}
      </text>
      <text className={styles.snapshotTooltipText} x={rightLabelX} y={y + 15.6}>
        Taxes
      </text>
      <text
        className={styles.snapshotTooltipValue}
        x={rightValueX}
        y={y + 15.6}
      >
        {formatTooltipCompactCurrency(-snapshot.taxes)}
      </text>
      <text className={styles.snapshotTooltipText} x={rightLabelX} y={y + 18.2}>
        Expenses
      </text>
      <text
        className={styles.snapshotTooltipValue}
        x={rightValueX}
        y={y + 18.2}
      >
        {formatTooltipCompactCurrency(-snapshot.expenses)}
      </text>
      <text className={styles.snapshotTooltipText} x={rightLabelX} y={y + 20.8}>
        Mortgage
      </text>
      <text
        className={styles.snapshotTooltipValue}
        x={rightValueX}
        y={y + 20.8}
      >
        {formatTooltipCompactCurrency(-snapshot.mortgageExpense)}
      </text>
      <text className={styles.snapshotTooltipText} x={rightLabelX} y={y + 23.4}>
        Net cash
      </text>
      <text
        className={styles.snapshotTooltipValue}
        x={rightValueX}
        y={y + 23.4}
      >
        {formatTooltipCompactCurrency(snapshot.netCashflow)}
      </text>
    </g>
  );
};

const ProjectionChart = ({
  data,
  mode,
  scenarios,
  isLoading,
  onModeChange,
}: {
  data: RetirementProjectionData | null;
  mode: ProjectionChartMode;
  scenarios: SensitivityScenario[];
  isLoading: boolean;
  onModeChange: (mode: ProjectionChartMode) => void;
}) => {
  const [hoveredYear, setHoveredYear] =
    useState<RetirementProjectionYear | null>(null);
  const [selectedYear, setSelectedYear] =
    useState<RetirementProjectionYear | null>(null);
  const chartRef = useRef<HTMLElement | null>(null);
  const [chartTextScale, setChartTextScale] = useState(1);
  const isSensitivityMode = mode === "sensitivity";
  const chartData = isSensitivityMode ? scenarios[1]?.data || null : data;
  const assetPath = useMemo(
    () => (!isSensitivityMode && data ? buildAssetPath(data) : ""),
    [data, isSensitivityMode],
  );
  const maxValue = isSensitivityMode
    ? scenarios.length > 0
      ? getSensitivityChartMaxValue(scenarios)
      : 1
    : data
      ? getChartMaxValue(data)
      : 1;
  const scenarioPaths = useMemo(
    () =>
      scenarios.map((scenario) => ({
        ...scenario,
        path: chartData
          ? buildScenarioAssetPath({
              data: scenario.data,
              xScaleData: chartData,
              maxValue,
            })
          : "",
      })),
    [chartData, maxValue, scenarios],
  );
  const realEstateAreaPath =
    !isSensitivityMode && data
      ? buildAssetAreaPath({
          data,
          maxValue,
          getTopValue: (year) => year.beginningRealEstateEquity,
          getBottomValue: () => 0,
        })
      : "";
  const portfolioAreaPath =
    !isSensitivityMode && data
      ? buildAssetAreaPath({
          data,
          maxValue,
          getTopValue: (year) => year.beginningAssets,
          getBottomValue: (year) => year.beginningRealEstateEquity,
        })
      : "";
  const hoverBandWidth = chartData
    ? (chartBounds.right - chartBounds.left) /
      Math.max(1, chartData.years.length)
    : 0;
  const yTicks = chartData
    ? [0, maxValue / 2, maxValue].map((value) => ({
        value,
        y: scaleLinearY({
          value,
          minValue: 0,
          range: maxValue,
          top: chartBounds.top,
          bottom: chartBounds.bottom,
        }),
      }))
    : [];
  const xTicks = chartData ? buildRetirementChartTicks(chartData) : [];
  const hoveredPoint =
    chartData && hoveredYear
      ? getChartPoint({ data: chartData, year: hoveredYear, maxValue })
      : null;
  const selectedPoint =
    data && selectedYear
      ? getChartPoint({ data, year: selectedYear, maxValue })
      : null;
  const selectedMarkerVisible =
    selectedYear && selectedPoint && selectedYear.age !== hoveredYear?.age;
  const hoveredEventNote =
    data && hoveredYear ? getTimelineNotes(data, hoveredYear.age) : "";
  const tooltipX = hoveredPoint
    ? Math.min(
        Math.max(hoveredPoint.x + 3, chartBounds.left),
        chartBounds.right - snapshotTooltipWidth,
      )
    : 0;
  const tooltipY = hoveredPoint
    ? Math.min(
        Math.max(hoveredPoint.y - 6, chartBounds.top),
        chartBounds.bottom - snapshotTooltipHeight,
      )
    : 0;
  const retirementX = chartData
    ? getAgeX(chartData, chartData.inputs.retirementAge)
    : 0;
  const chartStyle = {
    "--retirement-chart-text-scale": chartTextScale,
  } as CSSProperties;

  useEffect(() => {
    const chartElement = chartRef.current;

    if (!chartElement) {
      return undefined;
    }

    const updateTextScale = () => {
      const width = chartElement.getBoundingClientRect().width;

      if (width <= 0) {
        return;
      }

      setChartTextScale(
        Math.min(1.25, Math.max(0.55, stableTextBaseWidth / width)),
      );
    };
    const resizeObserver = new ResizeObserver(updateTextScale);

    updateTextScale();
    resizeObserver.observe(chartElement);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <section
      ref={chartRef}
      style={chartStyle}
      className={`${shared.chartFrame} ${shared.chartFrameTight} ${
        styles.retirementChartFrame
      } ${isLoading ? styles.chartPanelLoading : ""}`}
      aria-busy={isLoading}
    >
      <div className={`${shared.dashboardCardHeader} ${styles.chartHeader}`}>
        <ChipSelector
          ariaLabel="Projection chart mode"
          options={chartModeOptions}
          selectedValues={[mode]}
          onToggle={(value) => onModeChange(value as ProjectionChartMode)}
        />
      </div>
      <svg
        viewBox={chartViewBoxValue}
        role="img"
        aria-label="Projected portfolio assets"
        onMouseLeave={() => setHoveredYear(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setHoveredYear(null);
          }
        }}
      >
        {chartData ? (
          <>
            {yTicks.map((tick) => (
              <g key={tick.value}>
                <line
                  className={shared.chartGridLine}
                  x1={chartBounds.left}
                  x2={chartBounds.right}
                  y1={tick.y}
                  y2={tick.y}
                />
                <text
                  className={`${shared.chartYAxisLabel} ${styles.chartYAxisText}`}
                  x={chartBounds.left - 3}
                  y={tick.y - 1}
                >
                  {formatTooltipCompactCurrency(tick.value)}
                </text>
              </g>
            ))}
            {xTicks.map((tick) => {
              const x = getAgeX(chartData, tick.age);

              return (
                <g key={`${tick.label}-${tick.age}`}>
                  <line
                    className={
                      tick.isMajor
                        ? shared.chartXAxisTickMajor
                        : shared.chartXAxisTick
                    }
                    x1={x}
                    x2={x}
                    y1={chartBounds.bottom}
                    y2={
                      tick.isMajor
                        ? chartBounds.bottom + 3
                        : chartBounds.bottom + 2
                    }
                  />
                  {tick.label && (
                    <text
                      className={`${shared.chartXAxisLabel} ${styles.chartXAxisText}`}
                      textAnchor={
                        tick.age === chartData.inputs.currentAge
                          ? "start"
                          : tick.age === chartData.inputs.projectionEndAge
                            ? "end"
                            : "middle"
                      }
                      x={x}
                      y="88"
                    >
                      {tick.label}
                    </text>
                  )}
                </g>
              );
            })}
            {!isSensitivityMode && data && (
              <>
                <path
                  d={realEstateAreaPath}
                  className={styles.realEstateArea}
                  style={{ fill: realEstateChartColor }}
                />
                <path
                  d={portfolioAreaPath}
                  className={styles.portfolioArea}
                  style={{ fill: projectionChartColor }}
                />
                <path
                  d={assetPath}
                  className={styles.assetLine}
                  style={{ stroke: totalAssetsColor }}
                />
              </>
            )}
            {isSensitivityMode &&
              scenarioPaths.map((scenario) => (
                <path
                  key={scenario.key}
                  d={scenario.path}
                  className={styles.scenarioLine}
                  style={{ stroke: scenario.color }}
                />
              ))}
            {chartData.timeline.map((event) => {
              const x = getAgeX(chartData, event.age);
              const isEdge = event.key === "today" || event.key === "end";

              return (
                <g key={event.key}>
                  <line
                    x1={x}
                    y1={chartBounds.top}
                    x2={x}
                    y2={chartBounds.bottom}
                    className={
                      isEdge ? styles.edgeMarkerLine : styles.markerLine
                    }
                  >
                    <title>
                      {event.label} age {event.age}
                    </title>
                  </line>
                </g>
              );
            })}
            <g
              className={styles.retirementMarker}
              transform={`translate(${retirementX} 8)`}
            >
              <circle r="3.7" />
              <path d="M -1.9 0.5 L 0 -2 L 1.9 0.5 M 0 -2 L 0 2.5 M -1.7 2.5 L 1.7 2.5" />
              <title>Retirement age {chartData.inputs.retirementAge}</title>
            </g>
            {!isSensitivityMode &&
              data &&
              data.years.map((year) => {
                const point = getChartPoint({ data, year, maxValue });

                return (
                  <g
                    key={year.age}
                    className={styles.hoverPoint}
                    role="button"
                    tabIndex={0}
                    aria-label={`Show snapshot for age ${year.age}`}
                    onMouseEnter={() => setHoveredYear(year)}
                    onFocus={() => setHoveredYear(year)}
                    onClick={() => setSelectedYear(year)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedYear(year);
                      }
                    }}
                  >
                    <rect
                      x={point.x - hoverBandWidth / 2}
                      y={chartBounds.top}
                      width={hoverBandWidth}
                      height={chartBounds.bottom - chartBounds.top}
                      className={styles.hoverBand}
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="1.1"
                      className={styles.snapshotDot}
                    />
                    <title>Age {year.age}</title>
                  </g>
                );
              })}
            {!isSensitivityMode && selectedMarkerVisible && (
              <g>
                <line
                  className={styles.selectedLine}
                  x1={selectedPoint.x}
                  x2={selectedPoint.x}
                  y1={chartBounds.top}
                  y2={chartBounds.bottom}
                />
                <circle
                  className={styles.selectedDot}
                  cx={selectedPoint.x}
                  cy={selectedPoint.y}
                  r="1.6"
                />
              </g>
            )}
            {!isSensitivityMode && hoveredYear && hoveredPoint && (
              <g>
                <line
                  className={styles.hoverLine}
                  x1={hoveredPoint.x}
                  x2={hoveredPoint.x}
                  y1={chartBounds.top}
                  y2={chartBounds.bottom}
                />
                <circle
                  className={styles.hoverDot}
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r="1.6"
                />
                <RetirementSnapshotTooltip
                  snapshot={hoveredYear}
                  eventNote={hoveredEventNote}
                  x={tooltipX}
                  y={tooltipY}
                />
              </g>
            )}
          </>
        ) : (
          <path
            d="M 22 68 L 56 62 L 90 48 L 124 36 L 158 44 L 190 60"
            className={styles.placeholderLine}
          />
        )}
      </svg>
      <div className={shared.chartLegend}>
        {isSensitivityMode ? (
          scenarioPaths.map((scenario) => (
            <span className={shared.chartLegendItem} key={scenario.key}>
              <span
                className={shared.chartLegendSwatch}
                style={{ backgroundColor: scenario.color }}
              />
              {scenario.label}
            </span>
          ))
        ) : (
          <>
            <span className={shared.chartLegendItem}>
              <span
                className={shared.chartLegendSwatch}
                style={{ backgroundColor: projectionChartColor }}
              />
              Portfolio/equity
            </span>
            <span className={shared.chartLegendItem}>
              <span
                className={shared.chartLegendSwatch}
                style={{ backgroundColor: realEstateChartColor }}
              />
              Real estate
            </span>
            <span className={shared.chartLegendItem}>
              <span
                className={shared.chartLegendSwatch}
                style={{ backgroundColor: totalAssetsColor }}
              />
              Total assets
            </span>
          </>
        )}
      </div>
    </section>
  );
};

const RetirementProjectionPage = ({
  onBackToDashboard,
}: RetirementProjectionPageProps) => {
  const [assumptions, setAssumptions] = useState(defaultRetirementAssumptions);
  const [chartMode, setChartMode] = useState<ProjectionChartMode>("custom");
  const [blankAssumptions, setBlankAssumptions] = useState<BlankAssumptions>(
    () => new Set(),
  );
  const [calculationStatus, setCalculationStatus] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const { data, isFetching, isLoading, error } = useRetirementProjection(
    assumptions,
    true,
  );
  const sensitivityScenarioConfigs = useMemo(
    () => buildSensitivityScenarios(assumptions),
    [assumptions],
  );
  const sensitivityQueries = useRetirementSensitivityProjections(
    sensitivityScenarioConfigs.map((scenario) => scenario.assumptions),
    chartMode === "sensitivity",
  );
  const sensitivityScenarios = sensitivityScenarioConfigs.flatMap(
    (scenario, index) => {
      const scenarioData = sensitivityQueries[index]?.data;

      if (!scenarioData) {
        return [];
      }

      return [
        {
          key: scenario.key,
          label: scenario.label,
          color: scenario.color,
          data: scenarioData,
        },
      ];
    },
  );
  const isSensitivityFetching = sensitivityQueries.some(
    (query) => query.isLoading || query.isFetching,
  );
  const socialSecurityBenefit =
    data?.inputs.socialSecurity.startAge === assumptions.socialSecurityAge &&
    data.inputs.retirementAge === assumptions.retirementAge
      ? data.inputs.socialSecurity.annualBenefit
      : null;

  const updateAssumption = <TKey extends keyof RetirementAssumptions>(
    key: TKey,
    value: RetirementAssumptions[TKey],
  ) => setAssumptions((current) => ({ ...current, [key]: value }));
  const updateBlankAssumption = (
    field: NumericAssumptionKey,
    isBlank: boolean,
  ) =>
    setBlankAssumptions((current) => {
      const next = new Set(current);

      if (isBlank) {
        next.add(field);
      } else {
        next.delete(field);
      }

      return next;
    });
  const solveBlankAssumption = async () => {
    const [field] = Array.from(blankAssumptions);

    if (blankAssumptions.size !== 1 || !field) {
      setCalculationStatus("Clear exactly one numeric field to calculate it.");
      return;
    }

    const range = solveFieldRanges[field](assumptions);
    setIsCalculating(true);
    setCalculationStatus("");

    try {
      const projectWithValue = async (value: number) =>
        getProjectionSolveScore(
          await fetchRetirementProjection({
            ...assumptions,
            [field]: value,
          }),
        );
      let low = range.min;
      let high = range.max;
      let lowBalance = await projectWithValue(low);
      let highBalance = await projectWithValue(high);

      if (Math.sign(lowBalance) === Math.sign(highBalance)) {
        const closestValue =
          lowBalance >= 0 && highBalance >= 0
            ? lowBalance < highBalance
              ? low
              : high
            : lowBalance >= 0
              ? low
              : highBalance >= 0
                ? high
                : Math.abs(lowBalance) < Math.abs(highBalance)
                  ? low
                  : high;
        const solvedValue = normalizeSolvedValue(field, closestValue);

        updateAssumption(field, solvedValue);
        updateBlankAssumption(field, false);
        setCalculationStatus("Used the closest available value.");
        return;
      }

      for (let index = 0; index < 28; index += 1) {
        const midpoint = (low + high) / 2;
        const midpointBalance = await projectWithValue(midpoint);

        if (Math.sign(midpointBalance) === Math.sign(lowBalance)) {
          low = midpoint;
          lowBalance = midpointBalance;
        } else {
          high = midpoint;
          highBalance = midpointBalance;
        }
      }

      const solvedValue = normalizeSolvedValue(field, (low + high) / 2);

      updateAssumption(field, solvedValue);
      updateBlankAssumption(field, false);
      setCalculationStatus(
        "Calculated to target a $0 ending portfolio balance without depleting before the final year.",
      );
    } catch {
      setCalculationStatus("Unable to calculate that field.");
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <section className={styles.retirementPage}>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <h1>Retirement Projection</h1>
          <p>Admin-only development preview</p>
        </div>
        <div className={styles.pageActions}>
          <button type="button" onClick={onBackToDashboard}>
            Dashboard
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.statusText}>{getErrorMessage(error)}</div>
      )}
      <div className={styles.projectionWorkspace}>
        <div className={styles.projectionColumn}>
          <ProjectionChart
            data={data || null}
            mode={chartMode}
            scenarios={sensitivityScenarios}
            isLoading={isLoading || isFetching || isSensitivityFetching}
            onModeChange={setChartMode}
          />
          <SavingsRateSummary data={data || null} />
          {chartMode === "sensitivity" && (
            <SensitivityAssumptionsSummary
              activeAssumptions={assumptions}
              scenarios={sensitivityScenarioConfigs}
            />
          )}
        </div>

        <BlankAssumptionsContext.Provider value={blankAssumptions}>
          <aside className={styles.assumptionsPanel}>
            <AssumptionGroup title="Timeline">
              <AssumptionInput
                field="currentAge"
                label="Current age"
                min={18}
                max={100}
                value={assumptions.currentAge}
                suffix="yrs"
                onBlankChange={updateBlankAssumption}
                onChange={(value) => updateAssumption("currentAge", value)}
              />
              <AssumptionInput
                field="retirementAge"
                label="Retirement age"
                min={assumptions.currentAge}
                max={100}
                value={assumptions.retirementAge}
                suffix="yrs"
                onBlankChange={updateBlankAssumption}
                onChange={(value) => updateAssumption("retirementAge", value)}
              />
              <AssumptionInput
                field="projectionEndAge"
                label="Projection end"
                min={assumptions.retirementAge + 1}
                max={120}
                value={assumptions.projectionEndAge}
                suffix="yrs"
                onBlankChange={updateBlankAssumption}
                onChange={(value) =>
                  updateAssumption("projectionEndAge", value)
                }
              />
            </AssumptionGroup>

            <AssumptionGroup title="Income">
              <AssumptionInput
                field="socialSecurityAge"
                label="Social Security age"
                min={62}
                max={70}
                value={assumptions.socialSecurityAge}
                suffix="yrs"
                onBlankChange={updateBlankAssumption}
                onChange={(value) =>
                  updateAssumption("socialSecurityAge", value)
                }
              />
              <div className={styles.derivedAssumption}>
                <span>
                  Social Security income at age {assumptions.socialSecurityAge}
                </span>
                <strong>
                  {socialSecurityBenefit == null
                    ? "Updating"
                    : `$${formatAssumptionValue(
                        socialSecurityBenefit,
                        "money",
                      )}`}
                </strong>
              </div>
              <label className={styles.inputLabel}>
                <span>Wage increase type</span>
                <select
                  value={assumptions.wageGrowthMode}
                  onChange={(event) =>
                    updateAssumption(
                      "wageGrowthMode",
                      event.target
                        .value as RetirementAssumptions["wageGrowthMode"],
                    )
                  }
                >
                  <option value="real">Above inflation</option>
                  <option value="nominal">Nominal</option>
                </select>
              </label>
              {assumptions.wageGrowthMode === "nominal" ? (
                <AssumptionInput
                  field="annualWageIncrease"
                  label="Annual wage increase"
                  min={0}
                  step={1000}
                  value={assumptions.annualWageIncrease}
                  prefix="$"
                  format="money"
                  onBlankChange={updateBlankAssumption}
                  onChange={(value) =>
                    updateAssumption("annualWageIncrease", value)
                  }
                />
              ) : (
                <AssumptionInput
                  field="realWageGrowthRate"
                  label="Real wage increase %"
                  step={0.1}
                  value={assumptions.realWageGrowthRate}
                  suffix="%"
                  onBlankChange={updateBlankAssumption}
                  onChange={(value) =>
                    updateAssumption("realWageGrowthRate", value)
                  }
                />
              )}
            </AssumptionGroup>

            <AssumptionGroup title="Expenses">
              <label className={styles.inputLabel}>
                <span>Retirement spending</span>
                <select
                  value={assumptions.retirementSpendingMode}
                  onChange={(event) =>
                    updateAssumption(
                      "retirementSpendingMode",
                      event.target
                        .value as RetirementAssumptions["retirementSpendingMode"],
                    )
                  }
                >
                  <option value="projected_lifestyle">
                    Projected lifestyle
                  </option>
                  <option value="percentage">
                    Percent of Pre-Retirement Income
                  </option>
                  <option value="fixed_amount">Fixed amount</option>
                </select>
              </label>
              <div className={styles.conditionalInputSlot}>
                {assumptions.retirementSpendingMode === "percentage" && (
                  <AssumptionInput
                    field="spendingPercent"
                    label="Spending percent"
                    min={1}
                    max={200}
                    value={assumptions.spendingPercent}
                    suffix="%"
                    onBlankChange={updateBlankAssumption}
                    onChange={(value) =>
                      updateAssumption("spendingPercent", value)
                    }
                  />
                )}
                {assumptions.retirementSpendingMode === "fixed_amount" && (
                  <AssumptionInput
                    field="annualSpending"
                    label="Annual spending"
                    min={0}
                    step={1000}
                    value={assumptions.annualSpending}
                    prefix="$"
                    format="money"
                    onBlankChange={updateBlankAssumption}
                    onChange={(value) =>
                      updateAssumption("annualSpending", value)
                    }
                  />
                )}
              </div>
              <AssumptionInput
                field="inflationRate"
                label="Inflation %"
                step={0.1}
                value={assumptions.inflationRate}
                suffix="%"
                onBlankChange={updateBlankAssumption}
                onChange={(value) => updateAssumption("inflationRate", value)}
              />
              <AssumptionInput
                field="lifestyleGrowthRate"
                label="Expense increase %"
                step={0.1}
                value={assumptions.lifestyleGrowthRate}
                suffix="%"
                onBlankChange={updateBlankAssumption}
                onChange={(value) =>
                  updateAssumption("lifestyleGrowthRate", value)
                }
              />
            </AssumptionGroup>

            <AssumptionGroup title="Savings">
              <label className={styles.inputLabel}>
                <span>Savings type</span>
                <select
                  value={assumptions.savingsMode}
                  onChange={(event) =>
                    updateAssumption(
                      "savingsMode",
                      event.target
                        .value as RetirementAssumptions["savingsMode"],
                    )
                  }
                >
                  <option value="projected_cashflow">Projected cashflow</option>
                  <option value="current_rate">Current savings rate</option>
                  <option value="percentage">Percentage of income</option>
                  <option value="fixed_amount">Fixed annual amount</option>
                </select>
              </label>
              <div className={styles.conditionalInputSlot}>
                {assumptions.savingsMode === "percentage" && (
                  <AssumptionInput
                    field="savingsPercent"
                    label="Savings percent"
                    min={0}
                    max={100}
                    value={assumptions.savingsPercent}
                    suffix="%"
                    onBlankChange={updateBlankAssumption}
                    onChange={(value) =>
                      updateAssumption("savingsPercent", value)
                    }
                  />
                )}
                {assumptions.savingsMode === "fixed_amount" && (
                  <AssumptionInput
                    field="annualSavings"
                    label="Annual savings"
                    min={0}
                    step={1000}
                    value={assumptions.annualSavings}
                    prefix="$"
                    format="money"
                    onBlankChange={updateBlankAssumption}
                    onChange={(value) =>
                      updateAssumption("annualSavings", value)
                    }
                  />
                )}
              </div>
            </AssumptionGroup>

            <AssumptionGroup title="Asset Rate of Return">
              <AssumptionInput
                field="accumulationReturn"
                label="Equity growth %"
                step={0.1}
                value={assumptions.accumulationReturn}
                suffix="%"
                onBlankChange={updateBlankAssumption}
                onChange={(value) =>
                  updateAssumption("accumulationReturn", value)
                }
              />
              <AssumptionInput
                field="realEstateGrowthRate"
                label="Real estate growth %"
                step={0.1}
                value={assumptions.realEstateGrowthRate}
                suffix="%"
                onBlankChange={updateBlankAssumption}
                onChange={(value) =>
                  updateAssumption("realEstateGrowthRate", value)
                }
              />
            </AssumptionGroup>

            <AssumptionGroup title="Asset Derisking">
              <AssumptionInput
                field="leadingBucketYears"
                label="Leading years"
                min={1}
                max={30}
                value={assumptions.leadingBucketYears}
                suffix="yrs"
                onBlankChange={updateBlankAssumption}
                onChange={(value) =>
                  updateAssumption("leadingBucketYears", value)
                }
              />
              <AssumptionInput
                field="leadingBucketReturn"
                label="Derisked return %"
                step={0.1}
                value={assumptions.leadingBucketReturn}
                suffix="%"
                onBlankChange={updateBlankAssumption}
                onChange={(value) =>
                  updateAssumption("leadingBucketReturn", value)
                }
              />
            </AssumptionGroup>

            <div className={styles.calculateAssumption}>
              <button
                type="button"
                onClick={solveBlankAssumption}
                disabled={isCalculating}
              >
                {isCalculating ? "Solving" : "Solve for ending balance"}
              </button>
              {calculationStatus && <p>{calculationStatus}</p>}
            </div>
          </aside>
        </BlankAssumptionsContext.Provider>
      </div>
    </section>
  );
};

export default RetirementProjectionPage;
