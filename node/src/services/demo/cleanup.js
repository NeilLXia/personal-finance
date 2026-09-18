'use strict';

const db = require('../../db/connection');
const models = require('../../models');
const logger = require('../../lib/logger');

const deleteDemoUser = async (userId) => {
  await db.query('DELETE FROM users WHERE id = $1 AND is_demo = TRUE', [userId]);
};

const clearDemoUserData = async (userId) => {
  await db.query('DELETE FROM payslips WHERE user_id = $1', [userId]);
  await db.query('DELETE FROM payslip_uploads WHERE user_id = $1', [userId]);
  await db.query('DELETE FROM transaction_category_rules WHERE user_id = $1', [
    userId,
  ]);
  await db.query('DELETE FROM budget_targets WHERE user_id = $1', [userId]);
  await db.query('DELETE FROM properties WHERE user_id = $1', [userId]);
  await db.query('DELETE FROM plaid_items WHERE user_id = $1', [userId]);
  await db.query('DELETE FROM accounts WHERE user_id = $1', [userId]);
};

const clearDemoSessionData = async (userId) => {
  try {
    await deleteDemoUser(userId);
  } catch (error) {
    logger.warn('Demo session cleanup failed', {
      user_id: userId,
      error: error.message || error,
    });
  }
};

const cleanupExpiredDemoUsers = async () => {
  const deletedCount = await models.users.deleteExpiredDemoUsers();

  if (deletedCount > 0) {
    logger.info('Expired demo users cleaned up', {
      deleted_count: deletedCount,
    });
  }

  return { deleted_count: deletedCount };
};

module.exports = {
  clearDemoUserData,
  clearDemoSessionData,
  cleanupExpiredDemoUsers,
};
