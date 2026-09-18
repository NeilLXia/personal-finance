'use strict';

const db = require('../db/connection');

const findByUserId = async (userId) => {
  const { rows } = await db.query(
    `
      SELECT *
      FROM budget_targets
      WHERE user_id = $1
      ORDER BY category ASC
    `,
    [userId],
  );

  return rows;
};

const upsert = async ({
  userId,
  category,
  categoryKey,
  netTargetPercent,
  grossTargetPercent,
}) => {
  const { rows } = await db.query(
    `
      INSERT INTO budget_targets (
        user_id,
        category,
        category_key,
        target_percent,
        net_target_percent,
        gross_target_percent
      )
      VALUES ($1, $2, $3, $4, $4, $5)
      ON CONFLICT (user_id, category_key) DO UPDATE
      SET
        category = EXCLUDED.category,
        target_percent = EXCLUDED.target_percent,
        net_target_percent = EXCLUDED.net_target_percent,
        gross_target_percent = EXCLUDED.gross_target_percent,
        updated_at = NOW()
      RETURNING *
    `,
    [userId, category, categoryKey, netTargetPercent, grossTargetPercent],
  );

  return rows[0];
};

const deleteByIdForUserId = async ({
  id,
  userId,
}) => {
  await db.query(
    `
      DELETE FROM budget_targets
      WHERE id = $1 AND user_id = $2
    `,
    [id, userId],
  );
};

module.exports = {
  findByUserId,
  upsert,
  deleteByIdForUserId,
};
