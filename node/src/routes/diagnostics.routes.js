'use strict';

const express = require('express');

const diagnosticsService = require('../services/diagnosticsService');
const { route } = require('../http/asyncRoute');

const router = express.Router();

router.get(
  '/diagnostics/health-check',
  route(async (request, response) => {
    response.json(await diagnosticsService.getHealthCheck());
  }),
);

module.exports = router;
