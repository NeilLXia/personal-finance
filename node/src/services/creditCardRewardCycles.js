'use strict';

const moment = require('moment');

const getReferenceDate = (selectedMonth) =>
  selectedMonth
    ? moment(`${selectedMonth}-01`, 'YYYY-MM-DD', true)
    : moment();

const getMonthIndex = (value) => {
  const month = value && value.toISOString
    ? value.toISOString().slice(5, 7)
    : String(value).slice(5, 7);

  return Number(month) - 1;
};

/**
 * The most recent occurrence of the account's effective month (any year) that
 * is on or before the reference date - the start of the reward year a perk
 * completion belongs to.
 */
const getCurrentCycleStart = (effectiveMonth, referenceDate = moment()) => {
  if (!effectiveMonth) {
    return null;
  }

  const cycleMonth = getMonthIndex(effectiveMonth);
  const cycleStart = moment(referenceDate).startOf('month').month(cycleMonth);

  if (cycleStart.isAfter(referenceDate, 'month')) {
    cycleStart.subtract(1, 'year');
  }

  return cycleStart.format('YYYY-MM-DD');
};

/**
 * The full reward-year window the reference date falls in: from the cycle
 * start through the day before it recurs next year, capped at the end of the
 * reference date's month so it never reaches into transactions that haven't
 * happened yet.
 */
const getCurrentCycleRange = (effectiveMonth, referenceDate = moment()) => {
  const cycleStart = getCurrentCycleStart(effectiveMonth, referenceDate);

  if (!cycleStart) {
    return null;
  }

  const cycleEnd = moment(cycleStart).add(1, 'year').subtract(1, 'day');
  const cappedEnd = moment.min(cycleEnd, moment(referenceDate).endOf('month'));

  return {
    cycleStart,
    cycleEnd: cappedEnd.format('YYYY-MM-DD'),
  };
};

module.exports = {
  getCurrentCycleRange,
  getCurrentCycleStart,
  getReferenceDate,
};
