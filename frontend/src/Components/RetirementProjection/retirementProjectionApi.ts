import { getJson } from "../../shared/apiClient";
import type { RetirementAssumptions, RetirementProjectionData } from "./types";

const percentToRate = (value: number) => String(value / 100);

export const buildRetirementProjectionParams = (
  assumptions: RetirementAssumptions,
) => {
  const params = new URLSearchParams({
    current_age: String(assumptions.currentAge),
    retirement_age: String(assumptions.retirementAge),
    projection_end_age: String(assumptions.projectionEndAge),
    retirement_spending_mode: assumptions.retirementSpendingMode,
    social_security_age: String(assumptions.socialSecurityAge),
    inflation_rate: percentToRate(assumptions.inflationRate),
    wage_growth_mode: assumptions.wageGrowthMode,
    real_wage_growth_rate: percentToRate(assumptions.realWageGrowthRate),
    annual_wage_increase: String(assumptions.annualWageIncrease),
    lifestyle_growth_rate: percentToRate(assumptions.lifestyleGrowthRate),
    savings_mode: assumptions.savingsMode,
    real_estate_growth_rate: percentToRate(assumptions.realEstateGrowthRate),
    accumulation_return: percentToRate(assumptions.accumulationReturn),
    leading_bucket_years: String(assumptions.leadingBucketYears),
    leading_bucket_return: percentToRate(assumptions.leadingBucketReturn),
  });

  if (assumptions.retirementSpendingMode === "percentage") {
    params.set("spending_percent", String(assumptions.spendingPercent));
  }

  if (assumptions.retirementSpendingMode === "fixed_amount") {
    params.set("annual_spending", String(assumptions.annualSpending));
  }

  if (assumptions.savingsMode === "percentage") {
    params.set("savings_percent", String(assumptions.savingsPercent));
  }

  if (assumptions.savingsMode === "fixed_amount") {
    params.set("annual_savings", String(assumptions.annualSavings));
  }

  return params;
};

export const fetchRetirementProjection = (assumptions: RetirementAssumptions) =>
  getJson<RetirementProjectionData>(
    `/api/retirement-projection?${buildRetirementProjectionParams(
      assumptions,
    ).toString()}`,
    {},
    "Retirement projection request failed",
  );
