'use strict';

const models = require('../../models');
const { getCurrentUser } = require('../authService');
const {
  canonicalizeExpenseCategory,
  normalizeBudgetCategoryKey,
} = require('../transactions/transactionCategory');
const { serializeBudgetTarget } = require('./serializeBudgetTarget');

const getBudgetTargets = async () => {
  const user = await getCurrentUser();
  const targets = await models.budgetTargets.findByUserId(user.id);

  return { targets: targets.map(serializeBudgetTarget) };
};

const saveBudgetTarget = async ({
  category,
  targetPercent,
  netTargetPercent,
  grossTargetPercent,
}) => {
  const user = await getCurrentUser();

  // The router (budgetTargets.routes.js) has already checked that `category` is
  // present and each percent is a number in [0, 100]; the only rule left here is
  // that `net_target_percent` defaults to the legacy `target_percent`.
  const cleanCategory = canonicalizeExpenseCategory(category);
  const cleanNetTargetPercent = Number(netTargetPercent ?? targetPercent ?? 0);
  const cleanGrossTargetPercent = Number(grossTargetPercent ?? 0);

  const target = await models.budgetTargets.upsert({
    userId: user.id,
    category: cleanCategory,
    categoryKey: normalizeBudgetCategoryKey(cleanCategory),
    netTargetPercent: cleanNetTargetPercent,
    grossTargetPercent: cleanGrossTargetPercent,
  });

  return { target: serializeBudgetTarget(target) };
};

const deleteBudgetTarget = async ({ id }) => {
  const user = await getCurrentUser();

  await models.budgetTargets.deleteByIdForUserId({ id, userId: user.id });

  return { deleted: true };
};

module.exports = {
  getBudgetTargets,
  saveBudgetTarget,
  deleteBudgetTarget,
};
