'use strict';

const moneyPattern = /^(-)?(\d+)(?:\.(\d+))?$/;

const toCents = (value) => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const cleanValue = String(value).replace(/[$,\s]/g, '');
  const match = cleanValue.match(moneyPattern);

  if (!match) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 100) : 0;
  }

  const [, negative, wholePart, fractionalPart = ''] = match;
  const paddedFraction = `${fractionalPart}000`;
  const firstTwoFractionDigits = Number(paddedFraction.slice(0, 2));
  const shouldRoundUp = Number(paddedFraction[2]) >= 5;
  const absoluteCents =
    Number(wholePart) * 100 + firstTwoFractionDigits + (shouldRoundUp ? 1 : 0);

  return negative ? -absoluteCents : absoluteCents;
};

const fromCents = (cents) => cents / 100;

const roundMoney = (value) => fromCents(toCents(value));

const addMoney = (...values) =>
  fromCents(values.reduce((total, value) => total + toCents(value), 0));

const subtractMoney = (left, right) => fromCents(toCents(left) - toCents(right));

const negateMoney = (value) => fromCents(-toCents(value));

const absMoney = (value) => fromCents(Math.abs(toCents(value)));

module.exports = {
  absMoney,
  addMoney,
  fromCents,
  negateMoney,
  roundMoney,
  subtractMoney,
  toCents,
};
