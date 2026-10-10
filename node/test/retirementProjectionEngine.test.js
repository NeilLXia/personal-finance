'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildRetirementProjection,
} = require('../src/services/retirement/projectionEngine');

const roundToCents = (value) => Math.round(value * 100) / 100;
const testTaxBrackets = [
  { rate: 0.1, min: 0, max: 11925 },
  { rate: 0.12, min: 11925, max: 48475 },
  { rate: 0.22, min: 48475, max: 103350 },
  { rate: 0.24, min: 103350, max: 197300 },
  { rate: 0.32, min: 197300, max: 250525 },
  { rate: 0.35, min: 250525, max: 626350 },
  { rate: 0.37, min: 626350, max: Number.POSITIVE_INFINITY },
];
const calculateExpectedMarginalTaxes = (income) =>
  roundToCents(
    testTaxBrackets.reduce((taxes, bracket) => {
      const taxableAmount = Math.max(
        0,
        Math.min(income, bracket.max) - bracket.min,
      );

      return taxes + taxableAmount * bracket.rate;
    }, 0),
  );

const buildInputs = (overrides = {}) => ({
  currentAge: 60,
  retirementAge: 60,
  projectionEndAge: 65,
  currentIncome: 180000,
  currentExpenses: 120000,
  currentPortfolioAssets: 900000,
  currentRealEstateValue: 750000,
  currentRealEstateDebt: 60000,
  annualContributions: 0,
  inflationRate: 0,
  lifestyleGrowthRate: 0,
  realWageGrowthRate: 0,
  realEstateGrowthRate: 0,
  socialSecurity: {
    startAge: 67,
    annualBenefit: 0,
  },
  investmentAssumptions: {
    accumulationReturn: 0,
    leadingBucketYears: 5,
    leadingBucketReturn: 0,
  },
  mortgage: {
    balance: 60000,
    annualInterestRate: 0,
    monthlyPayment: 2500,
    annualPayment: 30000,
  },
  ...overrides,
});

test('retirement expenses drop after the mortgage is paid off', () => {
  const projection = buildRetirementProjection(buildInputs());

  const beforePayoff = projection.years.find((year) => year.age === 60);
  const afterPayoff = projection.years.find((year) => year.age === 62);

  assert.equal(beforePayoff.mortgageExpense, 30000);
  assert.equal(beforePayoff.expenses, 120000);
  assert.equal(afterPayoff.mortgageExpense, 0);
  assert.equal(afterPayoff.expenses, 90000);
});

test('positive net cashflow is contributed to portfolio assets', () => {
  const projection = buildRetirementProjection(
    buildInputs({
      currentAge: 40,
      retirementAge: 42,
      projectionEndAge: 43,
      currentIncome: 100000,
      currentExpenses: 70000,
      currentPortfolioAssets: 1000000,
      currentRealEstateValue: 0,
      currentRealEstateDebt: 0,
      mortgage: {
        balance: 0,
        annualInterestRate: 0,
        monthlyPayment: 0,
        annualPayment: 0,
      },
    }),
  );

  const firstYear = projection.years.find((year) => year.age === 40);

  assert.equal(firstYear.netCashflow, 13086);
  assert.equal(firstYear.portfolioContribution, 13086);
  assert.equal(firstYear.endingPortfolioAssets, 1013086);
});

test('projected pay starts from gross pay less taxes plus other income', () => {
  const projection = buildRetirementProjection(
    buildInputs({
      currentAge: 40,
      retirementAge: 42,
      projectionEndAge: 43,
      currentIncome: 90000,
      currentGrossPay: 100000,
      currentTaxes: 25000,
      currentOtherIncome: 15000,
      currentExpenses: 70000,
      currentPortfolioAssets: 1000000,
      currentRealEstateValue: 0,
      currentRealEstateDebt: 0,
      inflationRate: 0.03,
      realWageGrowthRate: 0.02,
      mortgage: {
        balance: 0,
        annualInterestRate: 0,
        monthlyPayment: 0,
        annualPayment: 0,
      },
    }),
  );

  const firstYear = projection.years.find((year) => year.age === 40);
  const secondYear = projection.years.find((year) => year.age === 41);

  assert.equal(firstYear.income, 115000);
  assert.equal(firstYear.taxes, calculateExpectedMarginalTaxes(100000));
  assert.equal(firstYear.netCashflow, 28086);
  assert.equal(secondYear.income, 120450);
  assert.equal(secondYear.taxes, calculateExpectedMarginalTaxes(105000));
});

test('net cashflow subtracts taxes and mortgage payments from gross income', () => {
  const projection = buildRetirementProjection(
    buildInputs({
      currentAge: 40,
      retirementAge: 42,
      projectionEndAge: 43,
      currentIncome: 120000,
      currentGrossPay: 120000,
      currentTaxes: 30000,
      currentOtherIncome: 0,
      currentExpenses: 80000,
      currentPortfolioAssets: 1000000,
      currentRealEstateValue: 400000,
      currentRealEstateDebt: 200000,
      mortgage: {
        balance: 200000,
        annualInterestRate: 0,
        monthlyPayment: 1000,
        annualPayment: 12000,
      },
    }),
  );

  const firstYear = projection.years.find((year) => year.age === 40);

  assert.equal(firstYear.income, 120000);
  assert.equal(firstYear.taxes, calculateExpectedMarginalTaxes(120000));
  assert.equal(firstYear.mortgageExpense, 12000);
  assert.equal(firstYear.expenses, 80000);
  assert.equal(firstYear.netCashflow, 18353);
});

test('upcoming withdrawals are assigned to the leading bucket return', () => {
  const projection = buildRetirementProjection(
    buildInputs({
      currentAge: 40,
      retirementAge: 42,
      projectionEndAge: 43,
      currentIncome: 0,
      currentExpenses: 10000,
      currentPortfolioAssets: 100000,
      currentRealEstateValue: 0,
      currentRealEstateDebt: 0,
      mortgage: {
        balance: 0,
        annualInterestRate: 0,
        monthlyPayment: 0,
        annualPayment: 0,
      },
      investmentAssumptions: {
        accumulationReturn: 0.1,
        leadingBucketYears: 3,
        leadingBucketReturn: 0.02,
      },
    }),
  );

  const firstYear = projection.years.find((year) => year.age === 40);

  assert.equal(firstYear.leadingBucketAssets, 11000);
  assert.equal(firstYear.growthAssets, 89000);
  assert.equal(firstYear.investmentReturn, 9120);
});

test('equity growth is applied above inflation', () => {
  const projection = buildRetirementProjection(
    buildInputs({
      currentAge: 40,
      retirementAge: 42,
      projectionEndAge: 43,
      currentIncome: 0,
      currentExpenses: 0,
      currentPortfolioAssets: 100000,
      currentRealEstateValue: 0,
      currentRealEstateDebt: 0,
      inflationRate: 0.025,
      mortgage: {
        balance: 0,
        annualInterestRate: 0,
        monthlyPayment: 0,
        annualPayment: 0,
      },
      investmentAssumptions: {
        accumulationReturn: 0.04,
        leadingBucketYears: 3,
        leadingBucketReturn: 0.02,
      },
    }),
  );

  const firstYear = projection.years.find((year) => year.age === 40);

  assert.equal(firstYear.investmentReturn, 6600);
});

test('derisked return is applied above inflation', () => {
  const projection = buildRetirementProjection(
    buildInputs({
      currentAge: 40,
      retirementAge: 40,
      projectionEndAge: 41,
      currentIncome: 0,
      currentExpenses: 10000,
      currentPortfolioAssets: 100000,
      currentRealEstateValue: 0,
      currentRealEstateDebt: 0,
      inflationRate: 0.025,
      mortgage: {
        balance: 0,
        annualInterestRate: 0,
        monthlyPayment: 0,
        annualPayment: 0,
      },
      investmentAssumptions: {
        accumulationReturn: 0,
        leadingBucketYears: 5,
        leadingBucketReturn: 0.02,
      },
    }),
  );

  const firstYear = projection.years.find((year) => year.age === 40);

  assert.equal(firstYear.investmentReturn, 2956.64);
});

test('savings rate comparison includes current retirement savings', () => {
  const projection = buildRetirementProjection(
    buildInputs({
      currentAge: 40,
      retirementAge: 42,
      projectionEndAge: 43,
      currentIncome: 100000,
      currentExpenses: 70000,
      currentCashSavings: 12000,
      currentRetirementSavings: 8000,
      currentSavings: 20000,
      currentSavingsBreakdown: [
        {
          key: 'brokerage',
          label: 'Brokerage 1234',
          annualAmount: 12000,
        },
        {
          key: 'paystub_retirement_savings',
          label: 'Paystub retirement savings',
          annualAmount: 8000,
        },
      ],
      currentSavingsIncome: 108000,
      currentPortfolioAssets: 1000000,
      currentRealEstateValue: 0,
      currentRealEstateDebt: 0,
      mortgage: {
        balance: 0,
        annualInterestRate: 0,
        monthlyPayment: 0,
        annualPayment: 0,
      },
    }),
  );

  assert.equal(
    projection.summary.savingsRateComparison.currentSavingsRate,
    0.1852,
  );
  assert.equal(
    projection.summary.savingsRateComparison.projectedSavingsRate,
    0.1309,
  );
  assert.equal(
    projection.summary.savingsRateComparison.currentRetirementSavings,
    8000,
  );
  assert.deepEqual(
    projection.summary.savingsRateComparison.currentSavingsBreakdown,
    [
      {
        key: 'brokerage',
        label: 'Brokerage 1234',
        annualAmount: 12000,
      },
      {
        key: 'paystub_retirement_savings',
        label: 'Paystub retirement savings',
        annualAmount: 8000,
      },
    ],
  );
});

test('social security benefit is calculated from projected covered gross income', () => {
  const projection = buildRetirementProjection(
    buildInputs({
      currentAge: 60,
      retirementAge: 60,
      projectionEndAge: 68,
      currentGrossIncome: 120000,
      currentIncome: 90000,
      currentExpenses: 70000,
      currentPortfolioAssets: 1000000,
      currentRealEstateValue: 0,
      currentRealEstateDebt: 0,
      socialSecurity: {
        startAge: 67,
        annualBenefit: 1,
      },
      mortgage: {
        balance: 0,
        annualInterestRate: 0,
        monthlyPayment: 0,
        annualPayment: 0,
      },
    }),
  );

  const firstSocialSecurityYear = projection.years.find(
    (year) => year.age === 67,
  );

  assert.equal(projection.inputs.socialSecurity.annualBenefit, 42758.52);
  assert.equal(firstSocialSecurityYear.socialSecurityIncome, 42758.52);
});

test('social security benefit reflects retirement age and claim age', () => {
  const earlyRetirement = buildRetirementProjection(
    buildInputs({
      currentAge: 40,
      retirementAge: 55,
      projectionEndAge: 70,
      currentGrossIncome: 90000,
      currentIncome: 70000,
      currentExpenses: 50000,
      currentPortfolioAssets: 1000000,
      currentRealEstateValue: 0,
      currentRealEstateDebt: 0,
      inflationRate: 0.02,
      realWageGrowthRate: 0.02,
      socialSecurity: {
        startAge: 67,
      },
      mortgage: {
        balance: 0,
        annualInterestRate: 0,
        monthlyPayment: 0,
        annualPayment: 0,
      },
    }),
  );
  const laterRetirement = buildRetirementProjection(
    buildInputs({
      currentAge: 40,
      retirementAge: 67,
      projectionEndAge: 70,
      currentGrossIncome: 90000,
      currentIncome: 70000,
      currentExpenses: 50000,
      currentPortfolioAssets: 1000000,
      currentRealEstateValue: 0,
      currentRealEstateDebt: 0,
      inflationRate: 0.02,
      realWageGrowthRate: 0.02,
      socialSecurity: {
        startAge: 67,
      },
      mortgage: {
        balance: 0,
        annualInterestRate: 0,
        monthlyPayment: 0,
        annualPayment: 0,
      },
    }),
  );
  const delayedClaim = buildRetirementProjection(
    buildInputs({
      currentAge: 40,
      retirementAge: 67,
      projectionEndAge: 72,
      currentGrossIncome: 90000,
      currentIncome: 70000,
      currentExpenses: 50000,
      currentPortfolioAssets: 1000000,
      currentRealEstateValue: 0,
      currentRealEstateDebt: 0,
      inflationRate: 0.02,
      realWageGrowthRate: 0.02,
      socialSecurity: {
        startAge: 70,
      },
      mortgage: {
        balance: 0,
        annualInterestRate: 0,
        monthlyPayment: 0,
        annualPayment: 0,
      },
    }),
  );

  assert.ok(
    laterRetirement.inputs.socialSecurity.annualBenefit >
      earlyRetirement.inputs.socialSecurity.annualBenefit,
  );
  assert.ok(
    delayedClaim.inputs.socialSecurity.annualBenefit >
      laterRetirement.inputs.socialSecurity.annualBenefit,
  );
});

test('social security claim age is clamped to the valid claiming window', () => {
  const tooEarly = buildRetirementProjection(
    buildInputs({
      currentAge: 35,
      retirementAge: 55,
      projectionEndAge: 95,
      socialSecurity: {
        startAge: 55,
      },
    }),
  );
  const tooLate = buildRetirementProjection(
    buildInputs({
      currentAge: 75,
      retirementAge: 75,
      projectionEndAge: 95,
      socialSecurity: {
        startAge: 75,
      },
    }),
  );

  assert.equal(tooEarly.inputs.socialSecurity.startAge, 62);
  assert.equal(tooLate.inputs.socialSecurity.startAge, 70);
});

test('retirement withdrawals liquidate real estate equity after portfolio assets are exhausted', () => {
  const projection = buildRetirementProjection(
    buildInputs({
      currentAge: 65,
      retirementAge: 65,
      projectionEndAge: 66,
      currentIncome: 0,
      currentGrossIncome: 0,
      currentExpenses: 120000,
      currentPortfolioAssets: 50000,
      currentRealEstateValue: 500000,
      currentRealEstateDebt: 100000,
      socialSecurity: {
        startAge: 70,
      },
      mortgage: {
        balance: 100000,
        annualInterestRate: 0,
        monthlyPayment: 0,
        annualPayment: 0,
      },
    }),
  );

  const firstYear = projection.years.find((year) => year.age === 65);
  const secondYear = projection.years.find((year) => year.age === 66);

  assert.equal(firstYear.portfolioWithdrawal, 120000);
  assert.equal(firstYear.endingPortfolioAssets, 0);
  assert.equal(firstYear.realEstateLiquidationProceeds, 70000);
  assert.equal(firstYear.endingRealEstateEquity, 330000);
  assert.equal(firstYear.isDepleted, false);
  assert.equal(secondYear.beginningRealEstateEquity, 330000);
});

test('retirement taxes are based on expenses net of social security income', () => {
  const projection = buildRetirementProjection(
    buildInputs({
      currentAge: 65,
      retirementAge: 65,
      projectionEndAge: 66,
      currentGrossPay: 100000,
      currentTaxes: 25000,
      currentIncome: 75000,
      currentGrossIncome: 100000,
      currentOtherIncome: 0,
      currentExpenses: 100000,
      currentPortfolioAssets: 500000,
      currentRealEstateValue: 0,
      currentRealEstateDebt: 0,
      socialSecurity: {
        startAge: 65,
      },
      mortgage: {
        balance: 0,
        annualInterestRate: 0,
        monthlyPayment: 0,
        annualPayment: 0,
      },
    }),
  );

  const firstYear = projection.years.find((year) => year.age === 65);
  const expectedTaxableWithdrawalNeed = roundToCents(
    firstYear.expenses - firstYear.socialSecurityIncome,
  );

  assert.equal(
    firstYear.taxes,
    calculateExpectedMarginalTaxes(expectedTaxableWithdrawalNeed),
  );
  assert.equal(
    firstYear.portfolioWithdrawal,
    roundToCents(expectedTaxableWithdrawalNeed + firstYear.taxes),
  );
  assert.equal(firstYear.netCashflow, -expectedTaxableWithdrawalNeed);
});
