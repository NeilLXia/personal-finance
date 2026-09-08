'use strict';

const express = require('express');

const { WEBHOOK_PATH } = require('../http/publicApi');

const urlencodedBodyParser = express.urlencoded({ extended: false });

const jsonBodyParser = express.json({
  verify(request, response, buffer) {
    // Plaid webhook signature verification needs the exact bytes.
    if (request.originalUrl.split('?')[0] === WEBHOOK_PATH) {
      request.rawBody = buffer;
    }
  },
});

module.exports = { urlencodedBodyParser, jsonBodyParser };
