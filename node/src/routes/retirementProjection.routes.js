'use strict';

const express = require('express');

const { route } = require('../http/asyncRoute');
const { requireAdmin } = require('../middleware/adminOnly');
const retirementProjectionService = require('../services/retirement/retirementProjectionService');

const router = express.Router();

router.get(
  '/retirement-projection',
  requireAdmin,
  route(async (request, response) => {
    response.json(
      await retirementProjectionService.getRetirementProjection(request.query),
    );
  }),
);

module.exports = router;
