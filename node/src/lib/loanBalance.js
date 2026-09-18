'use strict';

const moment = require('moment');

const monthDifference = (startMonth, endMonth) =>
  Math.max(0, endMonth.diff(startMonth, 'months'));

/**
 * Amortized remaining balance for a property's mortgage at `valuationMonth`,
 * from its original amount, annual rate, monthly payment, and start month.
 * Returns null when any loan field is missing. Shared by propertyService (live
 * refresh) and the property-value-history import script.
 */
const calculateLoanBalance = (property, valuationMonth) => {
  if (
    property.loan_original_amount === null ||
    property.loan_original_amount === undefined ||
    property.loan_annual_interest_rate === null ||
    property.loan_annual_interest_rate === undefined ||
    property.loan_monthly_payment === null ||
    property.loan_monthly_payment === undefined ||
    !property.loan_balance_start_month
  ) {
    return null;
  }

  const principal = Number(property.loan_original_amount);
  const annualInterestRate = Number(property.loan_annual_interest_rate) / 100;
  const monthlyPayment = Number(property.loan_monthly_payment);
  const monthlyInterestRate = annualInterestRate / 12;
  const startMonth = moment(property.loan_balance_start_month).startOf('month');
  const targetMonth = moment(valuationMonth).startOf('month');
  const elapsedMonths = monthDifference(startMonth, targetMonth);

  if (monthlyInterestRate === 0) {
    return Math.max(0, principal - monthlyPayment * elapsedMonths);
  }

  const growth = Math.pow(1 + monthlyInterestRate, elapsedMonths);
  const balance =
    principal * growth - monthlyPayment * ((growth - 1) / monthlyInterestRate);

  return Math.max(0, Number(balance.toFixed(2)));
};

module.exports = { calculateLoanBalance };
