import { useQueries, useQuery } from "@tanstack/react-query";

import { fetchRetirementProjection } from "./retirementProjectionApi";
import type { RetirementAssumptions } from "./types";

export const defaultRetirementAssumptions: RetirementAssumptions = {
  currentAge: 35,
  retirementAge: 55,
  projectionEndAge: 95,
  retirementSpendingMode: "projected_lifestyle",
  spendingPercent: 80,
  annualSpending: 90000,
  socialSecurityAge: 67,
  inflationRate: 2.5,
  wageGrowthMode: "real",
  realWageGrowthRate: 0.5,
  annualWageIncrease: 5000,
  lifestyleGrowthRate: 0,
  savingsMode: "projected_cashflow",
  savingsPercent: 20,
  annualSavings: 30000,
  realEstateGrowthRate: 0.5,
  accumulationReturn: 5,
  leadingBucketYears: 5,
  leadingBucketReturn: 1.5,
};

export const retirementProjectionQueryKey = (
  assumptions: RetirementAssumptions,
) => ["retirement-projection", assumptions] as const;

export const useRetirementProjection = (
  assumptions: RetirementAssumptions,
  enabled: boolean,
) =>
  useQuery({
    queryKey: retirementProjectionQueryKey(assumptions),
    queryFn: () => fetchRetirementProjection(assumptions),
    enabled,
    placeholderData: (previousData) => previousData,
    retry: false,
  });

export const useRetirementSensitivityProjections = (
  scenarios: RetirementAssumptions[],
  enabled: boolean,
) =>
  useQueries({
    queries: scenarios.map((scenario) => ({
      queryKey: retirementProjectionQueryKey(scenario),
      queryFn: () => fetchRetirementProjection(scenario),
      enabled,
      placeholderData: (previousData: unknown) => previousData,
      retry: false,
    })),
  });
