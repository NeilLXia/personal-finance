'use strict';

const express = require('express');

const dashboardService = require('../services/dashboard/dashboardService');
const { route } = require('../http/asyncRoute');
const { dashboardLimiter } = require('../middleware/rateLimiters');
const {
  parseDashboardQuery,
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

module.exports = router;
