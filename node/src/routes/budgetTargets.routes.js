'use strict';

const express = require('express');

const budgetTargetService = require('../services/budgetTargets/budgetTargetService');
const { route } = require('../http/asyncRoute');
const { mutationLimiter } = require('../middleware/rateLimiters');
const {
  validateBody,
  validateNumber,
  validateString,
} = require('../middleware/validation');
const { parseIdParam } = require('../http/requestParsers');

const router = express.Router();

router.get(
  '/budget-targets',
  route(async (request, response) => {
    response.json(await budgetTargetService.getBudgetTargets());
  }),
);

router.post(
  '/budget-targets',
  mutationLimiter,
  route(async (request, response) => {
    const body = validateBody(request, (value) => ({
      category: validateString(value.category, 'category', {
        required: true,
        maxLength: 120,
      }),
      targetPercent: validateNumber(
        value.target_percent ?? value.monthly_amount,
        'target_percent',
        { min: 0, max: 100 },
      ),
      netTargetPercent: validateNumber(
        value.net_target_percent,
        'net_target_percent',
        { min: 0, max: 100 },
      ),
      grossTargetPercent: validateNumber(
        value.gross_target_percent,
        'gross_target_percent',
        { min: 0, max: 100 },
      ),
    }));

    response.json(
      await budgetTargetService.saveBudgetTarget({
        category: body.category,
        targetPercent: body.targetPercent,
        netTargetPercent: body.netTargetPercent,
        grossTargetPercent: body.grossTargetPercent,
      }),
    );
  }),
);

router.delete(
  '/budget-targets/:id',
  mutationLimiter,
  route(async (request, response) => {
    response.json(
      await budgetTargetService.deleteBudgetTarget({ id: parseIdParam(request) }),
    );
  }),
);

module.exports = router;
