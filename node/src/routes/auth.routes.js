'use strict';

const express = require('express');

const authService = require('../services/authService');
const { route } = require('../http/asyncRoute');
const { authLimiter } = require('../middleware/rateLimiters');
const { validateBody, validateString } = require('../middleware/validation');

const router = express.Router();

router.get(
  '/session',
  route(async (request, response) => {
    response.json(authService.getSession());
  }),
);

router.post(
  '/login/google',
  authLimiter,
  route(async (request, response) => {
    const body = validateBody(request, (value) => ({
      credential: validateString(value.credential, 'credential', {
        required: true,
        maxLength: 5000,
      }),
    }));

    response.json(
      await authService.loginWithGoogle({
        credential: body.credential,
        response,
      }),
    );
  }),
);

router.post(
  '/login/demo',
  authLimiter,
  route(async (request, response) => {
    response.json(await authService.loginAsDemo({ response }));
  }),
);

router.post(
  '/logout',
  authLimiter,
  route(async (request, response) => {
    response.json(await authService.logout({ response }));
  }),
);

module.exports = router;
