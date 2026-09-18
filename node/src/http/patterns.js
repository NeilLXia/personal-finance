'use strict';

// Shared request-validation patterns.
module.exports = {
  datePattern: /^\d{4}-\d{2}-\d{2}$/,
  monthPattern: /^\d{4}-\d{2}$/,
  numericIdPattern: /^\d+$/,
  // Trailing-month selector shared by the dashboard's transaction and
  // income-allocation ranges.
  rangePattern: /^(1|3|6|12|custom)$/,
  matchTypePattern: /^(contains|exact)$/,
};
