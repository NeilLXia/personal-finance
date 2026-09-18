'use strict';

const express = require('express');

const authRoutes = require('./auth.routes');
const plaidRoutes = require('./plaid.routes');
const dashboardRoutes = require('./dashboard.routes');
const transactionRoutes = require('./transactions.routes');
const budgetTargetRoutes = require('./budgetTargets.routes');
const propertyRoutes = require('./properties.routes');
const payslipRoutes = require('./payslips.routes');

// Mounted at /api by index.js. Each sub-router owns one URL resource; paths here
// are relative (no /api prefix).
const router = express.Router();

router.use(authRoutes);
router.use(plaidRoutes);
router.use(dashboardRoutes);
router.use(transactionRoutes);
router.use(budgetTargetRoutes);
router.use(propertyRoutes);
router.use(payslipRoutes);

module.exports = router;
