export type RetirementProjectionInputs = {
  currentAge: number;
  retirementAge: number;
  projectionEndAge: number;
  currentIncome: number;
  currentGrossIncome: number;
  currentGrossPay: number;
  currentTaxes: number;
  currentOtherIncome: number;
  currentExpenses: number;
  currentAssets: number;
  currentPortfolioAssets: number;
  currentRealEstateValue: number;
  currentRealEstateDebt: number;
  currentRealEstateEquity: number;
  currentCashSavings: number;
  currentRetirementSavings: number;
  currentSavings: number;
  currentSavingsIncome: number;
  annualContributions: number;
  inflationRate: number;
  wageGrowthMode: "real" | "nominal";
  realWageGrowthRate: number;
  annualWageIncrease: number;
  lifestyleGrowthRate: number;
  realEstateGrowthRate: number;
  savingsStrategy: {
    mode: "projected_cashflow" | "current_rate" | "percentage" | "fixed_amount";
    percent?: number;
    annualAmount?: number;
  };
  retirementSpending: {
    mode: "projected_lifestyle" | "percentage" | "fixed_amount";
    percent?: number;
    annualAmount?: number;
  };
  socialSecurity: {
    startAge: number;
    annualBenefit: number;
    source: string;
  };
  investmentAssumptions: {
    accumulationReturn: number;
    leadingBucketYears: number;
    leadingBucketReturn: number;
  };
};

export type RetirementProjectionYear = {
  age: number;
  year: number;
  phase: "accumulation" | "retirement";
  income: number;
  expenses: number;
  mortgageExpense: number;
  taxes: number;
  netCashflow: number;
  socialSecurityIncome: number;
  portfolioContribution: number;
  portfolioWithdrawal: number;
  beginningAssets: number;
  beginningPortfolioAssets: number;
  beginningRealEstateValue: number;
  beginningMortgageBalance: number;
  beginningRealEstateEquity: number;
  leadingBucketAssets: number;
  growthAssets: number;
  investmentReturn: number;
  realEstateReturn: number;
  mortgageInterestPaid: number;
  mortgagePrincipalPaid: number;
  realEstateLiquidationProceeds: number;
  unmetWithdrawal: number;
  endingPortfolioAssets: number;
  endingRealEstateValue: number;
  endingMortgageBalance: number;
  endingRealEstateEquity: number;
  endingAssets: number;
  isDepleted: boolean;
};

export type RetirementProjectionData = {
  inputs: RetirementProjectionInputs;
  assumptions: {
    nominalExpenseGrowth: number;
    nominalIncomeGrowth: number;
  };
  summary: {
    retirementAge: number;
    projectedRetirementSpending: number;
    projectedAssetsAtRetirement: number;
    projectedPortfolioAssetsAtRetirement: number;
    projectedRealEstateEquityAtRetirement: number;
    requiredAssetsAtRetirement: number;
    projectedCushion: number;
    savingsRateComparison: {
      currentCashSavings: number;
      currentRetirementSavings: number;
      currentSavings: number;
      currentSavingsBreakdown: Array<{
        key: string;
        label: string;
        annualAmount: number;
      }>;
      currentIncome: number;
      currentSavingsRate: number;
      projectedSavings: number;
      projectedIncome: number;
      projectedSavingsRate: number;
      savingsRateGap: number;
    };
    isFunded: boolean;
  };
  mortgage: {
    annualPayment: number;
    payoffAge: number | null;
    source: string;
  };
  timeline: Array<{
    key: string;
    label: string;
    age: number;
  }>;
  years: RetirementProjectionYear[];
};

export type RetirementAssumptions = {
  currentAge: number;
  retirementAge: number;
  projectionEndAge: number;
  retirementSpendingMode: "projected_lifestyle" | "percentage" | "fixed_amount";
  spendingPercent: number;
  annualSpending: number;
  socialSecurityAge: number;
  inflationRate: number;
  wageGrowthMode: "real" | "nominal";
  realWageGrowthRate: number;
  annualWageIncrease: number;
  lifestyleGrowthRate: number;
  savingsMode:
    "projected_cashflow" | "current_rate" | "percentage" | "fixed_amount";
  savingsPercent: number;
  annualSavings: number;
  realEstateGrowthRate: number;
  accumulationReturn: number;
  leadingBucketYears: number;
  leadingBucketReturn: number;
};
