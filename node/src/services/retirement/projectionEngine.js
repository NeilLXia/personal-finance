'use strict';

const { roundMoney } = require('../../utils/money');

const DEFAULT_ASSUMPTIONS = {
  currentAge: 35,
  retirementAge: 55,
  projectionEndAge: 95,
  inflationRate: 0.025,
  realWageGrowthRate: 0.005,
  annualWageIncrease: 5000,
  lifestyleGrowthRate: 0,
  socialSecurityAge: 67,
  accumulationReturn: 0.05,
  leadingBucketYears: 5,
  leadingBucketReturn: 0.015,
  realEstateGrowthRate: 0.005,
};

const SOCIAL_SECURITY_ASSUMPTIONS_2026 = {
  taxableMaximum: 184500,
  firstBendPoint: 1286,
  secondBendPoint: 7749,
  earliestClaimAge: 62,
  latestClaimAge: 70,
  fullRetirementAge: 67,
};

const TAX_BRACKETS = [
  { rate: 0.1, min: 0, max: 11925 },
  { rate: 0.12, min: 11925, max: 48475 },
  { rate: 0.22, min: 48475, max: 103350 },
  { rate: 0.24, min: 103350, max: 197300 },
  { rate: 0.32, min: 197300, max: 250525 },
  { rate: 0.35, min: 250525, max: 626350 },
  { rate: 0.37, min: 626350, max: Number.POSITIVE_INFINITY },
];

const clampRate = (value, fallback) => {
  const rate = Number(value);

  if (!Number.isFinite(rate)) {
    return fallback;
  }

  return Math.min(Math.max(rate, -0.5), 0.5);
};

const clampAge = (value, fallback, { min = 18, max = 120 } = {}) => {
  const age = Math.round(Number(value));

  if (!Number.isFinite(age)) {
    return fallback;
  }

  return Math.min(Math.max(age, min), max);
};

const positiveNumber = (value, fallback = 0) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(0, number);
};

const calculateMarginalTaxes = (income) => {
  const taxableIncome = positiveNumber(income);

  return roundMoney(
    TAX_BRACKETS.reduce((taxes, bracket) => {
      const taxableAmount = Math.max(
        0,
        Math.min(taxableIncome, bracket.max) - bracket.min,
      );

      return taxes + taxableAmount * bracket.rate;
    }, 0),
  );
};

const clampWholeNumber = (value, fallback, { min = 0, max = 30 } = {}) => {
  const number = Math.round(Number(value));

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(Math.max(number, min), max);
};

const calculateMortgagePayoff = ({
  balance,
  annualInterestRate,
  monthlyPayment,
}) => {
  const principal = positiveNumber(balance);
  const payment = positiveNumber(monthlyPayment);
  const annualRate = clampRate(annualInterestRate, 0);

  if (principal <= 0 || payment <= 0) {
    return null;
  }

  const monthlyRate = annualRate / 12;
  let remainingBalance = principal;
  let months = 0;

  while (remainingBalance > 0 && months < 12 * 60) {
    remainingBalance =
      monthlyRate > 0 ? remainingBalance * (1 + monthlyRate) : remainingBalance;
    remainingBalance -= payment;
    months += 1;

    if (monthlyRate > 0 && payment <= remainingBalance * monthlyRate) {
      return null;
    }
  }

  return months < 12 * 60 ? months : null;
};

const projectMortgageYear = ({
  balance,
  annualInterestRate,
  monthlyPayment,
}) => {
  const monthlyRate = clampRate(annualInterestRate, 0) / 12;
  const payment = positiveNumber(monthlyPayment);
  let remainingBalance = positiveNumber(balance);
  let interestPaid = 0;
  let principalPaid = 0;
  let paymentPaid = 0;

  for (let month = 0; month < 12 && remainingBalance > 0; month += 1) {
    const interest = roundMoney(remainingBalance * monthlyRate);
    const paymentThisMonth = Math.min(payment, remainingBalance + interest);
    const principalThisMonth = Math.max(0, paymentThisMonth - interest);

    remainingBalance = roundMoney(
      Math.max(0, remainingBalance + interest - paymentThisMonth),
    );
    interestPaid = roundMoney(interestPaid + interest);
    principalPaid = roundMoney(principalPaid + principalThisMonth);
    paymentPaid = roundMoney(paymentPaid + paymentThisMonth);

    if (payment <= 0) {
      break;
    }
  }

  return {
    endingBalance: remainingBalance,
    interestPaid,
    principalPaid,
    paymentPaid,
  };
};

const calculateLeadingBucketAssets = ({
  years,
  index,
  portfolioAssets,
  assumptions,
}) => {
  const requiredWithdrawals = years
    .slice(index, index + assumptions.leadingBucketYears)
    .reduce((total, year) => total + year.portfolioWithdrawal, 0);

  return roundMoney(
    Math.min(Math.max(0, portfolioAssets), requiredWithdrawals),
  );
};

const calculateNominalReturn = ({ realReturn, inflationRate }) =>
  (1 + realReturn) * (1 + inflationRate) - 1;

const calculatePortfolioReturn = ({
  portfolioAssets,
  leadingBucketAssets,
  assumptions,
}) => {
  const growthAssets = roundMoney(
    Math.max(0, portfolioAssets - leadingBucketAssets),
  );
  const investmentReturn = roundMoney(
    growthAssets * assumptions.nominalAccumulationReturn +
      leadingBucketAssets * assumptions.nominalLeadingBucketReturn,
  );

  return {
    growthAssets,
    investmentReturn,
  };
};

const liquidateRealEstateEquity = ({
  shortfall,
  realEstateValue,
  mortgageBalance,
}) => {
  const availableEquity = roundMoney(
    Math.max(0, realEstateValue - mortgageBalance),
  );
  const liquidationProceeds = roundMoney(
    Math.min(positiveNumber(shortfall), availableEquity),
  );

  if (liquidationProceeds <= 0 || availableEquity <= 0) {
    return {
      liquidationProceeds: 0,
      remainingShortfall: roundMoney(positiveNumber(shortfall)),
      realEstateValue,
      mortgageBalance,
    };
  }

  const liquidationRatio = Math.min(1, liquidationProceeds / availableEquity);

  return {
    liquidationProceeds,
    remainingShortfall: roundMoney(
      Math.max(0, positiveNumber(shortfall) - liquidationProceeds),
    ),
    realEstateValue: roundMoney(realEstateValue * (1 - liquidationRatio)),
    mortgageBalance: roundMoney(mortgageBalance * (1 - liquidationRatio)),
  };
};

const calculateRetirementBaseSpending = ({
  inputs,
  projectedBaseExpensesAtRetirement,
  projectedIncomeAtRetirement,
}) => {
  const strategy = inputs.retirementSpending || { mode: 'projected_lifestyle' };

  if (strategy.mode === 'fixed_amount') {
    return positiveNumber(
      strategy.annualAmount,
      projectedBaseExpensesAtRetirement,
    );
  }

  if (strategy.mode === 'percentage') {
    const percent = positiveNumber(strategy.percent, 80) / 100;

    return roundMoney(projectedIncomeAtRetirement * percent);
  }

  return roundMoney(projectedBaseExpensesAtRetirement);
};

const calculateSavingsRate = ({ savings, income }) => {
  const incomeAmount = positiveNumber(income);

  if (incomeAmount <= 0) {
    return 0;
  }

  return Math.round((savings / incomeAmount) * 10000) / 10000;
};

const calculateAccumulationSavings = ({
  inputs,
  income,
  netCashflow,
  currentSavingsRate,
  yearsFromNow,
  nominalIncomeGrowth,
}) => {
  const strategy = inputs.savingsStrategy || { mode: 'projected_cashflow' };

  if (strategy.mode === 'current_rate') {
    return roundMoney(Math.max(0, income) * currentSavingsRate);
  }

  if (strategy.mode === 'percentage') {
    const percent = positiveNumber(strategy.percent, 20) / 100;

    return roundMoney(Math.max(0, income) * percent);
  }

  if (strategy.mode === 'fixed_amount') {
    return roundMoney(
      positiveNumber(strategy.annualAmount, inputs.currentSavings) *
        (1 + nominalIncomeGrowth) ** yearsFromNow,
    );
  }

  return Math.max(0, netCashflow);
};

const calculateRetirementWithdrawalTax = ({ shortfall }) =>
  calculateMarginalTaxes(shortfall);

const calculateSocialSecurityClaimingAdjustment = (claimAge) => {
  const fullRetirementAge = SOCIAL_SECURITY_ASSUMPTIONS_2026.fullRetirementAge;
  const monthsFromFullRetirementAge = Math.round(
    (claimAge - fullRetirementAge) * 12,
  );

  if (monthsFromFullRetirementAge < 0) {
    const earlyMonths = Math.abs(monthsFromFullRetirementAge);
    const firstReductionMonths = Math.min(earlyMonths, 36);
    const additionalReductionMonths = Math.max(0, earlyMonths - 36);

    return Math.max(
      0,
      1 -
        firstReductionMonths * (5 / 9 / 100) -
        additionalReductionMonths * (5 / 12 / 100),
    );
  }

  return 1 + Math.min(monthsFromFullRetirementAge, 36) * (8 / 12 / 100);
};

const calculateSocialSecurityAnnualBenefit = ({
  projectedGrossIncomeAtClaimAge,
  claimAge,
}) => {
  const coveredAnnualIncome = Math.min(
    positiveNumber(projectedGrossIncomeAtClaimAge),
    SOCIAL_SECURITY_ASSUMPTIONS_2026.taxableMaximum,
  );
  const aime = coveredAnnualIncome / 12;
  const firstBand = Math.min(
    aime,
    SOCIAL_SECURITY_ASSUMPTIONS_2026.firstBendPoint,
  );
  const secondBand = Math.min(
    Math.max(0, aime - SOCIAL_SECURITY_ASSUMPTIONS_2026.firstBendPoint),
    SOCIAL_SECURITY_ASSUMPTIONS_2026.secondBendPoint -
      SOCIAL_SECURITY_ASSUMPTIONS_2026.firstBendPoint,
  );
  const thirdBand = Math.max(
    0,
    aime - SOCIAL_SECURITY_ASSUMPTIONS_2026.secondBendPoint,
  );
  const primaryInsuranceAmount =
    firstBand * 0.9 + secondBand * 0.32 + thirdBand * 0.15;

  return roundMoney(
    primaryInsuranceAmount *
      calculateSocialSecurityClaimingAdjustment(claimAge) *
      12,
  );
};

const buildRetirementProjection = (inputs) => {
  const currentAge = clampAge(
    inputs.currentAge,
    DEFAULT_ASSUMPTIONS.currentAge,
  );
  const retirementAge = clampAge(
    inputs.retirementAge,
    DEFAULT_ASSUMPTIONS.retirementAge,
    {
      min: currentAge,
    },
  );
  const projectionEndAge = clampAge(
    inputs.projectionEndAge,
    DEFAULT_ASSUMPTIONS.projectionEndAge,
    { min: retirementAge + 1 },
  );
  const assumptions = {
    inflationRate: clampRate(
      inputs.inflationRate,
      DEFAULT_ASSUMPTIONS.inflationRate,
    ),
    realWageGrowthRate: clampRate(
      inputs.realWageGrowthRate,
      DEFAULT_ASSUMPTIONS.realWageGrowthRate,
    ),
    annualWageIncrease: positiveNumber(
      inputs.annualWageIncrease,
      DEFAULT_ASSUMPTIONS.annualWageIncrease,
    ),
    lifestyleGrowthRate: clampRate(
      inputs.lifestyleGrowthRate,
      DEFAULT_ASSUMPTIONS.lifestyleGrowthRate,
    ),
    socialSecurityAge: clampAge(
      inputs.socialSecurity?.startAge,
      DEFAULT_ASSUMPTIONS.socialSecurityAge,
      {
        min: SOCIAL_SECURITY_ASSUMPTIONS_2026.earliestClaimAge,
        max: SOCIAL_SECURITY_ASSUMPTIONS_2026.latestClaimAge,
      },
    ),
    accumulationReturn: clampRate(
      inputs.investmentAssumptions?.accumulationReturn,
      DEFAULT_ASSUMPTIONS.accumulationReturn,
    ),
    leadingBucketYears: clampWholeNumber(
      inputs.investmentAssumptions?.leadingBucketYears,
      DEFAULT_ASSUMPTIONS.leadingBucketYears,
      { min: 1, max: 30 },
    ),
    leadingBucketReturn: clampRate(
      inputs.investmentAssumptions?.leadingBucketReturn ??
        inputs.investmentAssumptions?.earlyRetirementReturn,
      DEFAULT_ASSUMPTIONS.leadingBucketReturn,
    ),
    realEstateGrowthRate: clampRate(
      inputs.realEstateGrowthRate,
      DEFAULT_ASSUMPTIONS.realEstateGrowthRate,
    ),
  };
  assumptions.nominalAccumulationReturn = calculateNominalReturn({
    realReturn: assumptions.accumulationReturn,
    inflationRate: assumptions.inflationRate,
  });
  assumptions.nominalLeadingBucketReturn = calculateNominalReturn({
    realReturn: assumptions.leadingBucketReturn,
    inflationRate: assumptions.inflationRate,
  });
  const yearsUntilRetirement = Math.max(0, retirementAge - currentAge);
  const annualMortgagePayment = positiveNumber(inputs.mortgage?.annualPayment);
  const mortgagePayoffMonths = calculateMortgagePayoff({
    balance: inputs.mortgage?.balance,
    annualInterestRate: inputs.mortgage?.annualInterestRate,
    monthlyPayment: inputs.mortgage?.monthlyPayment,
  });
  const mortgagePayoffAge =
    mortgagePayoffMonths == null
      ? null
      : Math.min(
          projectionEndAge,
          currentAge + Math.max(1, Math.ceil(mortgagePayoffMonths / 12)),
        );
  const baseAnnualExpenses = Math.max(
    0,
    positiveNumber(inputs.currentExpenses) - annualMortgagePayment,
  );
  const nominalExpenseGrowth =
    assumptions.inflationRate + assumptions.lifestyleGrowthRate;
  const nominalIncomeGrowth =
    inputs.wageGrowthMode === 'nominal'
      ? 0
      : assumptions.inflationRate + assumptions.realWageGrowthRate;
  const currentGrossPay = positiveNumber(
    inputs.currentGrossPay,
    positiveNumber(inputs.currentGrossIncome, inputs.currentIncome),
  );
  const currentOtherIncome = positiveNumber(inputs.currentOtherIncome);
  const projectGrossPay = (yearsFromNow) => {
    if (inputs.wageGrowthMode === 'nominal') {
      return roundMoney(
        currentGrossPay + assumptions.annualWageIncrease * yearsFromNow,
      );
    }

    return roundMoney(
      currentGrossPay * (1 + nominalIncomeGrowth) ** yearsFromNow,
    );
  };
  const projectOtherIncome = (yearsFromNow) =>
    roundMoney(
      currentOtherIncome * (1 + assumptions.inflationRate) ** yearsFromNow,
    );
  const projectTaxes = (grossPay) => calculateMarginalTaxes(grossPay);
  const projectIncome = (yearsFromNow) => {
    return roundMoney(
      projectGrossPay(yearsFromNow) + projectOtherIncome(yearsFromNow),
    );
  };
  const projectedIncomeAtRetirement = projectIncome(yearsUntilRetirement);
  const projectedBaseExpensesAtRetirement = roundMoney(
    baseAnnualExpenses * (1 + nominalExpenseGrowth) ** yearsUntilRetirement,
  );
  const mortgageAnnualPaymentAtRetirement =
    mortgagePayoffAge == null || mortgagePayoffAge > retirementAge
      ? annualMortgagePayment
      : 0;
  const retirementBaseSpending = calculateRetirementBaseSpending({
    inputs,
    projectedBaseExpensesAtRetirement,
    projectedIncomeAtRetirement,
  });
  const socialSecurityEarningsEndAge = Math.min(
    retirementAge,
    assumptions.socialSecurityAge,
  );
  const socialSecurityAnnualBenefit = calculateSocialSecurityAnnualBenefit({
    projectedGrossIncomeAtClaimAge: projectGrossPay(
      Math.max(0, socialSecurityEarningsEndAge - currentAge),
    ),
    claimAge: assumptions.socialSecurityAge,
  });
  const currentCashSavings = positiveNumber(
    inputs.currentCashSavings,
    positiveNumber(inputs.annualContributions),
  );
  const currentRetirementSavings = positiveNumber(
    inputs.currentRetirementSavings,
  );
  const currentSavings = positiveNumber(
    inputs.currentSavings,
    currentCashSavings + currentRetirementSavings,
  );
  const currentSavingsBreakdown = Array.isArray(inputs.currentSavingsBreakdown)
    ? inputs.currentSavingsBreakdown
        .map((item) => ({
          key: String(item.key || item.label || 'savings'),
          label: String(item.label || 'Savings'),
          annualAmount: roundMoney(Number(item.annualAmount || 0)),
        }))
        .filter((item) => item.annualAmount !== 0)
    : [];
  const currentSavingsIncome = positiveNumber(
    inputs.currentSavingsIncome,
    positiveNumber(inputs.currentIncome) + currentRetirementSavings,
  );
  const currentSavingsRate = calculateSavingsRate({
    savings: currentSavings,
    income: currentSavingsIncome,
  });
  let portfolioAssets = positiveNumber(
    inputs.currentPortfolioAssets,
    positiveNumber(inputs.currentAssets),
  );
  let projectedRealEstateValue = positiveNumber(inputs.currentRealEstateValue);
  let projectedMortgageBalance = positiveNumber(
    inputs.currentRealEstateDebt,
    inputs.mortgage?.balance,
  );
  const projectedYears = [];

  for (let age = currentAge; age <= projectionEndAge; age += 1) {
    const phase = age < retirementAge ? 'accumulation' : 'retirement';
    const beginningRealEstateValue = projectedRealEstateValue;
    const beginningMortgageBalance = projectedMortgageBalance;
    const beginningRealEstateEquity = roundMoney(
      beginningRealEstateValue - beginningMortgageBalance,
    );
    const realEstateReturn = roundMoney(
      Math.max(0, beginningRealEstateValue) * assumptions.realEstateGrowthRate,
    );
    const mortgageProjection = projectMortgageYear({
      balance: beginningMortgageBalance,
      annualInterestRate: inputs.mortgage?.annualInterestRate,
      monthlyPayment: inputs.mortgage?.monthlyPayment,
    });
    const yearsFromNow = age - currentAge;
    const income = phase === 'accumulation' ? projectIncome(yearsFromNow) : 0;
    const mortgageExpense = mortgageProjection.paymentPaid;
    const retirementBaseExpense = roundMoney(
      retirementBaseSpending *
        (1 + assumptions.inflationRate) ** Math.max(0, age - retirementAge),
    );
    const expenses =
      phase === 'accumulation'
        ? roundMoney(
            baseAnnualExpenses * (1 + nominalExpenseGrowth) ** yearsFromNow +
              mortgageExpense,
          )
        : roundMoney(retirementBaseExpense + mortgageExpense);
    const socialSecurityIncome =
      phase === 'retirement' && age >= assumptions.socialSecurityAge
        ? roundMoney(
            socialSecurityAnnualBenefit *
              (1 + assumptions.inflationRate) **
                Math.max(0, age - assumptions.socialSecurityAge),
          )
        : 0;
    const retirementSpendingShortfall =
      phase === 'retirement' ? Math.max(0, expenses - socialSecurityIncome) : 0;
    const retirementWithdrawalTax = roundMoney(
      phase === 'retirement'
        ? calculateRetirementWithdrawalTax({
            shortfall: retirementSpendingShortfall,
          })
        : 0,
    );
    const netCashflow = roundMoney(
      income +
        socialSecurityIncome -
        expenses -
        (phase === 'accumulation'
          ? projectTaxes(projectGrossPay(yearsFromNow))
          : 0),
    );
    const portfolioContribution =
      phase === 'accumulation'
        ? calculateAccumulationSavings({
            inputs,
            income,
            netCashflow,
            currentSavingsRate,
            yearsFromNow,
            nominalIncomeGrowth,
          })
        : 0;
    const portfolioWithdrawal =
      phase === 'retirement'
        ? roundMoney(Math.max(0, -netCashflow) + retirementWithdrawalTax)
        : 0;

    projectedRealEstateValue = roundMoney(
      beginningRealEstateValue + realEstateReturn,
    );
    projectedMortgageBalance = mortgageProjection.endingBalance;

    projectedYears.push({
      age,
      year: new Date().getFullYear() + yearsFromNow,
      phase,
      income,
      expenses,
      mortgageExpense,
      taxes: roundMoney(
        phase === 'accumulation'
          ? projectTaxes(projectGrossPay(yearsFromNow))
          : retirementWithdrawalTax,
      ),
      netCashflow,
      socialSecurityIncome,
      portfolioContribution,
      portfolioWithdrawal: roundMoney(portfolioWithdrawal),
      beginningRealEstateValue: roundMoney(beginningRealEstateValue),
      beginningMortgageBalance: roundMoney(beginningMortgageBalance),
      beginningRealEstateEquity: roundMoney(beginningRealEstateEquity),
      realEstateReturn,
      mortgageInterestPaid: mortgageProjection.interestPaid,
      mortgagePrincipalPaid: mortgageProjection.principalPaid,
      endingRealEstateValue: projectedRealEstateValue,
      endingMortgageBalance: projectedMortgageBalance,
    });
  }

  const years = [];
  let projectionRealEstateValue = positiveNumber(inputs.currentRealEstateValue);
  let projectionMortgageBalance = positiveNumber(
    inputs.currentRealEstateDebt,
    inputs.mortgage?.balance,
  );

  for (let index = 0; index < projectedYears.length; index += 1) {
    const projectedYear = projectedYears[index];
    const beginningRealEstateValue = projectionRealEstateValue;
    const beginningMortgageBalance = projectionMortgageBalance;
    const beginningRealEstateEquity = roundMoney(
      beginningRealEstateValue - beginningMortgageBalance,
    );
    const realEstateReturn = roundMoney(
      Math.max(0, beginningRealEstateValue) * assumptions.realEstateGrowthRate,
    );
    const mortgageProjection = projectMortgageYear({
      balance: beginningMortgageBalance,
      annualInterestRate: inputs.mortgage?.annualInterestRate,
      monthlyPayment: inputs.mortgage?.monthlyPayment,
    });
    const endingRealEstateValueBeforeLiquidation = roundMoney(
      beginningRealEstateValue + realEstateReturn,
    );
    const endingMortgageBalanceBeforeLiquidation =
      mortgageProjection.endingBalance;
    const expenses = roundMoney(
      projectedYear.expenses -
        projectedYear.mortgageExpense +
        mortgageProjection.paymentPaid,
    );
    const retirementSpendingShortfall =
      projectedYear.phase === 'retirement'
        ? Math.max(0, expenses - projectedYear.socialSecurityIncome)
        : 0;
    const taxes =
      projectedYear.phase === 'accumulation'
        ? projectedYear.taxes
        : calculateRetirementWithdrawalTax({
            shortfall: retirementSpendingShortfall,
          });
    const netCashflow = roundMoney(
      projectedYear.income +
        projectedYear.socialSecurityIncome -
        expenses -
        (projectedYear.phase === 'accumulation' ? taxes : 0),
    );
    const portfolioContribution =
      projectedYear.phase === 'accumulation'
        ? calculateAccumulationSavings({
            inputs,
            income: projectedYear.income,
            netCashflow,
            currentSavingsRate,
            yearsFromNow: projectedYear.age - currentAge,
            nominalIncomeGrowth,
          })
        : 0;
    const portfolioWithdrawal =
      projectedYear.phase === 'retirement'
        ? roundMoney(Math.max(0, -netCashflow) + taxes)
        : 0;
    const beginningPortfolioAssets = portfolioAssets;
    const leadingBucketAssets = calculateLeadingBucketAssets({
      years: projectedYears,
      index,
      portfolioAssets: beginningPortfolioAssets,
      assumptions,
    });
    const { growthAssets, investmentReturn } = calculatePortfolioReturn({
      portfolioAssets: beginningPortfolioAssets,
      leadingBucketAssets,
      assumptions,
    });
    const beginningAssets = roundMoney(
      beginningPortfolioAssets + beginningRealEstateEquity,
    );

    // Timing convention: annual return is applied to beginning assets, then
    // contributions or withdrawals occur at year end. If the portfolio cannot
    // cover spending, real estate equity is liquidated to cover the shortfall.
    const portfolioBeforeWithdrawal = roundMoney(
      beginningPortfolioAssets + investmentReturn + portfolioContribution,
    );
    const portfolioAfterWithdrawal = roundMoney(
      portfolioBeforeWithdrawal - portfolioWithdrawal,
    );
    const liquidation = liquidateRealEstateEquity({
      shortfall: Math.max(0, -portfolioAfterWithdrawal),
      realEstateValue: endingRealEstateValueBeforeLiquidation,
      mortgageBalance: endingMortgageBalanceBeforeLiquidation,
    });

    portfolioAssets = roundMoney(Math.max(0, portfolioAfterWithdrawal));
    projectionRealEstateValue = liquidation.realEstateValue;
    projectionMortgageBalance = liquidation.mortgageBalance;
    const endingRealEstateEquity = roundMoney(
      liquidation.realEstateValue - liquidation.mortgageBalance,
    );
    const endingAssets = roundMoney(portfolioAssets + endingRealEstateEquity);

    years.push({
      ...projectedYear,
      expenses,
      mortgageExpense: mortgageProjection.paymentPaid,
      taxes,
      netCashflow,
      portfolioContribution,
      portfolioWithdrawal: roundMoney(portfolioWithdrawal),
      beginningAssets,
      beginningPortfolioAssets: roundMoney(beginningPortfolioAssets),
      beginningRealEstateValue: roundMoney(beginningRealEstateValue),
      beginningMortgageBalance: roundMoney(beginningMortgageBalance),
      beginningRealEstateEquity: roundMoney(beginningRealEstateEquity),
      leadingBucketAssets,
      growthAssets,
      investmentReturn,
      realEstateReturn,
      mortgageInterestPaid: mortgageProjection.interestPaid,
      mortgagePrincipalPaid: mortgageProjection.principalPaid,
      realEstateLiquidationProceeds: liquidation.liquidationProceeds,
      unmetWithdrawal: liquidation.remainingShortfall,
      endingRealEstateValue: liquidation.realEstateValue,
      endingMortgageBalance: liquidation.mortgageBalance,
      endingPortfolioAssets: portfolioAssets,
      endingRealEstateEquity,
      endingAssets,
      isDepleted: liquidation.remainingShortfall > 0,
    });
  }

  const retirementYear = years.find((year) => year.age === retirementAge);
  const requiredAssetsAtRetirement = calculateRequiredAssets({
    years,
    retirementAge,
    assumptions,
  });
  const projectedPortfolioAssetsAtRetirement =
    retirementYear?.beginningPortfolioAssets || portfolioAssets;
  const projectedRealEstateEquityAtRetirement =
    retirementYear?.beginningRealEstateEquity ||
    projectedRealEstateValue - projectedMortgageBalance;
  const projectedAssetsAtRetirement =
    retirementYear?.beginningAssets ||
    portfolioAssets + projectedRealEstateValue - projectedMortgageBalance;
  const projectedRetirementSpending =
    retirementYear?.expenses ||
    retirementBaseSpending + mortgageAnnualPaymentAtRetirement;
  const projectedSavingsYear =
    years.find((year) => year.phase === 'accumulation') || years[0];
  const projectedSavings = projectedSavingsYear
    ? projectedSavingsYear.portfolioContribution
    : 0;
  const projectedSavingsIncome = projectedSavingsYear
    ? projectedSavingsYear.income
    : 0;
  const projectedSavingsRate = calculateSavingsRate({
    savings: projectedSavings,
    income: projectedSavingsIncome,
  });

  return {
    inputs: {
      ...inputs,
      currentAge,
      retirementAge,
      projectionEndAge,
      currentExpenses: roundMoney(positiveNumber(inputs.currentExpenses)),
      currentIncome: roundMoney(positiveNumber(inputs.currentIncome)),
      currentGrossIncome: roundMoney(
        positiveNumber(inputs.currentGrossIncome, inputs.currentIncome),
      ),
      currentGrossPay: roundMoney(currentGrossPay),
      currentTaxes: roundMoney(positiveNumber(inputs.currentTaxes)),
      currentOtherIncome: roundMoney(currentOtherIncome),
      currentAssets: roundMoney(positiveNumber(inputs.currentAssets)),
      currentPortfolioAssets: roundMoney(
        positiveNumber(inputs.currentPortfolioAssets),
      ),
      currentRealEstateValue: roundMoney(
        positiveNumber(inputs.currentRealEstateValue),
      ),
      currentRealEstateDebt: roundMoney(
        positiveNumber(inputs.currentRealEstateDebt),
      ),
      currentRealEstateEquity: roundMoney(
        positiveNumber(inputs.currentRealEstateValue) -
          positiveNumber(inputs.currentRealEstateDebt),
      ),
      currentCashSavings: roundMoney(currentCashSavings),
      currentRetirementSavings: roundMoney(currentRetirementSavings),
      currentSavings: roundMoney(currentSavings),
      currentSavingsIncome: roundMoney(currentSavingsIncome),
      annualContributions: roundMoney(
        positiveNumber(inputs.annualContributions),
      ),
      retirementSpending: inputs.retirementSpending || {
        mode: 'projected_lifestyle',
      },
      socialSecurity: {
        startAge: assumptions.socialSecurityAge,
        annualBenefit: roundMoney(socialSecurityAnnualBenefit),
        source: 'calculated',
      },
      investmentAssumptions: {
        accumulationReturn: assumptions.accumulationReturn,
        leadingBucketYears: assumptions.leadingBucketYears,
        leadingBucketReturn: assumptions.leadingBucketReturn,
      },
      inflationRate: assumptions.inflationRate,
      wageGrowthMode: inputs.wageGrowthMode === 'nominal' ? 'nominal' : 'real',
      realWageGrowthRate: assumptions.realWageGrowthRate,
      annualWageIncrease: roundMoney(assumptions.annualWageIncrease),
      lifestyleGrowthRate: assumptions.lifestyleGrowthRate,
      savingsStrategy: inputs.savingsStrategy || { mode: 'projected_cashflow' },
      realEstateGrowthRate: assumptions.realEstateGrowthRate,
    },
    assumptions: {
      nominalExpenseGrowth,
      nominalIncomeGrowth,
    },
    summary: {
      retirementAge,
      projectedRetirementSpending: roundMoney(projectedRetirementSpending),
      projectedAssetsAtRetirement: roundMoney(projectedAssetsAtRetirement),
      projectedPortfolioAssetsAtRetirement: roundMoney(
        projectedPortfolioAssetsAtRetirement,
      ),
      projectedRealEstateEquityAtRetirement: roundMoney(
        projectedRealEstateEquityAtRetirement,
      ),
      requiredAssetsAtRetirement,
      projectedCushion: roundMoney(
        projectedPortfolioAssetsAtRetirement - requiredAssetsAtRetirement,
      ),
      savingsRateComparison: {
        currentCashSavings: roundMoney(currentCashSavings),
        currentRetirementSavings: roundMoney(currentRetirementSavings),
        currentSavings: roundMoney(currentSavings),
        currentSavingsBreakdown,
        currentIncome: roundMoney(currentSavingsIncome),
        currentSavingsRate,
        projectedSavings: roundMoney(projectedSavings),
        projectedIncome: roundMoney(projectedSavingsIncome),
        projectedSavingsRate,
        savingsRateGap: roundMoney(projectedSavingsRate - currentSavingsRate),
      },
      isFunded:
        projectedPortfolioAssetsAtRetirement >= requiredAssetsAtRetirement,
    },
    mortgage: {
      annualPayment: roundMoney(annualMortgagePayment),
      payoffAge: mortgagePayoffAge,
      source: inputs.mortgage?.source || 'unavailable',
    },
    years,
    timeline: [
      { key: 'today', label: 'Today', age: currentAge },
      { key: 'retirement', label: 'Retire', age: retirementAge },
      ...(mortgagePayoffAge
        ? [{ key: 'mortgage', label: 'Mortgage', age: mortgagePayoffAge }]
        : []),
      {
        key: 'social_security',
        label: 'Social Security',
        age: assumptions.socialSecurityAge,
      },
      { key: 'end', label: 'End', age: projectionEndAge },
    ].sort((a, b) => a.age - b.age),
  };
};

const calculateRequiredAssets = ({ years, retirementAge, assumptions }) => {
  let presentValue = 0;

  for (const year of years.filter((item) => item.age >= retirementAge)) {
    const yearsFromRetirement = year.age - retirementAge;
    let discount = 1;

    for (let offset = 0; offset <= yearsFromRetirement; offset += 1) {
      const returnRate =
        offset < assumptions.leadingBucketYears
          ? assumptions.nominalLeadingBucketReturn
          : assumptions.nominalAccumulationReturn;

      discount *= 1 + returnRate;
    }

    presentValue += year.portfolioWithdrawal / discount;
  }

  return roundMoney(presentValue);
};

module.exports = {
  DEFAULT_ASSUMPTIONS,
  buildRetirementProjection,
  calculateMortgagePayoff,
  calculateRequiredAssets,
};
