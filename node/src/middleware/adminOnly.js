'use strict';

const requireAdmin = (request, response, next) => {
  if (request.user?.account_type === 'admin') {
    next();
    return;
  }

  response.status(403).json({
    error: { error_message: 'Admin access required.' },
  });
};

module.exports = { requireAdmin };
