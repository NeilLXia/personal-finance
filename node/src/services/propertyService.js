'use strict';

const moment = require('moment');
const models = require('../models');
const {
  createTimeoutError,
  createTimeoutSignal,
  isTimeoutError,
  parsePositiveNumber,
} = require('../lib/httpTimeout');
const { calculateLoanBalance } = require('../lib/loanBalance');
const { getCurrentUser } = require('./authService');

const rentcastApiKey = process.env.RENTCAST_API_KEY;
const rentcastBaseUrl =
  process.env.RENTCAST_BASE_URL || 'https://api.rentcast.io/v1';

const serializeProperty = (property) => ({
  id: property.id,
  address: property.address,
  loan_original_amount:
    property.loan_original_amount === null ||
    property.loan_original_amount === undefined
      ? null
      : Number(property.loan_original_amount),
  loan_annual_interest_rate:
    property.loan_annual_interest_rate === null ||
    property.loan_annual_interest_rate === undefined
      ? null
      : Number(property.loan_annual_interest_rate),
  loan_monthly_payment:
    property.loan_monthly_payment === null ||
    property.loan_monthly_payment === undefined
      ? null
      : Number(property.loan_monthly_payment),
  loan_balance_start_month: property.loan_balance_start_month,
  valuation_month: property.valuation_month,
  estimated_value:
    property.estimated_value === null || property.estimated_value === undefined
      ? null
      : Number(property.estimated_value),
  price_range_low:
    property.price_range_low === null || property.price_range_low === undefined
      ? null
      : Number(property.price_range_low),
  price_range_high:
    property.price_range_high === null || property.price_range_high === undefined
      ? null
      : Number(property.price_range_high),
  loan_balance:
    property.loan_balance === null || property.loan_balance === undefined
      ? null
      : Number(property.loan_balance),
  net_value:
    property.estimated_value === null || property.estimated_value === undefined
      ? null
      : Number(property.estimated_value) - Number(property.loan_balance || 0),
});

const ensureRentcastApiKey = () => {
  if (!rentcastApiKey) {
    const error = new Error('Missing RENTCAST_API_KEY in .env');
    error.status = 400;
    throw error;
  }
};

const getRentcastValueEstimate = async (address) => {
  ensureRentcastApiKey();

  const url = new URL(`${rentcastBaseUrl}/avm/value`);
  url.searchParams.set('address', address);
  url.searchParams.set('compCount', '5');

  const timeoutMs = parsePositiveNumber(process.env.RENTCAST_TIMEOUT_MS, 10000);
  let response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Api-Key': rentcastApiKey,
      },
      signal: createTimeoutSignal(timeoutMs),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw createTimeoutError('RentCast valuation', timeoutMs);
    }

    throw error;
  }
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.message || data.error || 'RentCast valuation request failed',
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  if (data.price === undefined || data.price === null) {
    const error = new Error('RentCast did not return a property value estimate');
    error.status = 502;
    error.data = data;
    throw error;
  }

  return data;
};

const refreshPropertyValue = async (property) => {
  const valuationMonth = moment().startOf('month').format('YYYY-MM-DD');
  const loanBalance = calculateLoanBalance(property, valuationMonth);
  const hasCurrentMonthValuation = await models.properties.hasMonthlyValuation({
    propertyId: property.id,
    userId: property.user_id,
    valuationMonth,
  });

  if (hasCurrentMonthValuation) {
    await models.properties.updateMonthlyLoanBalance({
      propertyId: property.id,
      userId: property.user_id,
      valuationMonth,
      loanBalance,
    });

    return {
      property_id: property.id,
      status: 'skipped',
      loan_balance: loanBalance,
      reason:
        'Property valuation already exists for this month; loan balance updated',
    };
  }

  const valuation = await getRentcastValueEstimate(property.address);

  await models.properties.createMonthlyValuation({
    propertyId: property.id,
    userId: property.user_id,
    valuationMonth,
    estimatedValue: valuation.price,
    priceRangeLow: valuation.priceRangeLow,
    priceRangeHigh: valuation.priceRangeHigh,
    loanBalance,
    rawResponse: valuation,
  });

  return {
    property_id: property.id,
    status: 'refreshed',
    estimated_value: valuation.price,
    loan_balance: loanBalance,
  };
};

const listProperties = async () => {
  const user = await getCurrentUser();
  const properties = await models.properties.findWithLatestValuesByUserId(user.id);

  return {
    properties: properties.map(serializeProperty),
  };
};

const addProperty = async ({
  address,
  loanOriginalAmount = null,
  loanAnnualInterestRate = null,
  loanMonthlyPayment = null,
  loanBalanceStartMonth = null,
}) => {
  if (!address) {
    const error = new Error('Property address is required');
    error.status = 400;
    throw error;
  }
  ensureRentcastApiKey();

  const user = await getCurrentUser();
  const property = await models.properties.upsert({
    userId: user.id,
    address,
    loanOriginalAmount,
    loanAnnualInterestRate,
    loanMonthlyPayment,
    loanBalanceStartMonth,
  });
  const refresh = await refreshPropertyValue(property);
  const properties = await models.properties.findWithLatestValuesByUserId(user.id);

  return {
    property: serializeProperty(
      properties.find((currentProperty) => currentProperty.id === property.id),
    ),
    refresh,
  };
};

const findSerializedProperty = async ({ userId, propertyId }) => {
  const properties = await models.properties.findWithLatestValuesByUserId(userId);
  const property = properties.find(
    (currentProperty) => currentProperty.id === propertyId,
  );

  return property ? serializeProperty(property) : null;
};

const updateProperty = async ({
  propertyId,
  address,
  loanOriginalAmount = null,
  loanAnnualInterestRate = null,
  loanMonthlyPayment = null,
  loanBalanceStartMonth = null,
}) => {
  if (!address) {
    const error = new Error('Property address is required');
    error.status = 400;
    throw error;
  }

  const user = await getCurrentUser();
  const property = await models.properties.updateByIdForUser({
    id: propertyId,
    userId: user.id,
    address,
    loanOriginalAmount,
    loanAnnualInterestRate,
    loanMonthlyPayment,
    loanBalanceStartMonth,
  });

  if (!property) {
    const error = new Error(`No property found for id ${propertyId}`);
    error.status = 404;
    throw error;
  }

  const valuationMonth = moment().startOf('month').format('YYYY-MM-DD');
  const hasCurrentMonthValuation = await models.properties.hasMonthlyValuation({
    propertyId: property.id,
    userId: user.id,
    valuationMonth,
  });

  if (hasCurrentMonthValuation) {
    await models.properties.updateMonthlyLoanBalance({
      propertyId: property.id,
      userId: user.id,
      valuationMonth,
      loanBalance: calculateLoanBalance(property, valuationMonth),
    });
  }

  return {
    property: await findSerializedProperty({
      userId: user.id,
      propertyId: property.id,
    }),
  };
};

const deleteProperty = async (propertyId) => {
  const user = await getCurrentUser();
  const property = await models.properties.deactivateByIdForUser({
    id: propertyId,
    userId: user.id,
  });

  if (!property) {
    const error = new Error(`No property found for id ${propertyId}`);
    error.status = 404;
    throw error;
  }

  return { deleted: true, property_id: propertyId };
};

const refreshProperties = async () => {
  const user = await getCurrentUser();
  const properties = await models.properties.findByUserId(user.id);
  const results = await Promise.all(properties.map(refreshPropertyValue));

  return {
    status: 'complete',
    refreshed: results.filter((result) => result.status === 'refreshed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    items: results,
  };
};

const refreshPropertyById = async (propertyId) => {
  const user = await getCurrentUser();
  const property = await models.properties.findByIdForUser({
    id: propertyId,
    userId: user.id,
  });

  if (!property) {
    const error = new Error(`No property found for id ${propertyId}`);
    error.status = 404;
    throw error;
  }

  return refreshPropertyValue(property);
};

module.exports = {
  listProperties,
  addProperty,
  updateProperty,
  deleteProperty,
  refreshProperties,
  refreshPropertyById,
};
