'use strict';

const helmet = require('helmet');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: [
        "'self'",
        'https://accounts.google.com',
        'https://*.plaid.com',
      ],
      frameAncestors: ["'none'"],
      frameSrc: ["'self'", 'https://accounts.google.com', 'https://*.plaid.com'],
      imgSrc: [
        "'self'",
        'data:',
        'https://*.googleusercontent.com',
        'https://*.gstatic.com',
      ],
      objectSrc: ["'none'"],
      scriptSrc: [
        "'self'",
        'https://accounts.google.com',
        'https://*.plaid.com',
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: isProduction,
});
