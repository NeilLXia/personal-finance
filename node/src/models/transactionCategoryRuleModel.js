'use strict';

const db = require('../db/connection');

const upsert = async ({
  userId,
  originalCategory,
  originalCategoryKey,
  vendorName,
  vendorNameKey,
  matchType = 'contains',
  manualCategory,
}) => {
  const { rows } = await db.query(
    `
      INSERT INTO transaction_category_rules (
        user_id,
        original_category,
        original_category_key,
        vendor_name,
        vendor_name_key,
        match_type,
        manual_category
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, original_category_key, vendor_name_key, match_type) DO UPDATE
      SET
        original_category = EXCLUDED.original_category,
        vendor_name = EXCLUDED.vendor_name,
        manual_category = EXCLUDED.manual_category,
        updated_at = NOW()
      RETURNING *
    `,
    [
      userId,
      originalCategory,
      originalCategoryKey,
      vendorName,
      vendorNameKey,
      matchType,
      manualCategory,
    ],
  );

  return rows[0];
};

const findByUserId = async (userId) => {
  const { rows } = await db.query(
    `
      SELECT *
      FROM transaction_category_rules
      WHERE user_id = $1
      ORDER BY vendor_name ASC, original_category ASC
    `,
    [userId],
  );

  return rows;
};

const updateByIdForUserId = async ({
  id,
  userId,
  originalCategory,
  originalCategoryKey,
  vendorName,
  vendorNameKey,
  matchType = 'contains',
  manualCategory,
}) => {
  const { rows } = await db.query(
    `
      UPDATE transaction_category_rules
      SET
        original_category = $3,
        original_category_key = $4,
        vendor_name = $5,
        vendor_name_key = $6,
        match_type = $7,
        manual_category = $8,
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `,
    [
      id,
      userId,
      originalCategory,
      originalCategoryKey,
      vendorName,
      vendorNameKey,
      matchType,
      manualCategory,
    ],
  );

  return rows[0] || null;
};

const deleteByIdForUserId = async ({
  id,
  userId,
}) => {
  await db.query(
    `
      DELETE FROM transaction_category_rules
      WHERE id = $1 AND user_id = $2
    `,
    [id, userId],
  );
};

module.exports = {
  upsert,
  findByUserId,
  updateByIdForUserId,
  deleteByIdForUserId,
};
