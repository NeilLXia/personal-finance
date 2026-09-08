'use strict';

/**
 * Normalize a budget_targets row for API responses: coerce the percent columns
 * to numbers and let `net_target_percent` fall back to the legacy
 * `target_percent` when it was never set. Shared by the budget-target service
 * and the dashboard payload builder.
 */
const serializeBudgetTarget = (target) => ({
  ...target,
  target_percent: Number(target.target_percent || 0),
  net_target_percent: Number(
    target.net_target_percent || target.target_percent || 0,
  ),
  gross_target_percent: Number(target.gross_target_percent || 0),
});

module.exports = { serializeBudgetTarget };
