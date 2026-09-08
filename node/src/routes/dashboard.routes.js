'use strict';

const express = require('express');

const dashboardService = require('../services/dashboard/dashboardService');
const { route } = require('../http/asyncRoute');
const { dashboardLimiter } = require('../middleware/rateLimiters');
const {
  parseDashboardQuery,
  parseIncomeAllocationQuery,
  parseTransactionQuery,
} = require('./dashboard.params');

const router = express.Router();

router.get(
  '/dashboard',
  dashboardLimiter,
  route(async (request, response) => {
    response.json(
      await dashboardService.getDashboard(parseDashboardQuery(request)),
    );
  }),
);

router.get(
  '/dashboard/transactions',
  dashboardLimiter,
  route(async (request, response) => {
    response.json(
      await dashboardService.getDashboardTransactions(
        parseTransactionQuery(request),
      ),
    );
  }),
);

router.get(
  '/dashboard/income-allocation',
  dashboardLimiter,
  route(async (request, response) => {
    response.json(
      await dashboardService.getDashboardIncomeAllocation(
        parseIncomeAllocationQuery(request),
      ),
    );
  }),
);

module.exports = router;
